"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { organizationMemberships, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";

const reviewSchema = z.object({
  organizationId: z.uuid(),
  userId: z.string().min(1),
  decision: z.enum(["retain", "follow_up"]),
  note: z.string().trim().max(500),
}).refine(value => value.decision !== "follow_up" || value.note.length >= 8, {
  path: ["note"], message: "Explain the follow-up in at least eight characters.",
});

export async function recordPlatformAccessReviewAction(input: z.input<typeof reviewSchema>) {
  const actor = await requirePlatformAdmin();
  const review = reviewSchema.parse(input);
  if (review.userId === actor.id) throw new Error("Your own account cannot be reviewed here.");
  await db.transaction(async tx => {
    const [member] = await tx.select({ role: organizationMemberships.role,
      updatedAt: organizationMemberships.updatedAt }).from(organizationMemberships)
      .where(and(eq(organizationMemberships.organizationId, review.organizationId),
        eq(organizationMemberships.userId, review.userId))).limit(1).for("update");
    if (!member) throw new Error("This account is not in the selected school.");
    const [user] = await tx.select({ id: users.id, isPlatformAdmin: users.isPlatformAdmin }).from(users)
      .where(eq(users.id, review.userId)).limit(1).for("update");
    if (!user || user.isPlatformAdmin) throw new Error("Only school staff accounts can be reviewed here.");
    const now = new Date();
    await tx.update(users).set({ accessReviewedAt: now, accessReviewDecision: review.decision,
      accessReviewedBy: actor.id, updatedAt: now }).where(eq(users.id, user.id));
    await logAuditEvent({ organizationId: review.organizationId, actorUserId: actor.id,
      action: "account.access_reviewed", entityType: "user", entityId: user.id,
      metadata: { decision: review.decision, role: member.role, note: review.note } }, tx);
  });
  revalidatePath("/platform");
}
