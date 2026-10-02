import { defineConfig } from "@playwright/test";

if (!process.env.RLS_TEST_ADMIN_URL || !process.env.RLS_TEST_APP_URL) {
  throw new Error("Browser checks require owner and restricted-role URLs for a migrated disposable database.");
}

export default defineConfig({
  testDir: "./e2e",
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  use: { baseURL: "https://localhost:3107", ignoreHTTPSErrors: true, trace: "retain-on-failure" },
  webServer: {
    command: "node scripts/playwright-server.mjs",
    url: "https://localhost:3107/login",
    ignoreHTTPSErrors: true,
    timeout: 120_000,
    reuseExistingServer: false,
    env: {
      DATABASE_URL: process.env.RLS_TEST_APP_URL,
      PGUSER: "", PGPASSWORD: "", SERVICE_USER_POSTGRES: "", SERVICE_PASSWORD_64_POSTGRES: "",
      KLASSO_DEMO_MODE: "false",
      BETTER_AUTH_URL: "https://localhost:3107",
      BETTER_AUTH_SECRET: "IntegrationOnlyAuthSecret123456789012345",
      SENSITIVE_RECORD_ENCRYPTION_KEY: "IntegrationOnlyRecordKey123456789012345",
    },
  },
});
