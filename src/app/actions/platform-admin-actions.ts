"use server";

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, count, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { accounts, sessions, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";
import { loginUsername, usernameSchema } from "@/lib/login-identity";

const createSchema = z.object({
  name: z.string().trim().min(2).max(180),
  username: usernameSchema,
  temporaryPassword: z.string().min(12).max(128),
});
const targetSchema = z.object({ userId: z.string().uuid() });
const suspendSchema = targetSchema.extend({ reason: z.string().trim().min(8).max(500) });

export async function createPlatformAdminAction(input: z.input<typeof createSchema>) {
  const actor = await requirePlatformAdmin();
  const data = createSchema.parse(input);
  const username = loginUsername("platform", data.username);
  const password = await hashPassword(data.temporaryPassword);
  await db.transaction(async tx => {
    const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
    if (existing) throw new Error("This platform username is already in use.");
    const userId = randomUUID();
    await tx.insert(users).values({ id: userId, name: data.name, email: `${userId}@accounts.klassa.invalid`,
      username, displayUsername: data.username, isPlatformAdmin: true, mustChangePassword: true });
    await tx.insert(accounts).values({ id: randomUUID(), accountId: userId, userId, providerId: "credential", password });
    await logAuditEvent({ organizationId: null, actorUserId: actor.id, action: "platform_admin.created",
      entityType: "user", entityId: userId, metadata: { username } }, tx);
  });
  revalidatePath("/platform");
  return { tenantId: "platform", username: data.username };
}

export async function suspendPlatformAdminAction(input: z.input<typeof suspendSchema>) {
  const actor = await requirePlatformAdmin();
  const target = suspendSchema.parse(input);
  if (target.userId === actor.id) throw new Error("You cannot suspend your own platform account.");
  await db.transaction(async tx => {
    // Serialize platform-admin suspensions, including across app instances.
    await tx.execute(sql`select pg_advisory_xact_lock(781582, 1)`);
    const [currentActor] = await tx.select({ id: users.id }).from(users)
      .where(and(eq(users.id, actor.id), eq(users.isPlatformAdmin, true), isNull(users.suspendedAt))).limit(1);
    if (!currentActor) throw new Error("Your platform account is no longer active.");
    const [user] = await tx.select({ id: users.id, suspendedAt: users.suspendedAt }).from(users)
      .where(and(eq(users.id, target.userId), eq(users.isPlatformAdmin, true))).limit(1).for("update");
    if (!user) throw new Error("Platform administrator not found.");
    if (user.suspendedAt) throw new Error("This account is already suspended.");
    const [active] = await tx.select({ total: count() }).from(users)
      .where(and(eq(users.isPlatformAdmin, true), isNull(users.suspendedAt)));
    if ((active?.total ?? 0) <= 1) throw new Error("At least one active platform administrator must remain.");
    const now = new Date();
    await tx.update(users).set({ suspendedAt: now, updatedAt: now }).where(eq(users.id, user.id));
    const revoked = await tx.delete(sessions).where(eq(sessions.userId, user.id)).returning({ id: sessions.id });
    await logAuditEvent({ organizationId: null, actorUserId: actor.id, action: "platform_admin.suspended",
      entityType: "user", entityId: user.id, metadata: { reason: target.reason, revokedSessions: revoked.length } }, tx);
  });
  revalidatePath("/platform");
}

export async function revokePlatformAdminSessionsAction(input: z.input<typeof targetSchema>) {
  const actor = await requirePlatformAdmin();
  const target = targetSchema.parse(input);
  if (target.userId === actor.id) throw new Error("Use sign out to end your own session.");
  const revokedCount = await db.transaction(async tx => {
    const [user] = await tx.select({ id: users.id }).from(users)
      .where(and(eq(users.id, target.userId), eq(users.isPlatformAdmin, true))).limit(1);
    if (!user) throw new Error("Platform administrator not found.");
    const revoked = await tx.delete(sessions).where(eq(sessions.userId, user.id)).returning({ id: sessions.id });
    await logAuditEvent({ organizationId: null, actorUserId: actor.id, action: "platform_admin.sessions_revoked",
      entityType: "user", entityId: user.id, metadata: { revokedSessions: revoked.length } }, tx);
    return revoked.length;
  });
  revalidatePath("/platform");
  return { revokedCount };
}

export async function reactivatePlatformAdminAction(input: z.input<typeof targetSchema>) {
  const actor = await requirePlatformAdmin();
  const target = targetSchema.parse(input);
  await db.transaction(async tx => {
    const [user] = await tx.select({ id: users.id, suspendedAt: users.suspendedAt }).from(users)
      .where(and(eq(users.id, target.userId), eq(users.isPlatformAdmin, true))).limit(1).for("update");
    if (!user) throw new Error("Platform administrator not found.");
    if (!user.suspendedAt) throw new Error("This account is already active.");
    await tx.update(users).set({ suspendedAt: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    await logAuditEvent({ organizationId: null, actorUserId: actor.id, action: "platform_admin.reactivated",
      entityType: "user", entityId: user.id }, tx);
  });
  revalidatePath("/platform");
}
