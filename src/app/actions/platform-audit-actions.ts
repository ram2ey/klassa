"use server";

import { and, count, desc, eq, gte, ilike, lt, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { auditEvents, organizations, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";

const auditFilterSchema = z.object({
  search: z.string().trim().max(120).default(""),
  action: z.string().trim().max(120).default(""),
  from: z.iso.date().optional().or(z.literal("")),
  to: z.iso.date().optional().or(z.literal("")),
  page: z.number().int().min(1).max(100_000).default(1),
}).refine(filters => !filters.from || !filters.to || filters.from <= filters.to, {
  path: ["to"], message: "End date must be on or after the start date.",
});

function filtersFor(input: z.infer<typeof auditFilterSchema>) {
  const filters = [];
  if (input.action) filters.push(eq(auditEvents.action, input.action));
  if (input.from) filters.push(gte(auditEvents.createdAt, new Date(`${input.from}T00:00:00.000Z`)));
  if (input.to) {
    const afterEnd = new Date(`${input.to}T00:00:00.000Z`);
    afterEnd.setUTCDate(afterEnd.getUTCDate() + 1);
    filters.push(lt(auditEvents.createdAt, afterEnd));
  }
  if (input.search) {
    const term = `%${input.search}%`;
    filters.push(or(
      ilike(auditEvents.action, term), ilike(auditEvents.entityType, term), ilike(auditEvents.entityId, term),
      ilike(users.name, term), ilike(organizations.name, term),
    ));
  }
  return filters.length ? and(...filters) : undefined;
}

const auditProjection = {
  id: auditEvents.id,
  organizationId: auditEvents.organizationId,
  schoolName: organizations.name,
  actorName: users.name,
  action: auditEvents.action,
  entityType: auditEvents.entityType,
  entityId: auditEvents.entityId,
  createdAt: auditEvents.createdAt,
};

export async function getPlatformAuditPageAction(input: z.input<typeof auditFilterSchema>) {
  await requirePlatformAdmin();
  const parsed = auditFilterSchema.parse(input);
  const where = filtersFor(parsed);
  const [totals, rows] = await Promise.all([
    db.select({ total: count() }).from(auditEvents)
      .leftJoin(organizations, eq(auditEvents.organizationId, organizations.id))
      .leftJoin(users, eq(auditEvents.actorUserId, users.id)).where(where),
    db.select(auditProjection).from(auditEvents)
      .leftJoin(organizations, eq(auditEvents.organizationId, organizations.id))
      .leftJoin(users, eq(auditEvents.actorUserId, users.id)).where(where)
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(25).offset((parsed.page - 1) * 25),
  ]);
  const total = totals[0]?.total ?? 0;
  return { rows, total, page: parsed.page, pageSize: 25, pageCount: Math.ceil(total / 25) };
}

function csvCell(value: string | null) {
  const safe = (value ?? "").replace(/^[\t\r ]*(?=[=+@-])/, "'");
  return `"${safe.replaceAll('"', '""')}"`;
}

export async function exportPlatformAuditAction(input: Omit<z.input<typeof auditFilterSchema>, "page">) {
  await requirePlatformAdmin();
  const parsed = auditFilterSchema.parse({ ...input, page: 1 });
  const where = filtersFor(parsed);
  const rows = await db.select(auditProjection).from(auditEvents)
    .leftJoin(organizations, eq(auditEvents.organizationId, organizations.id))
    .leftJoin(users, eq(auditEvents.actorUserId, users.id)).where(where)
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id)).limit(10_001);
  const truncated = rows.length > 10_000;
  const exportedRows = rows.slice(0, 10_000);
  const header = ["Event", "Actor", "Scope", "Resource type", "Resource ID", "Timestamp"];
  const lines = [header, ...exportedRows.map(row => [
    row.action, row.actorName, row.schoolName ?? "Platform", row.entityType, row.entityId, row.createdAt.toISOString(),
  ])].map(columns => columns.map(csvCell).join(","));
  return { csv: lines.join("\r\n"), rowCount: exportedRows.length, truncated };
}
