import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { guardianConsents, guardians, studentGuardians, students } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireGuardian } from "@/lib/action-access";

type GuardianAccount = Awaited<ReturnType<typeof requireGuardian>>;
export const schoolConsentSchema = z.object({ guardianId: z.uuid(), schoolId: z.uuid(),
  kind: z.enum(["media", "excursion"]), granted: z.boolean() });
export type SchoolConsentInput = z.input<typeof schoolConsentSchema>;
export class SchoolConsentError extends Error {}

export async function updateGuardianSchoolConsent(account: GuardianAccount, raw: SchoolConsentInput) {
  const input = schoolConsentSchema.parse(raw);
  if (!account.guardians.some(profile => profile.id === input.guardianId && profile.organizationId === input.schoolId)) {
    throw new SchoolConsentError("This guardian profile is not linked to your account.");
  }
  return db.transaction(async tx => {
    const [guardian] = await tx.select({ id: guardians.id, phone: guardians.phone }).from(guardians)
      .where(and(eq(guardians.id, input.guardianId), eq(guardians.organizationId, input.schoolId),
        eq(guardians.userId, account.userId))).for("update");
    if (!guardian) throw new SchoolConsentError("This guardian profile is no longer available.");
    const links = await tx.select({ studentId: studentGuardians.studentId }).from(studentGuardians)
      .innerJoin(students, and(eq(students.id, studentGuardians.studentId), eq(students.organizationId, input.schoolId)))
      .where(and(eq(studentGuardians.organizationId, input.schoolId), eq(studentGuardians.guardianId, input.guardianId),
        eq(studentGuardians.hasLegalResponsibility, true)));
    if (!links.length) throw new SchoolConsentError("A legal-responsibility link is required to manage school consents.");
    const [existing] = await tx.select().from(guardianConsents).where(and(
      eq(guardianConsents.organizationId, input.schoolId), eq(guardianConsents.guardianId, input.guardianId))).for("update");
    const field = input.kind === "media" ? "mediaConsent" : "excursionConsent";
    const previous = existing?.[field] ?? false;
    if (previous === input.granted) return { changed: false, granted: input.granted };
    const now = new Date();
    let consentId = existing?.id;
    if (existing) {
      await tx.update(guardianConsents).set({ [field]: input.granted, updatedAt: now })
        .where(and(eq(guardianConsents.id, existing.id), eq(guardianConsents.organizationId, input.schoolId)));
    } else {
      const [created] = await tx.insert(guardianConsents).values({ organizationId: input.schoolId, guardianId: input.guardianId,
        phone: guardian.phone ?? "", [field]: input.granted }).returning({ id: guardianConsents.id });
      if (!created) throw new SchoolConsentError("The consent choice could not be saved.");
      consentId = created.id;
    }
    await logAuditEvent({ organizationId: input.schoolId, actorUserId: account.userId,
      action: "guardian.school_consent_updated", entityType: "guardian_consent", entityId: consentId,
      metadata: { guardianId: input.guardianId, kind: input.kind, previous, granted: input.granted,
        studentIds: links.map(link => link.studentId) } }, tx);
    return { changed: true, granted: input.granted };
  });
}
