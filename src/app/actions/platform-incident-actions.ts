"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { platformIncidentEvents, platformIncidents } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";

const incidentIdSchema = z.uuid();
const resolveSchema = z.object({ id: incidentIdSchema, note: z.string().trim().min(8).max(500) });

export async function acknowledgePlatformIncidentAction(id: string) {
  const actor = await requirePlatformAdmin();
  const incidentId = incidentIdSchema.parse(id);
  await db.transaction(async tx => {
    const [incident] = await tx.update(platformIncidents).set({ acknowledgedAt: new Date(), acknowledgedBy: actor.id })
      .where(and(eq(platformIncidents.id, incidentId), isNull(platformIncidents.acknowledgedAt), isNull(platformIncidents.resolvedAt)))
      .returning({ id: platformIncidents.id });
    if (!incident) throw new Error("This incident is already acknowledged or resolved.");
    await tx.insert(platformIncidentEvents).values({ incidentId, action: "acknowledged", actorUserId: actor.id });
  });
  revalidatePath("/platform");
}

export async function resolvePlatformIncidentAction(input: z.input<typeof resolveSchema>) {
  const actor = await requirePlatformAdmin();
  const data = resolveSchema.parse(input);
  await db.transaction(async tx => {
    const [incident] = await tx.update(platformIncidents).set({ resolvedAt: new Date(), resolvedBy: actor.id, resolutionNote: data.note })
      .where(and(eq(platformIncidents.id, data.id), isNull(platformIncidents.resolvedAt)))
      .returning({ id: platformIncidents.id });
    if (!incident) throw new Error("This incident is already resolved.");
    await tx.insert(platformIncidentEvents).values({ incidentId: data.id, action: "resolved", actorUserId: actor.id, note: data.note });
  });
  revalidatePath("/platform");
}
