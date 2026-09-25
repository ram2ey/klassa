import "server-only";

import { db } from "@/db";
import { platformRequestMetrics } from "@/db/schema";
import { sql, lt } from "drizzle-orm";

const instanceId = `${process.env.HOSTNAME ?? "node"}:${process.pid}`.slice(0, 120);
let lastCleanupAt = 0;

function currentMinute() {
  const date = new Date();
  date.setUTCSeconds(0, 0);
  return date;
}

async function cleanupOldMetrics(now: number) {
  if (now - lastCleanupAt < 60 * 60 * 1000) return;
  const cutoff = new Date(now - 7 * 24 * 60 * 60 * 1000);
  await db.delete(platformRequestMetrics).where(lt(platformRequestMetrics.minute, cutoff));
  lastCleanupAt = now;
}

async function increment(field: "requestCount" | "errorCount") {
  const now = Date.now();
  const minute = currentMinute();
  const zero = field === "requestCount" ? { requestCount: 1 } : { errorCount: 1 };
  await db.insert(platformRequestMetrics).values({ minute, instanceId, ...zero })
    .onConflictDoUpdate({
      target: [platformRequestMetrics.minute, platformRequestMetrics.instanceId],
      set: { [field]: sql`${platformRequestMetrics[field]} + 1` },
    });
  await cleanupOldMetrics(now);
}

export function recordPlatformRequest() {
  return increment("requestCount");
}

export function recordPlatformRequestError() {
  return increment("errorCount");
}

export async function getPlatformRequestMetrics(windowMinutes = 5) {
  const cutoff = new Date(Date.now() - windowMinutes * 60 * 1000);
  const [row] = await db.select({
    requestCount: sql<number>`coalesce(sum(${platformRequestMetrics.requestCount}), 0)::int`,
    errorCount: sql<number>`coalesce(sum(${platformRequestMetrics.errorCount}), 0)::int`,
  }).from(platformRequestMetrics).where(sql`${platformRequestMetrics.minute} >= ${cutoff}`);
  const requestCount = Number(row?.requestCount ?? 0);
  const errorCount = Number(row?.errorCount ?? 0);
  return {
    requestCount,
    errorCount,
    errorRate: requestCount ? Math.round(errorCount / requestCount * 1000) / 10 : 0,
    windowMinutes,
  };
}
