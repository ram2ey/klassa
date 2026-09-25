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
import { loginUsername, schoolTenantIdSchema, usernameSchema } from "@/lib/login-identity";

const accountSchema = z.object({
  administratorName: z.string().trim().min(2).max(180),
  username: usernameSchema,
  temporaryPassword: z.string().min(12).max(128),
});
const schoolSchema = z.object({
  name: z.string().trim().min(2).max(180),
  slug: schoolTenantIdSchema,
  timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone"),
}).and(accountSchema);
const schoolStaffSchema = accountSchema.extend({ role: z.enum(staffRole.enumValues) });
const staffSchema = schoolStaffSchema.extend({ organizationId: z.uuid() });
type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function createStaffAccount(tx: Transaction, school: { id: string; slug: string }, data: z.output<typeof schoolStaffSchema>) {
  const username = loginUsername(school.slug, data.username);
  const [existing] = await tx.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) throw new Error("This username is already in use at this school.");
  const userId = randomUUID();
  // Never link accounts by username across schools or change an existing password.
  // The unique database index also rejects concurrent requests for the same login.
  await tx.insert(users).values({
    id: userId, name: data.administratorName, email: userId + "@accounts.klassa.invalid",
    username, displayUsername: data.username, organizationId: school.id,
    role: data.role, mustChangePassword: true,
  });
  await tx.insert(accounts).values({
    id: randomUUID(), userId, accountId: userId, providerId: "credential",
    password: await hashPassword(data.temporaryPassword),
  });
  await tx.insert(organizationMemberships).values({ organizationId: school.id, userId, role: data.role });
  return userId;
}

export async function createSchoolWithAdminAction(input: z.input<typeof schoolSchema>) {
  const actor = await requirePlatformAdmin();
  const data = schoolSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [school] = await tx.insert(organizations).values({ name: data.name, slug: data.slug, timezone: data.timezone }).returning();
    const userId = await createStaffAccount(tx, school, { ...data, role: "school_admin" });
    await logAuditEvent({ organizationId: school.id, actorUserId: actor.id, action: "organization.created",
      entityType: "organization", entityId: school.id, metadata: { initialAdministratorId: userId } }, tx);
    await logAuditEvent({ organizationId: school.id, actorUserId: actor.id, action: "account.initial_admin_provisioned",
      entityType: "user", entityId: userId, metadata: { existingAccount: false } }, tx);
    return { id: school.id, name: school.name, accountCreated: true, tenantId: school.slug, username: data.username };
  });
  revalidatePath("/platform");
  return result;
}

export async function provisionSchoolStaffAction(input: z.input<typeof staffSchema>) {
  const actor = await requirePlatformAdmin();
  const data = staffSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [school] = await tx.select().from(organizations).where(eq(organizations.id, data.organizationId)).limit(1);
    if (!school) throw new Error("School not found.");
    const userId = await createStaffAccount(tx, school, data);
    await logAuditEvent({ organizationId: school.id, actorUserId: actor.id, action: "account.staff_provisioned",
      entityType: "user", entityId: userId, metadata: { role: data.role, existingAccount: false } }, tx);
    return { accountCreated: true, tenantId: school.slug, username: data.username };
  });
  revalidatePath("/platform");
  return result;
}

export async function provisionStaffForCurrentSchoolAction(input: z.input<typeof schoolStaffSchema>) {
  const actor = await requireStaff(["school_admin"]);
  const data = schoolStaffSchema.parse(input);
  const result = await db.transaction(async tx => {
    const [school] = await tx.select().from(organizations).where(eq(organizations.id, actor.organizationId)).limit(1);
    if (!school) throw new Error("School not found.");
    const userId = await createStaffAccount(tx, school, data);
    await logAuditEvent({ organizationId: school.id, actorUserId: actor.userId, action: "account.staff_provisioned",
      entityType: "user", entityId: userId, metadata: { role: data.role, existingAccount: false, provisionedBy: "school_admin" } }, tx);
    return { accountCreated: true, tenantId: school.slug, username: data.username };
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
