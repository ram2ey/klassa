import { afterEach, describe, expect, it, vi } from "vitest";
import { getAuthBaseURL, isDemoMode, requireSecret, validateProductionConfiguration } from "./runtime-config";

afterEach(() => vi.unstubAllEnvs());

describe("runtime security configuration", () => {
  it.each([undefined, "", "   "])("rejects an empty production auth URL (%s)", value => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", value);
    expect(getAuthBaseURL).toThrow("BETTER_AUTH_URL is required");
  });

  it("uses the configured HTTPS origin", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", " https://school.example.com/ ");
    expect(getAuthBaseURL()).toBe("https://school.example.com");
  });

  it.each(["http://school.example.com", "invalid", "https://school.example.com/login", "https://user:pass@school.example.com", "https://school.example.com?x=1", "https://school.example.com#x"])("rejects an invalid production auth origin (%s)", value => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("BETTER_AUTH_URL", value);
    expect(getAuthBaseURL).toThrow();
  });

  it("allows a local development fallback", () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("BETTER_AUTH_URL", "");
    expect(getAuthBaseURL()).toBe("http://localhost:3000");
  });

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
