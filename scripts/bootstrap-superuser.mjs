import { bootstrapAdmin } from "./bootstrap-admin.mjs";
import postgres from "postgres";

// Optional: try loading dotenv / @next/env if available locally, but ignore if not found
try {
  const nextEnv = await import("@next/env");
  const load = nextEnv.default?.loadEnvConfig || nextEnv.loadEnvConfig;
  if (typeof load === "function") {
    load(process.cwd());
  }
} catch {
  // Not required in container environment where process.env is injected by Docker
}

if (process.env.KLASSO_DEMO_MODE === "true") {
  console.log("[bootstrap] Demo mode active. Skipping real superuser bootstrap.");
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("[bootstrap] DATABASE_URL is required.");
  process.exit(1);
}

const client = postgres(databaseUrl, { max: 1 });

try {
  const result = await bootstrapAdmin(client);
  console.log(result.created ? "[bootstrap] Platform administrator created. Sign in and enroll your authenticator." : "[bootstrap] A platform administrator already exists; bootstrap skipped.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown bootstrap error.";
  console.error(`[bootstrap] Error: ${message}`);
  process.exitCode = 1;
} finally {
  delete process.env.KLASSO_BOOTSTRAP_PASSWORD;
  await client.end();
}

