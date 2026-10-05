import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { guardianConsents, guardians, studentGuardians } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireGuardian, requireStaff } from "@/lib/action-access";

type GuardianAccount = Awaited<ReturnType<typeof requireGuardian>>;
export class SchoolConsentError extends Error {}
export const smsPreferencesSchema = z.object({ guardianId: z.uuid(), schoolId: z.uuid(),
  announcements: z.boolean() });
export type SmsPreferencesInput = z.input<typeof smsPreferencesSchema>;

export async function updateGuardianSmsPreferences(account: GuardianAccount, raw: SmsPreferencesInput) {
  const input = smsPreferencesSchema.parse(raw);
  if (!account.guardians.some(profile => profile.id === input.guardianId && profile.organizationId === input.schoolId)) {
    throw new SchoolConsentError("This guardian profile is not linked to your account.");
  }
  return savePreferences(account.userId, input, account.userId);
}

export const staffSmsPreferencesSchema = smsPreferencesSchema.omit({ schoolId: true }).extend({
  evidence: z.string().trim().min(8, "Describe when and how the guardian requested this change.").max(500) });

export async function recordGuardianSmsPreferences(actor: Awaited<ReturnType<typeof requireStaff>>,
  raw: z.input<typeof staffSmsPreferencesSchema>) {
  if (!["office_staff", "school_admin"].includes(actor.role)) throw new SchoolConsentError("Office or school administrator access required.");
  const input = staffSmsPreferencesSchema.parse(raw);
  return savePreferences(actor.userId, { ...input, schoolId: actor.organizationId }, undefined, input.evidence);
}

async function savePreferences(actorUserId: string, input: SmsPreferencesInput, ownedUserId?: string, evidence?: string) {
  return db.transaction(async tx => {
    const [guardian] = await tx.select({ id: guardians.id, phone: guardians.phone }).from(guardians)
      .where(and(eq(guardians.id, input.guardianId), eq(guardians.organizationId, input.schoolId),
        ownedUserId ? eq(guardians.userId, ownedUserId) : undefined)).for("update");
    if (!guardian) throw new SchoolConsentError("This guardian profile is unavailable.");
    const [legalLink] = await tx.select({ id: studentGuardians.id }).from(studentGuardians)
      .where(and(eq(studentGuardians.organizationId, input.schoolId),
        eq(studentGuardians.guardianId, input.guardianId), eq(studentGuardians.hasLegalResponsibility, true))).limit(1);
    if (!legalLink) throw new SchoolConsentError("A legal-responsibility link is required for SMS preferences.");
    const [existing] = await tx.select().from(guardianConsents).where(and(eq(guardianConsents.organizationId, input.schoolId),
      eq(guardianConsents.guardianId, input.guardianId))).for("update");
    const now = new Date();
    const fields = { optInSmsAnnouncements: input.announcements,
      smsConfirmedAt: now, phone: guardian.phone ?? "", updatedAt: now };
    const [saved] = existing ? await tx.update(guardianConsents).set(fields).where(eq(guardianConsents.id, existing.id)).returning({ id: guardianConsents.id }) :
      await tx.insert(guardianConsents).values({ ...fields, organizationId: input.schoolId, guardianId: input.guardianId })
        .returning({ id: guardianConsents.id });
    await logAuditEvent({ organizationId: input.schoolId, actorUserId,
      action: evidence ? "guardian.sms_preferences_recorded" : "guardian.sms_preferences_confirmed", entityType: "guardian_consent", entityId: saved.id,
      metadata: { guardianId: input.guardianId, announcements: input.announcements, ...(evidence ? { evidence } : {}) } }, tx);
    return { confirmedAt: now };
  });
}
