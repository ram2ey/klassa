"use server";

import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { accounts, organizationMemberships, organizations, sessions, staffRole, users } from "@/db/schema";
import { requireAccount, requireLiveMode, requirePlatformAdmin, requireStaff } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { phoneNumberSchema } from "@/lib/phone";

const accountSchema = z.object({
  administratorName: z.string().trim().min(2).max(180),
  administratorPhone: phoneNumberSchema,
  temporaryPassword: z.string().min(12).max(128),
});

const schoolSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone"),
}).and(accountSchema);

export async function createSchoolWithAdminAction(input: z.input<typeof schoolSchema>) {
  const actor = await requirePlatformAdmin();
  const data = schoolSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [created] = await tx.insert(organizations).values({ name: data.name, slug: data.slug, timezone: data.timezone }).returning();
    const [existing] = await tx.select().from(users).where(eq(users.phoneNumber, data.administratorPhone)).limit(1);
    const userId = existing?.id ?? randomUUID();

    if (!existing) {
      await tx.insert(users).values({
        id: userId,
        name: data.administratorName,
        email: `${userId}@accounts.klassa.invalid`,
        phoneNumber: data.administratorPhone,
        phoneNumberVerified: true,
        organizationId: created.id,
        role: "school_admin",
        mustChangePassword: true,
      });
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword(data.temporaryPassword),
      });
    }

    await tx.insert(organizationMemberships).values({ organizationId: created.id, userId, role: "school_admin" });
    await logAuditEvent({ organizationId: created.id, actorUserId: actor.id, action: "organization.created",
      entityType: "organization", entityId: created.id, metadata: { initialAdministratorId: userId } }, tx);
    await logAuditEvent({ organizationId: created.id, actorUserId: actor.id, action: "account.initial_admin_provisioned",
      entityType: "user", entityId: userId, metadata: { existingAccount: !!existing } }, tx);
    return { id: created.id, name: created.name, accountCreated: !existing };
  });
  revalidatePath("/platform");
  return result;
}

const staffSchema = accountSchema.extend({
  organizationId: z.uuid(),
  role: z.enum(staffRole.enumValues),
});

const schoolStaffSchema = accountSchema.extend({
  role: z.enum(staffRole.enumValues),
});

export async function provisionSchoolStaffAction(input: z.input<typeof staffSchema>) {
  const actor = await requirePlatformAdmin();
  const data = staffSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, data.organizationId)).limit(1);
    if (!school) throw new Error("School not found.");
    const [existing] = await tx.select().from(users).where(eq(users.phoneNumber, data.administratorPhone)).limit(1);
    const userId = existing?.id ?? randomUUID();

    if (!existing) {
      await tx.insert(users).values({
        id: userId,
        name: data.administratorName,
        email: `${userId}@accounts.klassa.invalid`,
        phoneNumber: data.administratorPhone,
        phoneNumberVerified: true,
        organizationId: data.organizationId,
        role: data.role,
        mustChangePassword: true,
      });
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword(data.temporaryPassword),
      });
    }

    const [membership] = await tx.insert(organizationMemberships).values({
      organizationId: data.organizationId,
      userId,
      role: data.role,
    }).onConflictDoNothing({ target: [organizationMemberships.organizationId, organizationMemberships.userId] }).returning({ id: organizationMemberships.id });
    if (!membership) throw new Error("This account already belongs to that school.");
    await logAuditEvent({ organizationId: data.organizationId, actorUserId: actor.id, action: "account.staff_provisioned",
      entityType: "user", entityId: userId, metadata: { role: data.role, existingAccount: !!existing } }, tx);
    return { accountCreated: !existing };
  });
  revalidatePath("/platform");
  return result;
}

export async function provisionStaffForCurrentSchoolAction(input: z.input<typeof schoolStaffSchema>) {
  const actor = await requireStaff(["school_admin"]);
  const data = schoolStaffSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [existing] = await tx.select().from(users).where(eq(users.phoneNumber, data.administratorPhone)).limit(1);
    const userId = existing?.id ?? randomUUID();

    if (!existing) {
      await tx.insert(users).values({
        id: userId,
        name: data.administratorName,
        email: `${userId}@accounts.klassa.invalid`,
        phoneNumber: data.administratorPhone,
        phoneNumberVerified: true,
        organizationId: actor.organizationId,
        role: data.role,
        mustChangePassword: true,
      });
      await tx.insert(accounts).values({
        id: randomUUID(),
        userId,
        accountId: userId,
        providerId: "credential",
        password: await hashPassword(data.temporaryPassword),
      });
    }

    const [membership] = await tx.insert(organizationMemberships).values({
      organizationId: actor.organizationId,
      userId,
      role: data.role,
    }).onConflictDoNothing({ target: [organizationMemberships.organizationId, organizationMemberships.userId] }).returning({ id: organizationMemberships.id });
    if (!membership) throw new Error("This account already belongs to your school.");
    await logAuditEvent({
      organizationId: actor.organizationId,
      actorUserId: actor.userId,
      action: "account.staff_provisioned",
      entityType: "user",
      entityId: userId,
      metadata: { role: data.role, existingAccount: !!existing, provisionedBy: "school_admin" },
    }, tx);
    return { accountCreated: !existing };
  });
  revalidatePath("/");
  return result;
}

export async function selectSchoolAction(organizationId: string) {
  requireLiveMode();
  const { session, user } = await requireAccount();
  z.uuid().parse(organizationId);
  await db.transaction(async tx => {
    const [membership] = await tx.select().from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, organizationId), eq(organizationMemberships.userId, user.id))).limit(1);
    if (!membership) throw new Error("Access denied.");
    await tx.update(sessions).set({ activeOrganizationId: organizationId })
      .where(and(eq(sessions.id, session.session.id), eq(sessions.userId, user.id)));
    await logAuditEvent({ organizationId, actorUserId: user.id, action: "school.selected", entityType: "session", entityId: session.session.id }, tx);
  });
  revalidatePath("/");
}
