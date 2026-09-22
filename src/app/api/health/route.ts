import { getSystemHealthReport } from "@/lib/monitoring";

export async function GET() {
  return Response.json({ status: "ok", service: "klasso-web", timestamp: new Date().toISOString() });
  const report = getSystemHealthReport();
  const statusCode = report.status === "unhealthy" ? 503 : 200;

  return Response.json(report, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
