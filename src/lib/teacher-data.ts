import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, assessmentCategories, assessmentGrades, assessments, attendanceRecords, attendanceSessions,
  classes, enrollments, gradeLevels, organizations, reportCards, reportCardSubjectGrades, students, subjects,
  teacherClassAssignments, terms, needToKnowAlerts, courtRestrictions, guardians, studentGuardians,
  guardianAbsenceNotes, studentBehaviours } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { buildTeacherSafetyNotices } from "@/lib/teacher-safety";

export async function getTeacherData(section: string, sessionDate: string) {
  const actor = await requireStaff(["teacher"]);
  const org = actor.organizationId;
  const [school, years, allClasses, assignments, gradeLevelsRows, subjectsRows] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug }).from(organizations).where(eq(organizations.id, org)).then(rows => rows[0]),
    db.select().from(academicYears).where(eq(academicYears.organizationId, org)),
    db.select().from(classes).where(eq(classes.organizationId, org)),
    db.select().from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.teacherId, actor.userId))),
    db.select().from(gradeLevels).where(eq(gradeLevels.organizationId, org)),
    db.select().from(subjects).where(eq(subjects.organizationId, org)),
  ]);
  if (!school) throw new Error("School not found.");
  const currentYear = years.find(row => row.isCurrent);
  const assignedIds = new Set(assignments.map(row => row.classId));
  const classRows = allClasses.filter(row => row.academicYearId === currentYear?.id && (assignedIds.has(row.id) || row.homeroomTeacherId === actor.userId));
  const classIds = classRows.map(row => row.id);
  const homeroomIds = new Set(classRows.filter(row => row.homeroomTeacherId === actor.userId ||
    assignments.some(item => item.classId === row.id && item.isPrimaryHomeroom)).map(row => row.id));
  const enrollmentRows = classIds.length ? await db.select().from(enrollments).where(and(eq(enrollments.organizationId, org),
    inArray(enrollments.classId, classIds), eq(enrollments.academicYearId, currentYear!.id), eq(enrollments.status, "active"))) : [];
  const studentIds = [...new Set(enrollmentRows.map(row => row.studentId))];
  const studentRows = studentIds.length ? await db.select({ id: students.id, studentNumber: students.studentNumber,
    firstName: students.firstName, lastName: students.lastName, preferredName: students.preferredName, status: students.status })
    .from(students).where(and(eq(students.organizationId, org), inArray(students.id, studentIds))).orderBy(students.lastName, students.firstName) : [];
  const [alertRows, restrictionRows] = studentIds.length ? await Promise.all([
    db.select({ id: needToKnowAlerts.id, studentId: needToKnowAlerts.studentId, category: needToKnowAlerts.category,
      severity: needToKnowAlerts.severity, directiveSummary: needToKnowAlerts.directiveSummary,
      actionRequired: needToKnowAlerts.actionRequired, isActive: needToKnowAlerts.isActive, expiresAt: needToKnowAlerts.expiresAt })
      .from(needToKnowAlerts).where(and(eq(needToKnowAlerts.organizationId, org), inArray(needToKnowAlerts.studentId, studentIds), eq(needToKnowAlerts.isActive, true))),
    db.select({ studentId: courtRestrictions.studentId, prohibitPickup: courtRestrictions.prohibitPickup,
      isEnforced: courtRestrictions.isEnforced, effectiveDate: courtRestrictions.effectiveDate,
      expirationDate: courtRestrictions.expirationDate })
      .from(courtRestrictions).where(and(eq(courtRestrictions.organizationId, org), inArray(courtRestrictions.studentId, studentIds),
        eq(courtRestrictions.isEnforced, true), eq(courtRestrictions.prohibitPickup, true))),
  ]) : [[], []];
  const safety = buildTeacherSafetyNotices(studentIds, alertRows, restrictionRows);
  const [guardianLinks, guardianRows, absenceNotes, historySessions, publishedReports] = studentIds.length ? await Promise.all([
    db.select({ studentId: studentGuardians.studentId, guardianId: studentGuardians.guardianId,
      isPrimary: studentGuardians.isPrimary }).from(studentGuardians)
      .where(and(eq(studentGuardians.organizationId, org), inArray(studentGuardians.studentId, studentIds))),
    db.select({ id: guardians.id, firstName: guardians.firstName, lastName: guardians.lastName,
      phone: guardians.phone, email: guardians.email }).from(guardians).where(eq(guardians.organizationId, org)),
    section === "attendance" ? db.select({ id: guardianAbsenceNotes.id, studentId: guardianAbsenceNotes.studentId,
      absenceDate: guardianAbsenceNotes.absenceDate, reasonCategory: guardianAbsenceNotes.reasonCategory,
      status: guardianAbsenceNotes.status }).from(guardianAbsenceNotes).where(and(
      eq(guardianAbsenceNotes.organizationId, org), inArray(guardianAbsenceNotes.studentId, studentIds),
      eq(guardianAbsenceNotes.absenceDate, sessionDate))) : Promise.resolve([]),
    section === "classes" ? db.select({ id: attendanceSessions.id, sessionDate: attendanceSessions.sessionDate,
      classId: attendanceSessions.classId }).from(attendanceSessions).where(and(
      eq(attendanceSessions.organizationId, org), inArray(attendanceSessions.classId, classIds),
      eq(attendanceSessions.period, "morning_roll_call"), inArray(attendanceSessions.status, ["submitted", "locked"])))
      .orderBy(desc(attendanceSessions.sessionDate)).limit(300) : Promise.resolve([]),
    section === "classes" ? db.select({ id: reportCards.id, studentId: reportCards.studentId,
      termId: reportCards.termId, overallPercentage: reportCards.overallPercentage,
      gpa: reportCards.gpa, attendanceRate: reportCards.attendanceRate, version: reportCards.version,
      teacherRemarks: reportCards.teacherRemarks, publishedAt: reportCards.publishedAt }).from(reportCards).where(and(
      eq(reportCards.organizationId, org), inArray(reportCards.studentId, studentIds),
      eq(reportCards.status, "published"))).orderBy(desc(reportCards.publishedAt)).limit(200) : Promise.resolve([]),
  ]) : [[], [], [], [], []];
  const historyRecords = historySessions.length ? await db.select({ studentId: attendanceRecords.studentId,
    sessionId: attendanceRecords.sessionId, status: attendanceRecords.status }).from(attendanceRecords)
    .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, historySessions.map(row => row.id)),
      inArray(attendanceRecords.studentId, studentIds))) : [];
  const guardianContacts = guardianLinks.map(link => ({ studentId: link.studentId, isPrimary: link.isPrimary,
    guardian: guardianRows.find(row => row.id === link.guardianId) })).filter(link => !!link.guardian);
  const termRows = await db.select().from(terms).where(eq(terms.organizationId, org)).orderBy(terms.position);
  const assessmentRows = classIds.length && ["overview", "gradebook", "reports"].includes(section) ? await db.select().from(assessments)
    .where(and(eq(assessments.organizationId, org), inArray(assessments.classId, classIds))).orderBy(desc(assessments.dateDue)) : [];
  const permittedAssessments = assessmentRows.filter(row => homeroomIds.has(row.classId) ||
    assignments.some(item => item.classId === row.classId && item.subjectId === row.subjectId));
  const assessmentIds = permittedAssessments.map(row => row.id);
  const gradeRows = assessmentIds.length && section === "gradebook" ? await db.select().from(assessmentGrades)
    .where(and(eq(assessmentGrades.organizationId, org), inArray(assessmentGrades.assessmentId, assessmentIds))) : [];
  const categoryRows = currentYear && section === "gradebook" ? await db.select().from(assessmentCategories)
    .where(and(eq(assessmentCategories.organizationId, org), eq(assessmentCategories.academicYearId, currentYear.id))) : [];
  const homeIds = [...homeroomIds];
  const reportRows = homeIds.length && section === "reports" ? await db.select().from(reportCards)
    .where(and(eq(reportCards.organizationId, org), inArray(reportCards.classId, homeIds))).orderBy(desc(reportCards.createdAt)) : [];
  const relevantReportIds = section === "reports" ? reportRows.map(row => row.id) : section === "classes" ? publishedReports.map(row => row.id) : [];
  const reportSubjects = relevantReportIds.length ? await db.select().from(reportCardSubjectGrades)
    .where(and(eq(reportCardSubjectGrades.organizationId, org), inArray(reportCardSubjectGrades.reportCardId, relevantReportIds))) : [];
  const loadedSessions = classIds.length && section === "attendance" ? await db.select().from(attendanceSessions)
    .where(and(eq(attendanceSessions.organizationId, org), inArray(attendanceSessions.classId, classIds), eq(attendanceSessions.sessionDate, sessionDate))) : [];
  const sessionRows = loadedSessions.filter(row => row.period === "morning_roll_call" ? homeroomIds.has(row.classId) :
    homeroomIds.has(row.classId) || assignments.some(item => item.classId === row.classId && item.subjectId !== null));
  const sessionIds = sessionRows.map(row => row.id);
  const recordRows = sessionIds.length ? await db.select().from(attendanceRecords)
    .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessionIds))) : [];
  const behaviourRows = studentIds.length ? await db.select().from(studentBehaviours)
    .where(and(eq(studentBehaviours.organizationId, org), inArray(studentBehaviours.studentId, studentIds)))
    .orderBy(desc(studentBehaviours.occurredAt), desc(studentBehaviours.createdAt)).limit(150) : [];
  return { actor, school, currentYear, classes: classRows, assignments, homeroomClassIds: homeIds, gradeLevels: gradeLevelsRows,
    subjects: subjectsRows, terms: termRows, enrollments: enrollmentRows, students: studentRows,
    assessments: permittedAssessments, grades: gradeRows, categories: categoryRows, reports: reportRows, reportSubjects,
    sessions: sessionRows, records: recordRows, safety, guardianContacts, absenceNotes,
    historySessions, historyRecords, publishedReports, behaviours: behaviourRows };
}

export type TeacherData = Awaited<ReturnType<typeof getTeacherData>>;
