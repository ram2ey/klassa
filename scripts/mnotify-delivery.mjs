const digits = value => String(value ?? "").replace(/\D/g, "");

/** Each request contains one recipient; a mismatched report never proves delivery. */
export function deliveryOutcome(payload, recipientPhone) {
  if (payload?.status !== "success" || !Array.isArray(payload.report) || payload.report.length !== 1) return "unknown";
  const report = payload.report[0];
  if (digits(report?.recipient) !== digits(recipientPhone)) return "unknown";
  const status = String(report?.status ?? "").toUpperCase();
  if (status === "DELIVERED") return "delivered";
  if (["FAILED", "REJECTED", "UNDELIVERED"].includes(status)) return "failed";
  return "pending";
}
