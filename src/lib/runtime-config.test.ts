import { afterEach, describe, expect, it, vi } from "vitest";
import { isDemoMode, requireSecret, validateProductionConfiguration } from "./runtime-config";

afterEach(() => vi.unstubAllEnvs());

describe("runtime security configuration", () => {
  it("requires explicit demo opt-in and refuses it in production", () => {
    vi.stubEnv("KLASSO_DEMO_MODE", "false");
    expect(isDemoMode()).toBe(false);
    vi.stubEnv("KLASSO_DEMO_MODE", "true");
    vi.stubEnv("NODE_ENV", "production");
    expect(isDemoMode()).toBe(false);
    expect(validateProductionConfiguration).toThrow("Demo mode");
  });

  it.each([undefined, "short", "replace-with-at-least-32-random-bytes",
    "fallback-development-secret-minimum-32-chars-length"])("rejects missing or unsafe secrets (%s)", value => {
    vi.stubEnv("BETTER_AUTH_SECRET", value);
    expect(() => requireSecret("BETTER_AUTH_SECRET")).toThrow();
  });

  it("requires independent narrative configuration", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("KLASSO_DEMO_MODE", "false");
    vi.stubEnv("BETTER_AUTH_SECRET", "test-secret-for-authentication-0123456789");
    vi.stubEnv("SENSITIVE_RECORD_ENCRYPTION_KEY", undefined);
    expect(validateProductionConfiguration).toThrow("SENSITIVE_RECORD_ENCRYPTION_KEY");
  });
});
