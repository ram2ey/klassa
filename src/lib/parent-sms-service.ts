import { createHash } from "node:crypto";
import { and, eq, inArray, isNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { academicYears, auditEvents, classes, courtRestrictions, enrollments, guardianConsents, guardians, organizations, smsDispatches, studentGuardians, students } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";
import { normalizePhoneNumber } from "@/lib/sms";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
const audienceSchema = z.object({ scope: z.enum(["whole_school", "grade", "class"]), targetId: z.string(),
  message: z.string().trim().min(5).max(320) }).superRefine((value, ctx) => {
  if (value.scope === "whole_school" && value.targetId !== "all") ctx.addIssue({ code: "custom", message: "Use the whole-school audience." });
  if (value.scope !== "whole_school" && !z.uuid().safeParse(value.targetId).success) ctx.addIssue({ code: "custom", message: "Choose a valid grade or class." });
});
export type ParentSmsInput = z.input<typeof audienceSchema>;
export type ParentSmsQueueInput = ParentSmsInput & { requestId: string };

function authorize(actor: Actor) {
  if (actor.role !== "school_admin" && actor.role !== "office_staff") throw new Error("School administrator or office staff access required.");
}

async function findRecipients(query: Pick<typeof db, "select">, organizationId: string, raw: ParentSmsInput) {
  const input = audienceSchema.parse(raw);
  let targetStudentIds: string[];
  if (input.scope === "whole_school") {
    const rows = await query.select({ id: students.id }).from(students).where(and(eq(students.organizationId, organizationId), eq(students.status, "active"), isNull(students.processingRestrictedAt)));
    targetStudentIds = rows.map(row => row.id);
  } else {
    const [currentYear] = await query.select({ id: academicYears.id }).from(academicYears)
      .where(and(eq(academicYears.organizationId, organizationId), eq(academicYears.isCurrent, true)));
    if (!currentYear) throw new Error("Choose a current academic year before sending a grade or class announcement.");
    const audienceClasses = await query.select({ id: classes.id }).from(classes).where(and(
      eq(classes.organizationId, organizationId), eq(classes.academicYearId, currentYear.id),
      input.scope === "grade" ? eq(classes.gradeLevelId, input.targetId) : eq(classes.id, input.targetId)));
    if (input.scope === "class" && !audienceClasses.length) throw new Error("Class was not found in your school's current academic year.");
    const classIds = audienceClasses.map(row => row.id);
    const rows = classIds.length ? await query.select({ studentId: enrollments.studentId }).from(enrollments)
      .innerJoin(students, and(eq(students.id, enrollments.studentId), eq(students.organizationId, organizationId)))
      .where(and(eq(enrollments.organizationId, organizationId), eq(enrollments.academicYearId, currentYear.id),
        inArray(enrollments.classId, classIds), eq(enrollments.status, "active"), eq(students.status, "active"),
        isNull(students.processingRestrictedAt))) : [];
    targetStudentIds = Array.from(new Set(rows.map(row => row.studentId)));
  }
  if (!targetStudentIds.length) return { eligible: [], unreachableCount: 0 };
  const recipients = await query.select({ studentId: studentGuardians.studentId, guardianId: guardians.id,
    firstName: guardians.firstName, lastName: guardians.lastName, phone: guardians.phone, verifiedAt: guardians.phoneVerifiedAt })
    .from(studentGuardians).innerJoin(guardians, and(eq(guardians.id, studentGuardians.guardianId), eq(guardians.organizationId, organizationId)))
    .where(and(eq(studentGuardians.organizationId, organizationId), inArray(studentGuardians.studentId, targetStudentIds),
      eq(studentGuardians.hasLegalResponsibility, true)));
  const restrictions = await query.select().from(courtRestrictions).where(and(eq(courtRestrictions.organizationId, organizationId),
    inArray(courtRestrictions.studentId, targetStudentIds), eq(courtRestrictions.isEnforced, true),
    or(eq(courtRestrictions.prohibitDirectContact, true), eq(courtRestrictions.prohibitDisclosure, true))));
  const allGuardianIds = new Set(recipients.map(row => row.guardianId));
  const consentRows = await query.select({ guardianId: guardianConsents.guardianId, allowed: guardianConsents.optInSmsAnnouncements })
    .from(guardianConsents).where(and(eq(guardianConsents.organizationId, organizationId), inArray(guardianConsents.guardianId, [...allGuardianIds])));
  const consentByGuardian = new Map(consentRows.map(row => [row.guardianId, row.allowed]));
  const today = new Date().toISOString().slice(0, 10);
  const eligible = new Map<string, { guardianId: string; studentId: string; name: string; phone: string }>();
  for (const recipient of recipients) {
    if (consentByGuardian.get(recipient.guardianId) === false) continue;
    if (!recipient.phone || !recipient.verifiedAt) continue;
    const phone = normalizePhoneNumber(recipient.phone);
    if (!/^\+233\d{9}$/.test(phone)) continue;
    const restricted = restrictions.some(order => order.studentId === recipient.studentId &&
      (!order.restrictedGuardianId || order.restrictedGuardianId === recipient.guardianId) &&
      order.effectiveDate <= today && (!order.expirationDate || order.expirationDate >= today));
    if (!restricted && !eligible.has(recipient.guardianId)) eligible.set(recipient.guardianId, {
      guardianId: recipient.guardianId, studentId: recipient.studentId,
      name: `${recipient.firstName} ${recipient.lastName}`.trim(), phone,
    });
  }
  return { eligible: [...eligible.values()], unreachableCount: Math.max(0, allGuardianIds.size - eligible.size) };
}

export async function previewParentSmsRecipients(actor: Actor, raw: ParentSmsInput) {
  authorize(actor);
  const input = audienceSchema.parse(raw);
  const result = await findRecipients(db, actor.organizationId, input);
  return { recipientCount: result.eligible.length, unreachableCount: result.unreachableCount };
}

export async function queueParentSmsAnnouncement(actor: Actor, raw: ParentSmsQueueInput) {
  authorize(actor);
  const input = audienceSchema.parse(raw);
  const campaignId = z.uuid().parse(raw.requestId);
  const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
  return db.transaction(async tx => {
    // Serialize requests for this school. The audit receipt and all dispatches
    // commit together, so a retry returns the original result even after delivery.
    const [school] = await tx.select({ id: organizations.id }).from(organizations)
      .where(eq(organizations.id, actor.organizationId)).for("update");
    if (!school) throw new Error("School was not found.");
    const [receipt] = await tx.select({ actorUserId: auditEvents.actorUserId, metadata: auditEvents.metadata }).from(auditEvents)
      .where(and(eq(auditEvents.organizationId, actor.organizationId), eq(auditEvents.action, "parent_sms_announcement.queued"), eq(auditEvents.entityId, campaignId)));
    if (receipt) {
      const metadata = receipt.metadata as { fingerprint?: string; queuedCount: number; unreachableCount: number };
      if (receipt.actorUserId !== actor.userId || metadata.fingerprint !== fingerprint) {
        throw new Error("This request was already used for another announcement. Review a new announcement.");
      }
      return { campaignId, queuedCount: metadata.queuedCount, unreachableCount: metadata.unreachableCount };
    }
    const { eligible, unreachableCount } = await findRecipients(tx, actor.organizationId, input);
    if (!eligible.length) throw new Error("No reachable guardian numbers are available for this audience.");
    for (const recipient of eligible) {
      await tx.insert(smsDispatches).values({ organizationId: actor.organizationId, guardianId: recipient.guardianId,
        studentId: recipient.studentId, recipientPhone: recipient.phone, recipientName: recipient.name, message: input.message,
        purpose: "announcement", idempotencyKey: `parent-announcement:${actor.organizationId}:${campaignId}:${recipient.guardianId}`, status: "queued" });
    }
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: "parent_sms_announcement.queued", entityType: "sms_announcement", entityId: campaignId,
      metadata: { scope: input.scope, targetId: input.targetId, fingerprint, queuedCount: eligible.length, unreachableCount, messageLength: input.message.length } }, tx);
    return { campaignId, queuedCount: eligible.length, unreachableCount };
  });
}
