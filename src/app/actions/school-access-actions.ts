"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizationMemberships, organizations, sessions } from "@/db/schema";
import { requireAccount, requireLiveMode, requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";
import { revalidatePath } from "next/cache";

export async function createSchoolForInvitationsAction(input: { name: string; slug: string; timezone: string }) {
  const actor = await requirePlatformAdmin();
  const data = z.object({ name: z.string().trim().min(2).max(180),
    slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
    timezone: z.string().refine(value => { try { new Intl.DateTimeFormat("en", { timeZone: value }); return true; } catch { return false; } }, "Invalid timezone"),
  }).parse(input);
  const organization = await db.transaction(async tx => {
    const [created] = await tx.insert(organizations).values(data).returning();
    await logAuditEvent({ organizationId: created.id, actorUserId: actor.id, action: "organization.created",
      entityType: "organization", entityId: created.id }, tx);
    return { id: created.id, name: created.name };
  });
  revalidatePath("/platform");
  return organization;
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
