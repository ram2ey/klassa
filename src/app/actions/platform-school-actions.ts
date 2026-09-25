"use server";

import { and, eq, inArray, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organizationMemberships, organizations, sessions, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";

const schoolIdSchema = z.uuid();
const detailsSchema = z.object({
  organizationId: schoolIdSchema,
  name: z.string().trim().min(2).max(180),
  timezone: z.string().refine(value => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; }
  }, "Invalid timezone"),
});
const suspensionSchema = z.object({ organizationId: schoolIdSchema, reason: z.string().trim().min(8).max(500) });

function refreshSchool(organizationId: string) {
  revalidatePath("/platform");
  revalidatePath(`/platform/schools/${organizationId}`);
}

export async function updatePlatformSchoolAction(input: z.input<typeof detailsSchema>) {
  const actor = await requirePlatformAdmin();
  const data = detailsSchema.parse(input);
  await db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id, name: organizations.name, timezone: organizations.timezone })
      .from(organizations).where(eq(organizations.id, data.organizationId)).limit(1).for("update");
    if (!school) throw new Error("School not found.");
    if (school.name === data.name && school.timezone === data.timezone) return;
    await tx.update(organizations).set({ name: data.name, timezone: data.timezone, updatedAt: new Date() })
      .where(eq(organizations.id, school.id));
    await logAuditEvent({ organizationId: school.id, actorUserId: actor.id,
      action: "organization.updated_by_platform", entityType: "organization", entityId: school.id,
      metadata: { previousName: school.name, name: data.name, previousTimezone: school.timezone, timezone: data.timezone } }, tx);
  });
  refreshSchool(data.organizationId);
}

export async function suspendPlatformSchoolAction(input: z.input<typeof suspensionSchema>) {
  const actor = await requirePlatformAdmin();
  const data = suspensionSchema.parse(input);
  await db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id, suspendedAt: organizations.suspendedAt })
      .from(organizations).where(eq(organizations.id, data.organizationId)).limit(1).for("update");
    if (!school) throw new Error("School not found.");
    if (school.suspendedAt) throw new Error("This school is already suspended.");
    const members = await tx.select({ userId: organizationMemberships.userId }).from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, school.id));
    const memberIds = [...new Set(members.map(member => member.userId))];
    const memberUsers = memberIds.length
      ? await tx.select({ id: users.id, isPlatformAdmin: users.isPlatformAdmin, organizationId: users.organizationId })
        .from(users).where(inArray(users.id, memberIds))
      : [];
    if (memberUsers.some(user => user.organizationId && user.organizationId !== school.id)) {
      throw new Error("Resolve account school assignments before suspending this school.");
    }
    const primaryUsers = await tx.select({ id: users.id, isPlatformAdmin: users.isPlatformAdmin }).from(users)
      .where(eq(users.organizationId, school.id));
    const candidateIds = [...new Set([...memberIds, ...primaryUsers.map(user => user.id)])];
    if (candidateIds.length) {
      const otherSchools = await tx.select({ userId: organizationMemberships.userId }).from(organizationMemberships)
        .where(and(inArray(organizationMemberships.userId, candidateIds), ne(organizationMemberships.organizationId, school.id))).limit(1);
      if (otherSchools.length) throw new Error("Resolve accounts assigned to another school before suspending this school.");
    }
    const affectedIds = [...new Set([...memberUsers, ...primaryUsers]
      .filter(user => !user.isPlatformAdmin).map(user => user.id))];
    const suspendedAt = new Date();
    await tx.update(organizations).set({ suspendedAt, updatedAt: suspendedAt }).where(eq(organizations.id, school.id));
    const revoked = affectedIds.length
      ? await tx.delete(sessions).where(inArray(sessions.userId, affectedIds)).returning({ id: sessions.id })
      : [];
    await logAuditEvent({ organizationId: school.id, actorUserId: actor.id,
      action: "organization.suspended", entityType: "organization", entityId: school.id,
      metadata: { reason: data.reason, affectedAccounts: affectedIds.length, revokedSessions: revoked.length } }, tx);
  });
  refreshSchool(data.organizationId);
}

export async function reactivatePlatformSchoolAction(organizationId: string) {
  const actor = await requirePlatformAdmin();
  const id = schoolIdSchema.parse(organizationId);
  await db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id, suspendedAt: organizations.suspendedAt })
      .from(organizations).where(eq(organizations.id, id)).limit(1).for("update");
    if (!school) throw new Error("School not found.");
    if (!school.suspendedAt) throw new Error("This school is already active.");
    await tx.update(organizations).set({ suspendedAt: null, updatedAt: new Date() }).where(eq(organizations.id, id));
    await logAuditEvent({ organizationId: id, actorUserId: actor.id,
      action: "organization.reactivated", entityType: "organization", entityId: id }, tx);
  });
  refreshSchool(id);
}
