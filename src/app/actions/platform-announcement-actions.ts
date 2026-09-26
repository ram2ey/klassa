"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { announcements, organizations } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";

const inputSchema = z.object({ title: z.string().trim().min(3).max(200),
  content: z.string().trim().min(10).max(5000) });

export async function publishPlatformAnnouncementAction(raw: z.input<typeof inputSchema>) {
  const actor = await requirePlatformAdmin();
  if (!actor.twoFactorEnabled) throw new Error("Multi-factor authentication is required.");
  const input = inputSchema.parse(raw);
  const result = await db.transaction(async tx => {
    const schools = await tx.select({ id: organizations.id }).from(organizations);
    if (!schools.length) return 0;
    const now = new Date();
    await tx.insert(announcements).values(schools.map(school => ({ organizationId: school.id,
      title: input.title, content: input.content, targetType: "school" as const, targetId: "all",
      priority: "important" as const, channels: "in_app" as const, status: "published" as const,
      publishedAt: now, authorId: actor.id })));
    await logAuditEvent({ organizationId: null, actorUserId: actor.id, action: "platform.announcement_published",
      entityType: "platform_announcement", entityId: actor.id,
      metadata: { title: input.title, schoolCount: schools.length } }, tx);
    return schools.length;
  });
  revalidatePath("/");
  return { schoolCount: result };
}
