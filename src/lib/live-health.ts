import "server-only";

import { db } from "@/db";
import {
  getSystemHealthReport,
  type DatabaseHealth,
  type SystemHealthReport,
} from "@/lib/monitoring";
import { sql } from "drizzle-orm";

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
  return report;
}
