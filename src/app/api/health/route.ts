import { getLiveSystemHealthReport } from "@/lib/live-health";

export async function GET() {
  const report = await getLiveSystemHealthReport();
  const statusCode = report.status === "unhealthy" ? 503 : 200;

  return Response.json(report, {
    status: statusCode,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Content-Type": "application/json",
    },
  });
}
