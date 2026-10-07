import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendanceRecords, attendanceSessions, auditEvents, classes, classTimetablePeriods, courtRestrictions, enrollments, gradeLevels, guardians, needToKnowAlerts, organizationMemberships,
  organizations, reportCards, reportCardSubjectGrades, studentBehaviours, studentGuardians, students, subjects, teacherClassAssignments, terms, users,
  guardianConsents, guardianAbsenceNotes } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { formatPeriodLabel, type TimetablePeriodItem } from "@/lib/timetable-service";

export async function getSchoolAdminData(mvp = false) {
  const actor = await requireStaff(["school_admin"]);
  const org = actor.organizationId;
  const [school] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, timezone: organizations.timezone })
    .from(organizations).where(eq(organizations.id, org)).limit(1);
  if (!school) throw new Error("School not found.");
  const [studentRows, guardianRows, links, staff, classRows, assignments, grades, years, termRows, subjectRows, enrollmentRows, audit, attendanceSummary, publishedReports, activeAlerts, activeRestrictions] = await Promise.all([
    db.select().from(students).where(eq(students.organizationId, org)).orderBy(students.lastName, students.firstName),
    db.select().from(guardians).where(eq(guardians.organizationId, org)).orderBy(guardians.lastName, guardians.firstName),
    db.select().from(studentGuardians).where(eq(studentGuardians.organizationId, org)),
    db.select({ id: organizationMemberships.id, userId: users.id, name: users.name, username: users.username,
      role: organizationMemberships.role, mustChangePassword: users.mustChangePassword, twoFactorEnabled: users.twoFactorEnabled,
      joinedAt: organizationMemberships.createdAt })
      .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(eq(organizationMemberships.organizationId, org)).orderBy(users.name),
    db.select().from(classes).where(eq(classes.organizationId, org)).orderBy(classes.name),
    db.select({ id: teacherClassAssignments.id, classId: teacherClassAssignments.classId,
      subjectId: teacherClassAssignments.subjectId, teacherId: teacherClassAssignments.teacherId })
      .from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.isPrimaryHomeroom, false))),
    db.select().from(gradeLevels).where(eq(gradeLevels.organizationId, org)).orderBy(gradeLevels.position, gradeLevels.name),
    db.select().from(academicYears).where(eq(academicYears.organizationId, org)).orderBy(desc(academicYears.startsOn)),
    db.select().from(terms).where(eq(terms.organizationId, org)).orderBy(terms.position),
    db.select().from(subjects).where(eq(subjects.organizationId, org)).orderBy(subjects.name),
    db.select().from(enrollments).where(eq(enrollments.organizationId, org)),
    db.select({ id: auditEvents.id, action: auditEvents.action, entityType: auditEvents.entityType, entityId: auditEvents.entityId,
      actorName: users.name, createdAt: auditEvents.createdAt }).from(auditEvents)
      .leftJoin(users, eq(users.id, auditEvents.actorUserId)).where(and(eq(auditEvents.organizationId, org)))
      .orderBy(desc(auditEvents.createdAt)).limit(100),
    db.select({ studentId: attendanceRecords.studentId, total: count(),
      firstDate: sql<string>`min(${attendanceSessions.sessionDate})`,
      lastDate: sql<string>`max(${attendanceSessions.sessionDate})`,
      attended: sql<number>`count(*) filter (where ${attendanceRecords.status} in ('present', 'late'))`,
      absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')` })
      .from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceSessions.status, ["submitted", "locked"])))
      .groupBy(attendanceRecords.studentId),
    db.select({ id: reportCards.id, studentId: reportCards.studentId, termId: reportCards.termId, version: reportCards.version,
      gpa: reportCards.gpa, overallPercentage: reportCards.overallPercentage, attendanceRate: reportCards.attendanceRate, teacherRemarks: reportCards.teacherRemarks, publishedAt: reportCards.publishedAt, createdAt: reportCards.createdAt })
      .from(reportCards).where(and(eq(reportCards.organizationId, org), eq(reportCards.status, "published"))).orderBy(desc(reportCards.createdAt)),
    db.select({ studentId: needToKnowAlerts.studentId, category: needToKnowAlerts.category, severity: needToKnowAlerts.severity,
      expiresAt: needToKnowAlerts.expiresAt }).from(needToKnowAlerts)
      .where(and(eq(needToKnowAlerts.organizationId, org), eq(needToKnowAlerts.isActive, true))),
    db.select({ studentId: courtRestrictions.studentId, prohibitPickup: courtRestrictions.prohibitPickup,
      prohibitDisclosure: courtRestrictions.prohibitDisclosure, effectiveDate: courtRestrictions.effectiveDate, expirationDate: courtRestrictions.expirationDate })
      .from(courtRestrictions).where(and(eq(courtRestrictions.organizationId, org), eq(courtRestrictions.isEnforced, true))),
  ]);
  const publishedReportIds = publishedReports.map((r) => r.id);
  const [reportSubjects, behaviours, absenceNotes, timetableRows] = await Promise.all([
    publishedReportIds.length
      ? db.select().from(reportCardSubjectGrades).where(and(eq(reportCardSubjectGrades.organizationId, org), inArray(reportCardSubjectGrades.reportCardId, publishedReportIds)))
      : Promise.resolve([]),
    db.select().from(studentBehaviours).where(and(eq(studentBehaviours.organizationId, org), sql`${!mvp}`)).orderBy(desc(studentBehaviours.occurredAt), desc(studentBehaviours.createdAt)).limit(500),
    db.select({ id: guardianAbsenceNotes.id, studentId: guardianAbsenceNotes.studentId,
      absenceDate: guardianAbsenceNotes.absenceDate, reasonCategory: guardianAbsenceNotes.reasonCategory,
      status: guardianAbsenceNotes.status, createdAt: guardianAbsenceNotes.createdAt })
      .from(guardianAbsenceNotes).where(and(eq(guardianAbsenceNotes.organizationId, org), sql`${!mvp}`))
      .orderBy(desc(guardianAbsenceNotes.createdAt)).limit(100),
    db.select({
      id: classTimetablePeriods.id,
      classId: classTimetablePeriods.classId,
      dayOfWeek: classTimetablePeriods.dayOfWeek,
      period: classTimetablePeriods.period,
      startTime: classTimetablePeriods.startTime,
      endTime: classTimetablePeriods.endTime,
      subjectId: classTimetablePeriods.subjectId,
      teacherId: classTimetablePeriods.teacherId,
      room: classTimetablePeriods.room,
      building: classTimetablePeriods.building,
    }).from(classTimetablePeriods).where(and(eq(classTimetablePeriods.organizationId, org), sql`${!mvp}`))
      .orderBy(asc(classTimetablePeriods.startTime)),
  ]);
  const timetable: TimetablePeriodItem[] = timetableRows.map((row) => {
    const subject = subjectRows.find((s) => s.id === row.subjectId);
    const teacher = staff.find((st) => st.userId === row.teacherId);
    const klass = classRows.find((c) => c.id === row.classId);
    return {
      ...row,
      className: klass?.name,
      periodLabel: formatPeriodLabel(row.period),
      subjectName: subject?.name,
      subjectCode: subject?.code,
      teacherName: teacher?.name,
    };
  });
  const smsPreferences = await db.select({ guardianId: guardianConsents.guardianId,
    announcements: guardianConsents.optInSmsAnnouncements }).from(guardianConsents)
    .where(and(eq(guardianConsents.organizationId, org), sql`${!mvp}`));
  return { school, actor, students: studentRows, guardians: guardianRows, smsPreferences, links, staff, classes: classRows, assignments,
    grades, years, terms: termRows, subjects: subjectRows, enrollments: enrollmentRows, audit, absenceNotes,
    attendanceSummary, publishedReports, reportSubjects, behaviours, timetable, activeAlerts: activeAlerts.filter(alert => !alert.expiresAt || alert.expiresAt > new Date()),
    activeRestrictions: activeRestrictions.filter(restriction => restriction.effectiveDate <= new Date().toISOString().slice(0, 10) &&
      (!restriction.expirationDate || restriction.expirationDate >= new Date().toISOString().slice(0, 10))) };
}

export type SchoolAdminData = Awaited<ReturnType<typeof getSchoolAdminData>>;
