"use server";

import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { accounts, organizationMemberships, sessions, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";

const targetSchema = z.object({ organizationId: z.uuid(), userId: z.string().min(1) });
const resetSchema = targetSchema.extend({ temporaryPassword: z.string().min(12).max(128) });

async function requireSchoolAccount(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  target: z.output<typeof targetSchema>,
  actorId: string,
) {
  if (target.userId === actorId) throw new Error("You cannot change your own access here.");
  const [membership] = await tx.select({ userId: organizationMemberships.userId })
    .from(organizationMemberships)
    .where(and(eq(organizationMemberships.organizationId, target.organizationId), eq(organizationMemberships.userId, target.userId)))
    .limit(1);
  if (!membership) throw new Error("This staff account is not in the selected school.");
  const [user] = await tx.select({ id: users.id, isPlatformAdmin: users.isPlatformAdmin })
    .from(users).where(eq(users.id, target.userId)).limit(1);
  if (!user || user.isPlatformAdmin) throw new Error("Platform administrator accounts cannot be changed here.");
  return user;
}

export async function revokeStaffSessionsAction(input: z.input<typeof targetSchema>) {
  const actor = await requirePlatformAdmin();
  const target = targetSchema.parse(input);
  const revokedCount = await db.transaction(async tx => {
    await requireSchoolAccount(tx, target, actor.id);
    const revoked = await tx.delete(sessions).where(eq(sessions.userId, target.userId)).returning({ id: sessions.id });
    await logAuditEvent({ organizationId: target.organizationId, actorUserId: actor.id,
      action: "account.sessions_revoked", entityType: "user", entityId: target.userId,
      metadata: { revokedCount: revoked.length } }, tx);
    return revoked.length;
  });
  revalidatePath("/platform");
  return { revokedCount };
}

export async function resetStaffPasswordAction(input: z.input<typeof resetSchema>) {
  const actor = await requirePlatformAdmin();
  const target = resetSchema.parse(input);
  const password = await hashPassword(target.temporaryPassword);
  await db.transaction(async tx => {
    await requireSchoolAccount(tx, target, actor.id);
    const credentialAccounts = await tx.select({ id: accounts.id }).from(accounts)
      .where(and(eq(accounts.userId, target.userId), eq(accounts.providerId, "credential"))).limit(2);
    if (credentialAccounts.length !== 1) throw new Error("This account cannot be reset from the platform console.");
    await tx.update(accounts).set({ password, updatedAt: new Date() })
      .where(eq(accounts.id, credentialAccounts[0].id));
    await tx.update(users).set({ mustChangePassword: true, updatedAt: new Date() })
      .where(eq(users.id, target.userId));
    const revoked = await tx.delete(sessions).where(eq(sessions.userId, target.userId)).returning({ id: sessions.id });
    await logAuditEvent({ organizationId: target.organizationId, actorUserId: actor.id,
      action: "account.password_reset_by_platform", entityType: "user", entityId: target.userId,
      metadata: { revokedSessions: revoked.length } }, tx);
  });
  revalidatePath("/platform");
}
