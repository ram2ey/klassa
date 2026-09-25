import { describe, expect, it } from "vitest";
import type { SystemHealthReport } from "@/lib/monitoring";
import { incidentSignals } from "./platform-incident-policy";

function report(requestCount: number, errorRate: number, cryptoPassed = true) {
  return { checks: { cryptography: { selfTestPassed: cryptoPassed } }, telemetryAvailable: true,
    metrics: { rollingRequestCount: requestCount, rollingErrorRate: errorRate } } as SystemHealthReport;
}

describe("persistent incident thresholds", () => {
  it("opens above 15% errors with at least ten requests", () => {
    expect(incidentSignals(report(9, 100)).open).toHaveLength(0);
    expect(incidentSignals(report(10, 15)).open).toHaveLength(0);
    expect(incidentSignals(report(10, 20)).open.map(signal => signal.code)).toContain("HIGH_ERROR_RATE");
  });

  it("recovers at 5% and holds state in the middle band", () => {
    expect(incidentSignals(report(20, 5)).recovered).toContain("HIGH_ERROR_RATE");
    const middle = incidentSignals(report(20, 10));
    expect(middle.open.some(signal => signal.code === "HIGH_ERROR_RATE")).toBe(false);
    expect(middle.recovered).not.toContain("HIGH_ERROR_RATE");
  });

  it("opens a critical incident for a failed cryptography self-test", () => {
    expect(incidentSignals(report(0, 0, false)).open).toContainEqual(expect.objectContaining({
      code: "CRYPTO_SELF_TEST_FAILED", severity: "critical",
    }));
    expect(incidentSignals(report(0, 0, true)).recovered).toContain("CRYPTO_SELF_TEST_FAILED");
  });
});
