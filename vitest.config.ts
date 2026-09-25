import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { include: ["src/**/*.{test,spec}.{ts,tsx}"], environment: "jsdom", globals: true, env: {
    KLASSO_DEMO_MODE: "true",
    SENSITIVE_RECORD_ENCRYPTION_KEY: "test-only-narrative-key-not-for-deployment-0123456789",
  } },
  resolve: { alias: { "@": path.resolve(__dirname, "./src") } },
});
