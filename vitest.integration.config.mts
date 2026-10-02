import { defineConfig } from "vitest/config";
import path from "node:path";

if (!process.env.RLS_TEST_ADMIN_URL || !process.env.RLS_TEST_APP_URL) {
  throw new Error("Integration checks require RLS_TEST_ADMIN_URL and RLS_TEST_APP_URL for a migrated disposable database. They must not be skipped during release verification.");
}

export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    fileParallelism: false,
    environment: "node",
    hookTimeout: 30_000,
    testTimeout: 30_000,
    env: {
      DATABASE_URL: process.env.RLS_TEST_APP_URL,
      // Prefer the explicit restricted-role URL over deployment PG overrides.
      PGUSER: "", PGPASSWORD: "", SERVICE_USER_POSTGRES: "", SERVICE_PASSWORD_64_POSTGRES: "",
      KLASSO_DEMO_MODE: "false",
    },
  },
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "./src") } },
});
