import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendanceRecords, attendanceSessions, classSubjects, classes, courtRestrictions, enrollments,
  feeDefinitions, feeEntries, feePayments, organizations, reportCards, students, subjects, teacherClassAssignments, termMarks, terms } from "@/db/schema";
import type { requireStaff } from "./action-access";
import { accountBalance } from "./mvp-policy";

export async function getMvpData(actor: Awaited<ReturnType<typeof requireStaff>>, section: string, date: string) {
  const org = actor.organizationId;
  const teacher = actor.role === "teacher";
  const finance = !teacher && ["overview", "fees"].includes(section);
  const [school, years, allClasses, allSubjects, assignments] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug }).from(organizations).where(eq(organizations.id, org)).then(r => r[0]),
    db.select().from(academicYears).where(eq(academicYears.organizationId, org)).orderBy(desc(academicYears.startsOn)),
    db.select().from(classes).where(eq(classes.organizationId, org)).orderBy(asc(classes.name)),
    db.select().from(subjects).where(eq(subjects.organizationId, org)).orderBy(asc(subjects.name)),
    teacher ? db.select().from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.teacherId, actor.userId))) : Promise.resolve([]),
  ]);
  if (!school) throw new Error("School not found.");
  const currentYear = years.find(y => y.isCurrent);
  const classRows = allClasses.filter(c => c.academicYearId === currentYear?.id && (!teacher || c.homeroomTeacherId === actor.userId || assignments.some(a => a.classId === c.id)));
  const homeroomIds = classRows.filter(c => !teacher || c.homeroomTeacherId === actor.userId || assignments.some(a => a.classId === c.id && a.isPrimaryHomeroom)).map(c => c.id);
  const classIds = classRows.map(c => c.id);
  const [termRows, offered, pupilRows, sessionRows, marks, reports, definitions, entries, payments] = await Promise.all([
    currentYear ? db.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.academicYearId, currentYear.id))).orderBy(asc(terms.position)) : Promise.resolve([]),
    classIds.length ? db.select().from(classSubjects).where(and(eq(classSubjects.organizationId, org), inArray(classSubjects.classId, classIds))) : Promise.resolve([]),
    teacher ? classIds.length ? db.select({ id: students.id, studentNumber: students.studentNumber, firstName: students.firstName, lastName: students.lastName, status: students.status, classId: enrollments.classId })
      .from(students).innerJoin(enrollments, eq(enrollments.studentId, students.id)).where(and(eq(students.organizationId, org), eq(enrollments.organizationId, org), eq(enrollments.academicYearId, currentYear!.id), inArray(enrollments.classId, classIds)))
      .orderBy(students.lastName, students.firstName) : Promise.resolve([])
      : db.select({ id: students.id, studentNumber: students.studentNumber, firstName: students.firstName, lastName: students.lastName, status: students.status, classId: enrollments.classId }).from(students)
        .leftJoin(enrollments, and(eq(enrollments.studentId, students.id), eq(enrollments.organizationId, org), eq(enrollments.academicYearId, currentYear?.id ?? "00000000-0000-0000-0000-000000000000")))
        .where(eq(students.organizationId, org)).orderBy(students.lastName, students.firstName),
    classIds.length ? db.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), inArray(attendanceSessions.classId, classIds), eq(attendanceSessions.sessionDate, date), eq(attendanceSessions.period, "morning_roll_call"))) : Promise.resolve([]),
    classIds.length && ["marks", "overview"].includes(section) ? db.select().from(termMarks).where(and(eq(termMarks.organizationId, org), inArray(termMarks.classId, classIds))) : Promise.resolve([]),
    homeroomIds.length && ["marks", "overview"].includes(section) ? db.select().from(reportCards).where(and(eq(reportCards.organizationId, org), inArray(reportCards.classId, homeroomIds))).orderBy(desc(reportCards.version)) : Promise.resolve([]),
    finance ? db.select().from(feeDefinitions).where(eq(feeDefinitions.organizationId, org)).orderBy(feeDefinitions.name) : Promise.resolve([]),
    finance ? db.select().from(feeEntries).where(eq(feeEntries.organizationId, org)).orderBy(feeEntries.createdAt) : Promise.resolve([]),
    finance ? db.select().from(feePayments).where(eq(feePayments.organizationId, org)).orderBy(desc(feePayments.createdAt)) : Promise.resolve([]),
  ]);
  const records = sessionRows.length ? await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessionRows.map(s => s.id)))) : [];
  const visibleMarks = marks.filter(m => !teacher || homeroomIds.includes(m.classId) || assignments.some(a => a.classId === m.classId && a.subjectId === m.subjectId));
  const visibleOffered = offered.filter(o => !teacher || homeroomIds.includes(o.classId) || assignments.some(a => a.classId === o.classId && a.subjectId === o.subjectId));
  const subjectRows = teacher ? allSubjects.filter(s => visibleOffered.some(o => o.subjectId === s.id)) : allSubjects;
  const balances = finance ? pupilRows.map(p => ({ studentId: p.id, amountPesewas: accountBalance(entries.filter(e => e.studentId === p.id), payments.filter(e => e.studentId === p.id)) })) : [];
  const today = new Date().toISOString().slice(0, 10);
  const restrictions = pupilRows.length ? await db.select({ studentId: courtRestrictions.studentId, prohibitPickup: courtRestrictions.prohibitPickup, prohibitDisclosure: courtRestrictions.prohibitDisclosure })
    .from(courtRestrictions).where(and(eq(courtRestrictions.organizationId, org), eq(courtRestrictions.isEnforced, true), inArray(courtRestrictions.studentId, pupilRows.map(p => p.id)),
      sql`${courtRestrictions.effectiveDate} <= ${today} AND (${courtRestrictions.expirationDate} IS NULL OR ${courtRestrictions.expirationDate} >= ${today})`)) : [];
  return { school, actor, currentYear, classes: classRows, terms: termRows, subjects: subjectRows, classSubjects: visibleOffered,
    homeroomIds, pupils: pupilRows, sessions: sessionRows, records, marks: visibleMarks, reports, definitions, entries, payments, balances, restrictions };
}
export type MvpData = Awaited<ReturnType<typeof getMvpData>>;
