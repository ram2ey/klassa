import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, auditEvents, classes, enrollments, gradeLevels, guardians, organizationMemberships,
  organizations, studentGuardians, students, subjects, terms, users } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

export async function getSchoolAdminData() {
  const actor = await requireStaff(["school_admin"]);
  const org = actor.organizationId;
  const [school] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, timezone: organizations.timezone })
    .from(organizations).where(eq(organizations.id, org)).limit(1);
  if (!school) throw new Error("School not found.");
  const [studentRows, guardianRows, links, staff, classRows, grades, years, termRows, subjectRows, enrollmentRows, audit] = await Promise.all([
    db.select().from(students).where(eq(students.organizationId, org)).orderBy(students.lastName, students.firstName),
    db.select().from(guardians).where(eq(guardians.organizationId, org)).orderBy(guardians.lastName, guardians.firstName),
    db.select().from(studentGuardians).where(eq(studentGuardians.organizationId, org)),
    db.select({ id: organizationMemberships.id, userId: users.id, name: users.name, username: users.username,
      role: organizationMemberships.role, mustChangePassword: users.mustChangePassword, joinedAt: organizationMemberships.createdAt })
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
  ]);
  return { school, actor, students: studentRows, guardians: guardianRows, links, staff, classes: classRows,
    grades, years, terms: termRows, subjects: subjectRows, enrollments: enrollmentRows, audit };
}

export type SchoolAdminData = Awaited<ReturnType<typeof getSchoolAdminData>>;
