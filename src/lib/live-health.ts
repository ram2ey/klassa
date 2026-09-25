import "server-only";

import { db } from "@/db";
import {
  getSystemHealthReport,
  type DatabaseHealth,
  type SystemHealthReport,
} from "@/lib/monitoring";
import { sql } from "drizzle-orm";
import { getPlatformRequestMetrics } from "@/lib/platform-telemetry";
import { reconcilePlatformIncidents } from "@/lib/platform-incidents";

export async function getLiveSystemHealthReport(): Promise<SystemHealthReport> {
  const startedAt = performance.now();
  let database: DatabaseHealth;

  try {
    await db.execute(sql`select 1`);
    database = { status: "healthy", latencyMs: Math.round(performance.now() - startedAt) };
  } catch {
    database = {
      status: "unhealthy",
      latencyMs: Math.round(performance.now() - startedAt),
      error: "Database connectivity check failed.",
    };
  }

  const report = getSystemHealthReport(database);
  if (database.status === "unhealthy") report.status = "unhealthy";
  try {
    const telemetry = await getPlatformRequestMetrics();
    report.metrics = {
      rollingRequestCount: telemetry.requestCount,
      rollingErrorCount: telemetry.errorCount,
      rollingErrorRate: telemetry.errorRate,
      averageLatencyMs: null,
    };
    report.telemetryAvailable = true;
    if (telemetry.requestCount >= 10 && telemetry.errorRate > 15 && report.status === "healthy") {
      report.status = "degraded";
    }
  } catch {
    report.telemetryAvailable = false;
    if (report.status === "healthy") report.status = "degraded";
  }
  try {
    const active = await reconcilePlatformIncidents(report);
    report.activeIncidents = active.map(incident => ({ ...incident, triggeredAt: incident.triggeredAt.toISOString() }));
    if (active.some(incident => incident.severity === "critical") && report.status === "healthy") report.status = "degraded";
  } catch {
    report.activeIncidents = [{ id: "incident-storage-unavailable", code: "INCIDENT_STORAGE_UNAVAILABLE",
      title: "Incident history is unavailable", severity: "warning", triggeredAt: new Date().toISOString(),
      details: "Persistent incident records could not be read or updated." }];
    if (report.status === "healthy") report.status = "degraded";
  }
  return report;
}
