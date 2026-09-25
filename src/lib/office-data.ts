import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendanceRecords, attendanceSessions, classes, courtRestrictions, enrollments,
  gradeLevels, guardians, organizations, studentGuardians, students } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

export async function getOfficeData(sessionDate: string) {
  const actor = await requireStaff(["office_staff"]);
  const org = actor.organizationId;
  const [school, years, grades, classRows, studentRows, guardianRows, links, enrollmentRows, sessionRows, restrictions] = await Promise.all([
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
      effectiveDate: courtRestrictions.effectiveDate, expirationDate: courtRestrictions.expirationDate, isEnforced: courtRestrictions.isEnforced })
      .from(courtRestrictions).where(eq(courtRestrictions.organizationId, org)),
  ]);
  if (!school) throw new Error("School not found.");
  const sessionIds = sessionRows.map(row => row.id);
  const records = sessionIds.length ? await db.select().from(attendanceRecords)
    .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessionIds))) : [];
  return { actor, school, years, grades, classes: classRows, students: studentRows, guardians: guardianRows,
    links, enrollments: enrollmentRows, sessions: sessionRows, records, restrictions };
}

export type OfficeData = Awaited<ReturnType<typeof getOfficeData>>;
