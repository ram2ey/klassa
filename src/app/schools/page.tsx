import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { organizationMemberships, organizations } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { requireAccount } from "@/lib/action-access";
import { SchoolSelector } from "@/components/school-selector";

export default async function SchoolsPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  if (!session.user.twoFactorEnabled) redirect("/setup-mfa");
  const { user } = await requireAccount();
  const schools = await db.select({ id: organizations.id, name: organizations.name, role: organizationMemberships.role })
    .from(organizationMemberships).innerJoin(organizations, and(eq(organizations.id, organizationMemberships.organizationId), eq(organizationMemberships.userId, user.id)))
    .orderBy(organizations.name);
  return <SchoolSelector schools={schools} />;
}
