import "server-only";

import { db } from "@/db";
import {
  getSystemHealthReport,
  type DatabaseHealth,
  type SystemHealthReport,
} from "@/lib/monitoring";
import { sql } from "drizzle-orm";
import { getPlatformRequestMetrics } from "@/lib/platform-telemetry";

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
  return report;
}
