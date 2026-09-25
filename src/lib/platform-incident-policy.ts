import type { SystemHealthReport } from "@/lib/monitoring";

export type IncidentSignal = { code: string; title: string; severity: "warning" | "critical"; details: string };

/** Hysteresis keeps an error-rate incident open while the rate is between 5% and 15%. */
export function incidentSignals(report: SystemHealthReport) {
  const open: IncidentSignal[] = [];
  const recovered: string[] = [];

  if (!report.checks.cryptography.selfTestPassed) {
    open.push({ code: "CRYPTO_SELF_TEST_FAILED", title: "Cryptography self-test failed", severity: "critical",
      details: "The application could not complete its encryption and decryption self-test." });
  } else recovered.push("CRYPTO_SELF_TEST_FAILED");

  if (report.telemetryAvailable && report.metrics.rollingRequestCount >= 10) {
    const rate = report.metrics.rollingErrorRate;
    if (rate > 15) open.push({ code: "HIGH_ERROR_RATE", title: "Application error rate is high", severity: "warning",
      details: `The five-minute error rate is ${rate.toFixed(1)}% across ${report.metrics.rollingRequestCount} requests.` });
    else if (rate <= 5) recovered.push("HIGH_ERROR_RATE");
  }

  return { open, recovered };
}
