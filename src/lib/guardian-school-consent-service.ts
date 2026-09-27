import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { guardianConsents, guardians, studentGuardians } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireGuardian } from "@/lib/action-access";

type GuardianAccount = Awaited<ReturnType<typeof requireGuardian>>;
export class SchoolConsentError extends Error {}
export const smsPreferencesSchema = z.object({ guardianId: z.uuid(), schoolId: z.uuid(),
  announcements: z.boolean(), attendance: z.boolean() });
export type SmsPreferencesInput = z.input<typeof smsPreferencesSchema>;

export async function updateGuardianSmsPreferences(account: GuardianAccount, raw: SmsPreferencesInput) {
  const input = smsPreferencesSchema.parse(raw);
  if (!account.guardians.some(profile => profile.id === input.guardianId && profile.organizationId === input.schoolId)) {
    throw new SchoolConsentError("This guardian profile is not linked to your account.");
  }
  return db.transaction(async tx => {
    const [guardian] = await tx.select({ id: guardians.id, phone: guardians.phone }).from(guardians)
      .where(and(eq(guardians.id, input.guardianId), eq(guardians.organizationId, input.schoolId),
        eq(guardians.userId, account.userId))).for("update");
    if (!guardian) throw new SchoolConsentError("This guardian profile is unavailable.");
    const [legalLink] = await tx.select({ id: studentGuardians.id }).from(studentGuardians)
      .where(and(eq(studentGuardians.organizationId, input.schoolId),
        eq(studentGuardians.guardianId, input.guardianId), eq(studentGuardians.hasLegalResponsibility, true))).limit(1);
    if (!legalLink) throw new SchoolConsentError("A legal-responsibility link is required for SMS preferences.");
    const [existing] = await tx.select().from(guardianConsents).where(and(eq(guardianConsents.organizationId, input.schoolId),
      eq(guardianConsents.guardianId, input.guardianId))).for("update");
    const now = new Date();
    const fields = { optInSmsAnnouncements: input.announcements, optInSmsAttendance: input.attendance,
      smsConfirmedAt: now, phone: guardian.phone ?? "", updatedAt: now };
    const [saved] = existing ? await tx.update(guardianConsents).set(fields).where(eq(guardianConsents.id, existing.id)).returning({ id: guardianConsents.id }) :
      await tx.insert(guardianConsents).values({ ...fields, organizationId: input.schoolId, guardianId: input.guardianId })
        .returning({ id: guardianConsents.id });
    await logAuditEvent({ organizationId: input.schoolId, actorUserId: account.userId,
      action: "guardian.sms_preferences_confirmed", entityType: "guardian_consent", entityId: saved.id,
      metadata: { guardianId: input.guardianId, announcements: input.announcements, attendance: input.attendance } }, tx);
    return { confirmedAt: now };
  });
}
