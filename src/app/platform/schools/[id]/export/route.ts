import { eq } from "drizzle-orm";
import { z } from "zod";
import { databaseClient, db } from "@/db";
import { organizations, users, organizationMemberships } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePlatformAdmin();
  if (!actor.twoFactorEnabled) return new Response("Multi-factor authentication required", { status: 403 });
  const parsed = z.uuid().safeParse((await params).id);
  if (!parsed.success) return new Response("Invalid school", { status: 400 });
  const schoolId = parsed.data;
  const [school] = await db.select().from(organizations).where(eq(organizations.id, schoolId));
  if (!school) return new Response("School not found", { status: 404 });
  const tableRows = await databaseClient<{ table_name: string }[]>`
    select distinct table_name from information_schema.columns
    where table_schema = 'public' and column_name = 'organization_id' order by table_name`;
  const tables: Record<string, unknown[]> = {};
  for (const { table_name } of tableRows) {
    tables[table_name] = [...await databaseClient`select * from ${databaseClient(table_name)} where organization_id = ${schoolId}`];
  }
  const staff = await db.select({ id: users.id, name: users.name, username: users.username,
    email: users.email, phoneNumber: users.phoneNumber, role: organizationMemberships.role })
    .from(organizationMemberships).innerJoin(users, eq(users.id, organizationMemberships.userId))
    .where(eq(organizationMemberships.organizationId, schoolId));
  await logAuditEvent({ organizationId: schoolId, actorUserId: actor.id, action: "platform.school_exported",
    entityType: "organization", entityId: schoolId,
    metadata: { tableCount: tableRows.length, exportedAt: new Date().toISOString() } });
  const body = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), school, staff, tables });
  return new Response(body, { headers: { "Content-Type": "application/json; charset=utf-8",
    "Content-Disposition": `attachment; filename="klassa-school-${schoolId}.json"`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
