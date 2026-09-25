import "server-only";

import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { platformIncidentEvents, platformIncidents, users } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";
import { incidentSignals } from "@/lib/platform-incident-policy";
import type { SystemHealthReport } from "@/lib/monitoring";

export async function reconcilePlatformIncidents(report: SystemHealthReport) {
  if (report.checks.database.status !== "healthy") return [];
  const signals = incidentSignals(report);
  const now = new Date();
  await db.transaction(async tx => {
    for (const signal of signals.open) {
      const [created] = await tx.insert(platformIncidents).values({ ...signal, triggeredAt: now, lastObservedAt: now })
        .onConflictDoNothing().returning({ id: platformIncidents.id });
      if (created) {
        await tx.insert(platformIncidentEvents).values({ incidentId: created.id, action: "opened", note: signal.details });
      } else {
        await tx.update(platformIncidents).set({ details: signal.details, lastObservedAt: now })
          .where(and(eq(platformIncidents.code, signal.code), isNull(platformIncidents.resolvedAt)));
      }
    }
    for (const code of signals.recovered) {
      const resolved = await tx.update(platformIncidents).set({ resolvedAt: now, resolutionNote: "Health check returned to the recovery threshold." })
        .where(and(eq(platformIncidents.code, code), isNull(platformIncidents.resolvedAt)))
        .returning({ id: platformIncidents.id });
      for (const incident of resolved) {
        await tx.insert(platformIncidentEvents).values({ incidentId: incident.id, action: "auto_resolved",
          note: "Health check returned to the recovery threshold." });
      }
    }
  });
  return db.select({ id: platformIncidents.id, code: platformIncidents.code, title: platformIncidents.title,
    severity: platformIncidents.severity, details: platformIncidents.details, triggeredAt: platformIncidents.triggeredAt })
    .from(platformIncidents).where(isNull(platformIncidents.resolvedAt)).orderBy(desc(platformIncidents.triggeredAt));
}

export async function getPlatformIncidentData() {
  await requirePlatformAdmin();
  const incidents = await db.select({ id: platformIncidents.id, code: platformIncidents.code, title: platformIncidents.title,
    severity: platformIncidents.severity, details: platformIncidents.details, triggeredAt: platformIncidents.triggeredAt,
    lastObservedAt: platformIncidents.lastObservedAt, acknowledgedAt: platformIncidents.acknowledgedAt,
    resolvedAt: platformIncidents.resolvedAt, resolutionNote: platformIncidents.resolutionNote })
    .from(platformIncidents).orderBy(desc(platformIncidents.triggeredAt)).limit(50);
  const events = incidents.length ? await db.select({ id: platformIncidentEvents.id, incidentId: platformIncidentEvents.incidentId,
    action: platformIncidentEvents.action, note: platformIncidentEvents.note, createdAt: platformIncidentEvents.createdAt,
    actorName: users.name }).from(platformIncidentEvents)
    .leftJoin(users, eq(users.id, platformIncidentEvents.actorUserId))
    .where(inArray(platformIncidentEvents.incidentId, incidents.map(incident => incident.id)))
    .orderBy(desc(platformIncidentEvents.createdAt)).limit(200) : [];
  return { incidents, events };
}
