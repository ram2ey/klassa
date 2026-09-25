import { encryptNarrative, decryptNarrative } from "@/lib/narrative-crypto";
import { getRateLimitMetrics } from "@/lib/rate-limit";

export type HealthStatus = "healthy" | "degraded" | "unhealthy";
export type IncidentSeverity = "info" | "warning" | "critical";

export interface SystemIncident {
  id: string;
  code: string;
  title: string;
  severity: IncidentSeverity;
  triggeredAt: string;
  details: string;
}

export interface MetricSample {
  timestamp: number;
  durationMs: number;
  isError: boolean;
  endpoint: string;
}

export interface SystemHealthReport {
  status: HealthStatus;
  timestamp: string;
  service: string;
  version: string;
  environment: string;
  uptimeSeconds: number;
  checks: {
    database: { status: HealthStatus; latencyMs: number; error?: string };
    cryptography: { status: HealthStatus; selfTestPassed: boolean };
    memory: { status: HealthStatus; heapUsedMb: number; heapTotalMb: number; rssMb: number };
    rateLimiter: { status: HealthStatus; trackedKeys: number; violations: number };
  };
  metrics: {
    rollingRequestCount: number;
    rollingErrorCount: number;
    rollingErrorRate: number; // percentage (0 - 100)
    averageLatencyMs: number | null;
  };
  telemetryAvailable: boolean;
  activeIncidents: SystemIncident[];
}

export type DatabaseHealth = SystemHealthReport["checks"]["database"];

// In-memory rolling metrics (last 5 minutes)
const rollingSamples: MetricSample[] = [];
const activeIncidents: SystemIncident[] = [];
let failedDecryptionsCount = 0;

/**
 * Records a request metric into the rolling window.
 */
export function recordRequestMetric(endpoint: string, isError: boolean, durationMs: number): void {
  const now = Date.now();
  rollingSamples.push({ timestamp: now, durationMs, isError, endpoint });
  pruneRollingSamples(now);
  evaluateIncidentThresholds();
}

/**
 * Records decryption attempts and flags anomalies if tampering is detected.
 */
export function recordDecryptionAttempt(success: boolean, caseId: string): void {
  if (!success) {
    failedDecryptionsCount++;
    if (failedDecryptionsCount >= 3) {
      triggerIncident({
        id: `inc-crypto-${Date.now()}`,
        code: "CRYPTO_TAMPER_ALERT",
        title: "Multiple Failed Decryption Attempts",
        severity: "critical",
        triggeredAt: new Date().toISOString(),
        details: `Cryptographic verification failed for case ${caseId}. Possible narrative tampering or invalid master key.`,
      });
    }
  } else {
    // Reset consecutive counter on successful decryption
    failedDecryptionsCount = Math.max(0, failedDecryptionsCount - 1);
  }
}

/**
 * Evaluates operational threshold anomalies.
 */
function evaluateIncidentThresholds(): void {
  const now = Date.now();
  pruneRollingSamples(now);

  if (rollingSamples.length >= 10) {
    const errorCount = rollingSamples.filter((s) => s.isError).length;
    const errorRate = (errorCount / rollingSamples.length) * 100;

    const existingHighError = activeIncidents.find((i) => i.code === "HIGH_ERROR_RATE");
    if (errorRate > 15 && !existingHighError) {
      triggerIncident({
        id: `inc-err-${now}`,
        code: "HIGH_ERROR_RATE",
        title: "System Error Rate Threshold Exceeded",
        severity: "warning",
        triggeredAt: new Date().toISOString(),
        details: `Rolling error rate is currently ${errorRate.toFixed(1)}% (threshold: 15%).`,
      });
    } else if (errorRate <= 5 && existingHighError) {
      // Resolve incident
      const idx = activeIncidents.indexOf(existingHighError);
      if (idx !== -1) activeIncidents.splice(idx, 1);
    }
  }
}

