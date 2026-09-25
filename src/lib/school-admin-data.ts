import { and, count, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendanceRecords, attendanceSessions, auditEvents, classes, courtRestrictions, enrollments, gradeLevels, guardians, needToKnowAlerts, organizationMemberships,
  organizations, reportCards, studentGuardians, students, subjects, terms, users } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

export async function getSchoolAdminData() {
  const actor = await requireStaff(["school_admin"]);
  const org = actor.organizationId;
  const [school] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, timezone: organizations.timezone })
    .from(organizations).where(eq(organizations.id, org)).limit(1);
  if (!school) throw new Error("School not found.");
  const [studentRows, guardianRows, links, staff, classRows, grades, years, termRows, subjectRows, enrollmentRows, audit, attendanceSummary, publishedReports, activeAlerts, activeRestrictions] = await Promise.all([
    db.select().from(students).where(eq(students.organizationId, org)).orderBy(students.lastName, students.firstName),
    db.select().from(guardians).where(eq(guardians.organizationId, org)).orderBy(guardians.lastName, guardians.firstName),
    db.select().from(studentGuardians).where(eq(studentGuardians.organizationId, org)),
    db.select({ id: organizationMemberships.id, userId: users.id, name: users.name, username: users.username,
      role: organizationMemberships.role, mustChangePassword: users.mustChangePassword, twoFactorEnabled: users.twoFactorEnabled,
      joinedAt: organizationMemberships.createdAt })
      .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(eq(organizationMemberships.organizationId, org)).orderBy(users.name),
    db.select().from(classes).where(eq(classes.organizationId, org)).orderBy(classes.name),
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
      attended: sql<number>`count(*) filter (where ${attendanceRecords.status} in ('present', 'late'))`,
      absent: sql<number>`count(*) filter (where ${attendanceRecords.status} = 'absent')` })
      .from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceRecords.sessionId, attendanceSessions.id))
      .where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceSessions.status, ["submitted", "locked"])))
      .groupBy(attendanceRecords.studentId),
    db.select({ id: reportCards.id, studentId: reportCards.studentId, termId: reportCards.termId, version: reportCards.version,
      gpa: reportCards.gpa, overallPercentage: reportCards.overallPercentage, attendanceRate: reportCards.attendanceRate, createdAt: reportCards.createdAt })
      .from(reportCards).where(and(eq(reportCards.organizationId, org), eq(reportCards.status, "published"))).orderBy(desc(reportCards.createdAt)),
    db.select({ studentId: needToKnowAlerts.studentId, category: needToKnowAlerts.category, severity: needToKnowAlerts.severity,
      expiresAt: needToKnowAlerts.expiresAt }).from(needToKnowAlerts)
      .where(and(eq(needToKnowAlerts.organizationId, org), eq(needToKnowAlerts.isActive, true))),
    db.select({ studentId: courtRestrictions.studentId, prohibitPickup: courtRestrictions.prohibitPickup,
      prohibitDisclosure: courtRestrictions.prohibitDisclosure, effectiveDate: courtRestrictions.effectiveDate, expirationDate: courtRestrictions.expirationDate })
      .from(courtRestrictions).where(and(eq(courtRestrictions.organizationId, org), eq(courtRestrictions.isEnforced, true))),
  ]);
  return { school, actor, students: studentRows, guardians: guardianRows, links, staff, classes: classRows,
    grades, years, terms: termRows, subjects: subjectRows, enrollments: enrollmentRows, audit,
    attendanceSummary, publishedReports, activeAlerts: activeAlerts.filter(alert => !alert.expiresAt || alert.expiresAt > new Date()),
    activeRestrictions: activeRestrictions.filter(restriction => restriction.effectiveDate <= new Date().toISOString().slice(0, 10) &&
      (!restriction.expirationDate || restriction.expirationDate >= new Date().toISOString().slice(0, 10))) };
}

export type SchoolAdminData = Awaited<ReturnType<typeof getSchoolAdminData>>;
