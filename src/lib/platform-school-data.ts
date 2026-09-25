import "server-only";

import { and, count, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, auditEvents, organizationMemberships, organizations, sessions, students, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";

export async function getPlatformSchoolDetailData(organizationId: string) {
  await requirePlatformAdmin();
  const [school] = await db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug,
    timezone: organizations.timezone, suspendedAt: organizations.suspendedAt, createdAt: organizations.createdAt })
    .from(organizations).where(eq(organizations.id, organizationId)).limit(1);
  if (!school) return null;
  const [memberships, activity, years, roster] = await Promise.all([
    db.select({ userId: users.id, name: users.name, username: users.username, role: organizationMemberships.role,
      suspendedAt: users.suspendedAt, mustChangePassword: users.mustChangePassword })
      .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
      .where(eq(organizationMemberships.organizationId, school.id)).orderBy(users.name),
    db.select({ id: auditEvents.id, action: auditEvents.action, actorName: users.name,
      createdAt: auditEvents.createdAt, entityType: auditEvents.entityType })
      .from(auditEvents).leftJoin(users, eq(users.id, auditEvents.actorUserId))
      .where(eq(auditEvents.organizationId, school.id)).orderBy(desc(auditEvents.createdAt)).limit(15),
    db.select({ id: academicYears.id }).from(academicYears)
      .where(eq(academicYears.organizationId, school.id)).limit(1),
    db.select({ total: count() }).from(students).where(eq(students.organizationId, school.id)),
  ]);
  const activeSessions = memberships.length
    ? await db.select({ userId: sessions.userId }).from(sessions)
      .where(and(inArray(sessions.userId, memberships.map(member => member.userId)), gt(sessions.expiresAt, new Date())))
    : [];
  const activeUserIds = new Set(activeSessions.map(session => session.userId));
  return {
    school,
    setup: {
      schoolAdmin: memberships.some(member => member.role === "school_admin" && !member.suspendedAt),
      academicYear: years.length > 0,
      safeguardingLead: memberships.some(member => member.role === "safeguarding_lead" && !member.suspendedAt),
      roster: (roster[0]?.total ?? 0) > 0,
    },
    staff: memberships.map(member => ({ ...member, hasActiveSession: activeUserIds.has(member.userId) })),
    activity,
    studentCount: roster[0]?.total ?? 0,
  };
}