function triggerIncident(incident: SystemIncident): void {
  const exists = activeIncidents.some((i) => i.code === incident.code);
  if (!exists) {
    activeIncidents.unshift(incident);
    if (activeIncidents.length > 20) activeIncidents.pop();
  }
}

function pruneRollingSamples(now: number): void {
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  while (rollingSamples.length > 0 && (rollingSamples[0]?.timestamp ?? 0) < fiveMinutesAgo) {
    rollingSamples.shift();
  }
}

/**
 * Performs self-test on AES-256-GCM authenticated cipher.
 */
export function runCryptoSelfTest(): boolean {
  try {
    const testPayload = "Klassa Diagnostic Self-Test " + Date.now();
    const encrypted = encryptNarrative(testPayload);
    const decrypted = decryptNarrative(encrypted.ciphertext, encrypted.ivHex, encrypted.authTagHex);
    return testPayload === decrypted;
  } catch {
    return false;
  }
}

/**
 * Compiles a full system health report.
 */
export function getSystemHealthReport(database: DatabaseHealth = { status: "healthy", latencyMs: 0 }): SystemHealthReport {
  const now = Date.now();
  pruneRollingSamples(now);

  // Cryptography self-test
  const cryptoPassed = runCryptoSelfTest();
  const cryptoStatus: HealthStatus = cryptoPassed ? "healthy" : "unhealthy";

  // Memory usage
  const mem = process.memoryUsage ? process.memoryUsage() : { heapUsed: 50 * 1024 * 1024, heapTotal: 100 * 1024 * 1024, rss: 120 * 1024 * 1024 };
  const heapUsedMb = Math.round(mem.heapUsed / (1024 * 1024));
  const heapTotalMb = Math.round(mem.heapTotal / (1024 * 1024));
  const rssMb = Math.round(mem.rss / (1024 * 1024));
  const memoryStatus: HealthStatus = heapUsedMb > 1024 ? "degraded" : "healthy";

  // Rate Limiter
  const rateLimitMetrics = getRateLimitMetrics();
  const rateLimiterStatus: HealthStatus = rateLimitMetrics.totalViolationsRecorded > 50 ? "degraded" : "healthy";

  // Metrics calculation
  const totalRequests = rollingSamples.length;
  const errorCount = rollingSamples.filter((s) => s.isError).length;
  const rollingErrorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
  const totalDuration = rollingSamples.reduce((sum, s) => sum + s.durationMs, 0);
  const averageLatencyMs = totalRequests > 0 ? Math.round(totalDuration / totalRequests) : null;

  // Overall system status determination
  let overallStatus: HealthStatus = "healthy";
  if (!cryptoPassed) {
    overallStatus = "unhealthy";
  } else if (memoryStatus === "degraded" || rateLimiterStatus === "degraded" || activeIncidents.some((i) => i.severity === "critical")) {
    overallStatus = "degraded";
  }

  return {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    service: "gradia-klassa",
    version: "1.0.0-phase6",
    environment: process.env.NODE_ENV || "production",
    uptimeSeconds: Math.floor(process.uptime ? process.uptime() : 3600),
    checks: {
      database,
      cryptography: { status: cryptoStatus, selfTestPassed: cryptoPassed },
      memory: { status: memoryStatus, heapUsedMb, heapTotalMb, rssMb },
      rateLimiter: { status: rateLimiterStatus, trackedKeys: rateLimitMetrics.activeTrackedKeys, violations: rateLimitMetrics.totalViolationsRecorded },
    },
    metrics: {
      rollingRequestCount: totalRequests,
      rollingErrorCount: errorCount,
      rollingErrorRate: Math.round(rollingErrorRate * 10) / 10,
      averageLatencyMs,
    },
    telemetryAvailable: true,
    activeIncidents: [...activeIncidents],
  };
}

/**
 * Resets monitoring state (for tests).
 */
export function resetMonitoringMetrics(): void {
  rollingSamples.length = 0;
  activeIncidents.length = 0;
  failedDecryptionsCount = 0;
}
