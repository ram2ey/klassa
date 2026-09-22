import fs from "node:fs";
import path from "node:path";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "docs", "openapi.json");
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      return new Response(content, {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    return Response.json({ error: "OpenAPI specification file not found" }, { status: 404 });
  } catch {
    return Response.json({ error: "Failed to read OpenAPI specification" }, { status: 500 });
  }
}

