import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, classes, enrollments, gradeLevels, organizations, students } from "@/db/schema";
import { validateStudentCsv } from "@/lib/csv";
import { logAuditEvent } from "@/lib/audit";
import { SchoolAdminError } from "@/lib/school-admin-policy";
import type { requireStaff } from "@/lib/action-access";

type Actor = Awaited<ReturnType<typeof requireStaff>>;

export async function importSchoolStudents(actor: Actor, csvText: string) {
  if (actor.role !== "school_admin" && actor.role !== "office_staff") throw new SchoolAdminError("School office access required.");
  if (typeof csvText !== "string" || Buffer.byteLength(csvText, "utf8") > 2_000_000) throw new SchoolAdminError("Choose a CSV file smaller than 2 MB.");
  const validation = validateStudentCsv(csvText);
  if (!validation.isValid || validation.validRecords.length > 1000) throw new SchoolAdminError(
    validation.missingHeaders.length ? `Missing headers: ${validation.missingHeaders.join(", ")}.` :
    validation.invalidRecords.length ? `Fix ${validation.invalidRecords.length} invalid rows before importing.` : "Import up to 1,000 valid students at a time.");
  const numbers = validation.validRecords.map(row => row.studentNumber.toLowerCase());
  if (new Set(numbers).size !== numbers.length) throw new SchoolAdminError("The file contains duplicate student numbers.");
  const org = actor.organizationId;
  return db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update");
    if (!school) throw new SchoolAdminError("School not found.");
    const [year] = await tx.select().from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true)));
    if (!year) throw new SchoolAdminError("Set a current academic year first.");
    const [grades, classRows, existing] = await Promise.all([
      tx.select().from(gradeLevels).where(eq(gradeLevels.organizationId, org)),
      tx.select().from(classes).where(and(eq(classes.organizationId, org), eq(classes.academicYearId, year.id))),
      tx.select({ studentNumber: students.studentNumber }).from(students).where(and(eq(students.organizationId, org), inArray(students.studentNumber, validation.validRecords.map(row => row.studentNumber)))),
    ]);
    if (existing.length) throw new SchoolAdminError(`Student number ${existing[0].studentNumber} already exists.`);
    const placement = validation.validRecords.map((row, index) => {
      const grade = grades.find(item => item.name.toLowerCase() === row.gradeLevel.toLowerCase());
      const schoolClass = classRows.find(item => item.gradeLevelId === grade?.id && item.name.toLowerCase() === row.className.toLowerCase());
      if (!schoolClass) throw new SchoolAdminError(`Row ${index + 2}: create class ${row.className} in ${row.gradeLevel} before importing.`);
      return { row, classId: schoolClass.id };
    });
    const inserted = await tx.insert(students).values(placement.map(({ row }) => ({ organizationId: org, studentNumber: row.studentNumber,
      firstName: row.firstName, middleName: row.middleName ?? null, lastName: row.lastName,
      preferredName: row.preferredName ?? null, dateOfBirth: row.dateOfBirth, status: "active" as const }))).returning({ id: students.id });
    await tx.insert(enrollments).values(inserted.map((student, index) => ({ organizationId: org, studentId: student.id,
      academicYearId: year.id, classId: placement[index].classId, status: "active" as const, startsOn: new Date().toISOString().slice(0, 10) })));
    await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: "import.executed", entityType: "student_import",
      entityId: year.id, metadata: { rowCount: inserted.length } }, tx);
    return { count: inserted.length };
  });
}
