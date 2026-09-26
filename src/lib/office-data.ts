import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendanceRecords, attendanceSessions, classes, courtRestrictions, enrollments,
  gradeLevels, guardianAbsenceNotes, guardians, organizations, receptionLogs, smsDispatches, studentGuardians, students, users,
  needToKnowAlerts, sensitiveCases } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { buildUnexplainedAbsenceCallList } from "@/lib/office-absence-followup";
import { buildTeacherSafetyNotices } from "@/lib/teacher-safety";

export async function getOfficeData(sessionDate: string) {
  const actor = await requireStaff(["office_staff"]);
  const org = actor.organizationId;
  const [school, years, grades, classRows, studentRows, guardianRows, links, enrollmentRows, sessionRows, restrictions, absenceNotes, dateNotes, receptionLogRows, dispatchRows] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug }).from(organizations).where(eq(organizations.id, org)).then(rows => rows[0]),
    db.select().from(academicYears).where(eq(academicYears.organizationId, org)),
    db.select().from(gradeLevels).where(eq(gradeLevels.organizationId, org)).orderBy(gradeLevels.position),
    db.select().from(classes).where(eq(classes.organizationId, org)).orderBy(classes.name),
    db.select().from(students).where(eq(students.organizationId, org)).orderBy(students.lastName, students.firstName),
    db.select().from(guardians).where(eq(guardians.organizationId, org)).orderBy(guardians.lastName, guardians.firstName),
    db.select().from(studentGuardians).where(eq(studentGuardians.organizationId, org)),
    db.select().from(enrollments).where(eq(enrollments.organizationId, org)),
    db.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), eq(attendanceSessions.sessionDate, sessionDate))),
    db.select({ id: courtRestrictions.id, studentId: courtRestrictions.studentId,
      prohibitPickup: courtRestrictions.prohibitPickup, prohibitDisclosure: courtRestrictions.prohibitDisclosure,
      effectiveDate: courtRestrictions.effectiveDate, expirationDate: courtRestrictions.expirationDate, isEnforced: courtRestrictions.isEnforced,
      restrictedPersonName: courtRestrictions.restrictedPersonName, docketNumber: courtRestrictions.docketNumber })
      .from(courtRestrictions).where(eq(courtRestrictions.organizationId, org)),
    db.select({ id: guardianAbsenceNotes.id, studentId: guardianAbsenceNotes.studentId, guardianId: guardianAbsenceNotes.guardianId,
      absenceDate: guardianAbsenceNotes.absenceDate, reasonCategory: guardianAbsenceNotes.reasonCategory, status: guardianAbsenceNotes.status,
      createdAt: guardianAbsenceNotes.createdAt, reviewedAt: guardianAbsenceNotes.reviewedAt, guardianName: guardians.firstName,
      guardianLastName: guardians.lastName, reviewerName: users.name })
      .from(guardianAbsenceNotes).innerJoin(guardians, eq(guardianAbsenceNotes.guardianId, guardians.id))
      .leftJoin(users, eq(guardianAbsenceNotes.reviewedBy, users.id)).where(eq(guardianAbsenceNotes.organizationId, org))
      .orderBy(desc(guardianAbsenceNotes.createdAt)).limit(200),
    db.select({ studentId: guardianAbsenceNotes.studentId, absenceDate: guardianAbsenceNotes.absenceDate })
      .from(guardianAbsenceNotes).where(and(eq(guardianAbsenceNotes.organizationId, org), eq(guardianAbsenceNotes.absenceDate, sessionDate))),
    db.select().from(receptionLogs)
      .where(and(eq(receptionLogs.organizationId, org), eq(receptionLogs.logDate, sessionDate)))
      .orderBy(desc(receptionLogs.createdAt)),
    db.select().from(smsDispatches)
      .where(eq(smsDispatches.organizationId, org))
      .orderBy(desc(smsDispatches.sentAt))
      .limit(50),
  ]);
  if (!school) throw new Error("School not found.");
  const sessionIds = sessionRows.map(row => row.id);
  const records = sessionIds.length ? await db.select().from(attendanceRecords)
    .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessionIds))) : [];
  const unexplainedAbsences = buildUnexplainedAbsenceCallList(sessionRows, records, dateNotes, links, guardianRows);
  const medicalRows = await db.select({ id: needToKnowAlerts.id, studentId: needToKnowAlerts.studentId,
    category: needToKnowAlerts.category, severity: needToKnowAlerts.severity,
    directiveSummary: needToKnowAlerts.directiveSummary, actionRequired: needToKnowAlerts.actionRequired,
    isActive: needToKnowAlerts.isActive, expiresAt: needToKnowAlerts.expiresAt })
    .from(needToKnowAlerts).innerJoin(sensitiveCases, and(eq(sensitiveCases.id, needToKnowAlerts.caseId),
      eq(sensitiveCases.organizationId, org))).where(and(eq(needToKnowAlerts.organizationId, org),
      eq(sensitiveCases.area, "health_medical"), eq(needToKnowAlerts.isActive, true)));
  const medicalAlerts = buildTeacherSafetyNotices(studentRows.map(row => row.id), medicalRows, []).alerts;
  return { actor, school, years, grades, classes: classRows, students: studentRows, guardians: guardianRows,
    links, enrollments: enrollmentRows, sessions: sessionRows, records, restrictions, absenceNotes,
    unexplainedAbsences, medicalAlerts, receptionLogs: receptionLogRows, dispatches: dispatchRows };
}

export type OfficeData = Awaited<ReturnType<typeof getOfficeData>>;
