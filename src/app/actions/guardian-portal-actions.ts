"use server";

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { accounts, guardianAbsenceNotes, guardians, organizations, studentGuardians, students, users } from "@/db/schema";
import { requireGuardian, requireStaff } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";
import { loginUsername, usernameSchema } from "@/lib/login-identity";
import { SchoolConsentError, updateGuardianSchoolConsent, type SchoolConsentInput } from "@/lib/guardian-school-consent-service";

const provisionSchema = z.object({ guardianId: z.uuid(), username: usernameSchema, temporaryPassword: z.string().min(12).max(128) });
class GuardianPortalError extends Error {}
const absenceNoteSchema = z.object({ studentId: z.uuid(), absenceDate: z.iso.date(), reasonCategory: z.enum(["illness", "appointment", "family", "other"]) });

export async function provisionGuardianPortalAccountAction(raw: z.input<typeof provisionSchema>) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const input = provisionSchema.parse(raw);
    const result = await db.transaction(async tx => {
      const [school] = await tx.select().from(organizations).where(eq(organizations.id, actor.organizationId)).for("update");
      if (!school) throw new GuardianPortalError("School not found.");
      const [guardian] = await tx.select().from(guardians).where(and(eq(guardians.id, input.guardianId),
        eq(guardians.organizationId, actor.organizationId))).for("update");
      if (!guardian) throw new GuardianPortalError("Guardian contact was not found in this school.");
      if (guardian.userId) throw new GuardianPortalError("This guardian already has a portal account.");
      const [authorizedLink] = await tx.select({ studentId: studentGuardians.studentId }).from(studentGuardians)
        .innerJoin(students, and(eq(students.id, studentGuardians.studentId), eq(students.organizationId, studentGuardians.organizationId)))
        .where(and(eq(studentGuardians.organizationId, actor.organizationId), eq(studentGuardians.guardianId, guardian.id), eq(studentGuardians.hasLegalResponsibility, true))).limit(1);
      if (!authorizedLink) throw new GuardianPortalError("Link this guardian to a student with legal responsibility before enabling portal access.");
      const username = loginUsername(school.slug, input.username);
      const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
      if (existing) throw new GuardianPortalError("That username is already in use. Choose another.");
      const userId = randomUUID();
      await tx.insert(users).values({ id: userId, name: `${guardian.firstName} ${guardian.lastName}`,
        email: `${userId}@accounts.klasso.invalid`, emailVerified: false, username, displayUsername: input.username,
        organizationId: school.id, role: null, mustChangePassword: true });
      await tx.insert(accounts).values({ id: randomUUID(), userId, accountId: userId, providerId: "credential",
        password: await hashPassword(input.temporaryPassword) });
      await tx.update(guardians).set({ userId, updatedAt: new Date() }).where(and(eq(guardians.id, guardian.id), eq(guardians.organizationId, school.id)));
      await logAuditEvent({ organizationId: school.id, actorUserId: actor.userId, action: "guardian.portal_account_provisioned",
        entityType: "guardian", entityId: guardian.id, metadata: { accountId: userId } }, tx);
      return { tenantId: school.slug, username: input.username };
    });
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the account details." };
    if (error instanceof GuardianPortalError) return { success: false as const, error: error.message };
    return { success: false as const, error: "The portal account could not be created. Check that the username is available and try again." };
  }
}

export async function submitGuardianAbsenceNoteAction(raw: z.input<typeof absenceNoteSchema>) {
  const guardian = await requireGuardian();
  try {
    const input = absenceNoteSchema.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    const earliest = new Date(); earliest.setUTCDate(earliest.getUTCDate() - 30);
    const latest = new Date(); latest.setUTCDate(latest.getUTCDate() + 90);
    if (input.absenceDate < earliest.toISOString().slice(0, 10) || input.absenceDate > latest.toISOString().slice(0, 10)) {
      throw new GuardianPortalError("Choose a date within the past 30 days or next 90 days.");
    }
    const note = await db.transaction(async tx => {
      const authorizedLinks = await tx.select({ guardianId: studentGuardians.guardianId, organizationId: studentGuardians.organizationId })
        .from(studentGuardians).innerJoin(students, and(eq(students.id, studentGuardians.studentId), eq(students.organizationId, studentGuardians.organizationId)))
        .where(and(inArray(studentGuardians.guardianId, guardian.guardians.map(item => item.id)),
          inArray(studentGuardians.organizationId, guardian.guardians.map(item => item.organizationId)),
          eq(studentGuardians.studentId, input.studentId), eq(studentGuardians.hasLegalResponsibility, true)));
      const link = authorizedLinks.find(item => guardian.guardians.some(profile => profile.id === item.guardianId && profile.organizationId === item.organizationId));
      if (!link) throw new GuardianPortalError("You do not have permission to submit a note for this student.");
      const [duplicate] = await tx.select({ id: guardianAbsenceNotes.id }).from(guardianAbsenceNotes)
        .where(and(eq(guardianAbsenceNotes.organizationId, link.organizationId), eq(guardianAbsenceNotes.guardianId, link.guardianId),
          eq(guardianAbsenceNotes.studentId, input.studentId), eq(guardianAbsenceNotes.absenceDate, input.absenceDate), eq(guardianAbsenceNotes.status, "submitted"))).limit(1);
      if (duplicate) throw new GuardianPortalError("You have already submitted a note for this student and date.");
      const [created] = await tx.insert(guardianAbsenceNotes).values({ organizationId: link.organizationId, guardianId: link.guardianId,
        studentId: input.studentId, absenceDate: input.absenceDate, reasonCategory: input.reasonCategory })
        .returning({ id: guardianAbsenceNotes.id });
      await logAuditEvent({ organizationId: link.organizationId, actorUserId: guardian.userId, action: "guardian.absence_note_submitted",
        entityType: "guardian_absence_note", entityId: created.id, metadata: { studentId: input.studentId, absenceDate: input.absenceDate } }, tx);
      return created;
    });
    revalidatePath("/");
    return { success: true as const, noteId: note.id, submittedDate: today };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the note." };
    if (error instanceof GuardianPortalError) return { success: false as const, error: error.message };
    return { success: false as const, error: "The absence note could not be submitted. Refresh and try again." };
  }
}

export async function updateGuardianSchoolConsentAction(input: SchoolConsentInput) {
  const account = await requireGuardian();
  try {
    const result = await updateGuardianSchoolConsent(account, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the consent choice." };
    if (error instanceof SchoolConsentError) return { success: false as const, error: error.message };
    return { success: false as const, error: "The consent choice could not be saved. Refresh and try again." };
  }
}
