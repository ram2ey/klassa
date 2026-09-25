import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, assessmentCategories, assessmentGrades, assessments, attendanceRecords, attendanceSessions,
  classes, enrollments, gradeLevels, organizations, reportCards, reportCardSubjectGrades, students, subjects,
  teacherClassAssignments, terms } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

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
  const termRows = currentYear ? await db.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.academicYearId, currentYear.id))) : [];
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
  const reportIds = reportRows.map(row => row.id);
  const reportSubjects = reportIds.length ? await db.select().from(reportCardSubjectGrades)
    .where(and(eq(reportCardSubjectGrades.organizationId, org), inArray(reportCardSubjectGrades.reportCardId, reportIds))) : [];
  const sessionRows = homeIds.length && section === "attendance" ? await db.select().from(attendanceSessions)
    .where(and(eq(attendanceSessions.organizationId, org), inArray(attendanceSessions.classId, homeIds), eq(attendanceSessions.sessionDate, sessionDate))) : [];
  const sessionIds = sessionRows.map(row => row.id);
  const recordRows = sessionIds.length ? await db.select().from(attendanceRecords)
    .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessionIds))) : [];
  return { actor, school, currentYear, classes: classRows, assignments, homeroomClassIds: homeIds, gradeLevels: gradeLevelsRows,
    subjects: subjectsRows, terms: termRows, enrollments: enrollmentRows, students: studentRows,
    assessments: permittedAssessments, grades: gradeRows, categories: categoryRows, reports: reportRows, reportSubjects,
    sessions: sessionRows, records: recordRows };
}

export type TeacherData = Awaited<ReturnType<typeof getTeacherData>>;
