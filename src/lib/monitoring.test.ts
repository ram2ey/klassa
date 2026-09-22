import { describe, it, expect, beforeEach } from "vitest";
import {
  getSystemHealthReport,
  runCryptoSelfTest,
  recordRequestMetric,
  recordDecryptionAttempt,
  resetMonitoringMetrics,
} from "./monitoring";

describe("Phase 6 Operational Monitoring Engine", () => {
  beforeEach(() => {
    resetMonitoringMetrics();
  });

  it("passes AES-256-GCM cipher self-test roundtrip", () => {
    const passed = runCryptoSelfTest();
    expect(passed).toBe(true);
  });

  it("generates a comprehensive system health report", () => {
    const report = getSystemHealthReport();

    expect(report.status).toBe("healthy");
    expect(report.service).toBe("gradia-klasso");
    expect(report.version).toContain("phase6");
    expect(report.uptimeSeconds).toBeGreaterThanOrEqual(0);
    expect(report.checks.cryptography.status).toBe("healthy");
    expect(report.checks.cryptography.selfTestPassed).toBe(true);
    expect(report.checks.database.status).toBe("healthy");
    expect(report.checks.memory.heapUsedMb).toBeGreaterThan(0);
  });

  it("calculates rolling error rates and tracks request latency", () => {
    recordRequestMetric("/api/v1/students", false, 15);
    recordRequestMetric("/api/v1/students", false, 25);
    recordRequestMetric("/api/v1/attendance", true, 40);

    const report = getSystemHealthReport();
    expect(report.metrics.rollingRequestCount).toBe(3);
    expect(report.metrics.rollingErrorRate).toBeCloseTo(33.3, 1);
    expect(report.metrics.averageLatencyMs).toBe(27);
  });

  it("detects cryptographic decryption tampering anomalies", () => {
    // 3 consecutive failed decryptions trigger an incident
    recordDecryptionAttempt(false, "case-999");
    recordDecryptionAttempt(false, "case-999");
    recordDecryptionAttempt(false, "case-999");

    const report = getSystemHealthReport();
    expect(report.activeIncidents.length).toBeGreaterThanOrEqual(1);
    expect(report.activeIncidents[0]?.code).toBe("CRYPTO_TAMPER_ALERT");
    expect(report.activeIncidents[0]?.severity).toBe("critical");
  });
});

