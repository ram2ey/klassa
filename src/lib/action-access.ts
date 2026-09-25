import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { isDemoMode } from "@/lib/runtime-config";
import { db } from "@/db";
import { guardians, organizationMemberships, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export type StaffRole = typeof users.$inferSelect.role;

/** Identity is fetched from the database, never accepted from action arguments. */
export async function requireAccount() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) throw new Error("Authentication required.");
  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) throw new Error("Access denied.");
  if (user.mustChangePassword) throw new Error("Password change required before accessing school data.");
  if (user.isPlatformAdmin && !user.twoFactorEnabled) throw new Error("Platform administrator two-factor authentication is required.");
  return { session, user };
}

export function requireLiveMode() {
  if (isDemoMode()) throw new Error("Disable local demo mode to manage real accounts and invitations.");
}

export async function requirePlatformAdmin() {
  requireLiveMode();
  const { user } = await requireAccount();
  if (!user.isPlatformAdmin) throw new Error("Platform administrator access required.");
  return user;
}

export async function requireStaff(roles: NonNullable<StaffRole>[]) {
  const { session, user } = await requireAccount();
  const organizationId = session.session?.activeOrganizationId ?? user.organizationId;
  if (!organizationId) throw new Error("Access denied. Select a school first.");
  const [membership] = await db.select().from(organizationMemberships)
    .where(and(eq(organizationMemberships.userId, user.id), eq(organizationMemberships.organizationId, organizationId))).limit(1);
  if (!membership || !roles.includes(membership.role)) throw new Error("Access denied.");
  return { userId: user.id, name: user.name, organizationId, role: membership.role };
}

/** Guardian access is granted only through an explicit guardian record link. */
export async function requireGuardian() {
  const { user } = await requireAccount();
  if (user.isPlatformAdmin || user.role !== null) throw new Error("Guardian access required.");
  const linked = await db.select({ id: guardians.id, organizationId: guardians.organizationId })
    .from(guardians).where(eq(guardians.userId, user.id));
  if (!linked.length) throw new Error("Guardian access required.");
  return { userId: user.id, name: user.name, guardians: linked };
}

/** Keep unfinished, fixture-backed operations away from live accounts and databases. */
export async function requireDemoAction(): Promise<void> {
  if (isDemoMode()) return;
  await requireStaff(["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"]);
  throw new Error("This workflow is available only in the local demo. Live support is not implemented.");
}
