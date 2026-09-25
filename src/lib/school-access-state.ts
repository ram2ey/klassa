import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { organizationMemberships, organizations } from "@/db/schema";

export async function isSchoolSuspendedForUser(
  user: { id: string; isPlatformAdmin: boolean; organizationId: string | null },
  activeOrganizationId?: string | null,
) {
  if (user.isPlatformAdmin) return false;
  const schoolIds = new Set<string>();
  if (user.organizationId) schoolIds.add(user.organizationId);
  if (activeOrganizationId) schoolIds.add(activeOrganizationId);
  if (!schoolIds.size) {
    const memberships = await db.select({ organizationId: organizationMemberships.organizationId })
      .from(organizationMemberships).where(eq(organizationMemberships.userId, user.id));
    for (const membership of memberships) schoolIds.add(membership.organizationId);
  }
  if (!schoolIds.size) return false;
  const schools = await db.select({ suspendedAt: organizations.suspendedAt }).from(organizations)
    .where(inArray(organizations.id, [...schoolIds]));
  return schools.some(school => !!school.suspendedAt);
}

export async function isSchoolSuspended(organizationId: string) {
  const [school] = await db.select({ suspendedAt: organizations.suspendedAt }).from(organizations)
    .where(eq(organizations.id, organizationId)).limit(1);
  return !!school?.suspendedAt;
}
