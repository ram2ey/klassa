import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { attendanceCorrections, attendanceRecords, attendanceSessions, guardianAbsenceNotes } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";
import { SchoolAdminError } from "@/lib/school-admin-policy";

type Actor = Awaited<ReturnType<typeof requireStaff>>;

export async function reviewAndExcuseGuardianAbsence(actor: Actor, rawNoteId: string) {
  if (actor.role !== "office_staff") throw new SchoolAdminError("Office staff access required.");
  const noteId = z.uuid().parse(rawNoteId);
  const org = actor.organizationId;
  return db.transaction(async tx => {
    const [note] = await tx.select().from(guardianAbsenceNotes).where(and(
      eq(guardianAbsenceNotes.id, noteId), eq(guardianAbsenceNotes.organizationId, org))).for("update");
    if (!note) throw new SchoolAdminError("This absence note was not found in your school.");
    if (note.status !== "submitted") throw new SchoolAdminError("This absence note has already been reviewed.");

    const sessions = await tx.select({ id: attendanceSessions.id }).from(attendanceSessions).where(and(
      eq(attendanceSessions.organizationId, org), eq(attendanceSessions.sessionDate, note.absenceDate),
      eq(attendanceSessions.period, "morning_roll_call"), eq(attendanceSessions.status, "submitted")));
    if (!sessions.length) throw new SchoolAdminError("No submitted morning roll call exists for this date.");
    const records = await tx.select({ id: attendanceRecords.id, status: attendanceRecords.status })
      .from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org),
        eq(attendanceRecords.studentId, note.studentId), inArray(attendanceRecords.sessionId, sessions.map(session => session.id))))
      .for("update");
    if (records.length !== 1 || records[0].status !== "absent") {
      throw new SchoolAdminError("This note needs a single absent morning mark before it can be excused.");
    }
    const record = records[0];
    const reason = `Guardian absence note ${note.id}: ${note.reasonCategory.replaceAll("_", " ")}`;
    await tx.insert(attendanceCorrections).values({ organizationId: org, attendanceRecordId: record.id,
      studentId: note.studentId, previousStatus: "absent", newStatus: "excused", reason, correctedBy: actor.userId });
    const now = new Date();
    await tx.update(attendanceRecords).set({ status: "excused", reason: `Guardian note: ${note.reasonCategory.replaceAll("_", " ")}`,
      updatedAt: now }).where(and(eq(attendanceRecords.id, record.id), eq(attendanceRecords.organizationId, org),
        eq(attendanceRecords.status, "absent")));
    await tx.update(guardianAbsenceNotes).set({ status: "reviewed", reviewedBy: actor.userId,
      reviewedAt: now, updatedAt: now }).where(and(eq(guardianAbsenceNotes.id, note.id), eq(guardianAbsenceNotes.organizationId, org)));
    await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: "guardian.absence_note_excused",
      entityType: "guardian_absence_note", entityId: note.id,
      metadata: { studentId: note.studentId, absenceDate: note.absenceDate, attendanceRecordId: record.id } }, tx);
    return { noteId: note.id, attendanceRecordId: record.id };
  });
}
