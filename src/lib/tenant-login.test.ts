// @vitest-environment node
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashPassword } from "better-auth/crypto";
import { loginUsername, schoolTenantIdSchema } from "./login-identity";

const state = vi.hoisted(() => ({ data: {} as Record<string, Record<string, unknown>[]> }));
vi.mock("better-auth/adapters/drizzle", async () => {
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return { drizzleAdapter: () => memoryAdapter(state.data) };
});
vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/runtime-config", () => ({
  getAuthBaseURL: () => "http://localhost:3000",
  requireSecret: () => "test-only-auth-secret-with-at-least-32-characters",
}));
import { getAuth } from "./auth";

let passwordHash: string;
beforeAll(async () => { passwordHash = await hashPassword("tenant-test-password"); });
beforeEach(() => {
  for (const key of Object.keys(state.data)) delete state.data[key];
  state.data.user = ["northfield", "southfield", "platform"].map((tenant, i) => ({
    id: `user-${i}`, name: "Alex", email: `${i}@accounts.klassa.invalid`, emailVerified: false,
    username: `${tenant}:alex`, displayUsername: "alex", twoFactorEnabled: i === 2, isPlatformAdmin: i === 2,
    mustChangePassword: true, createdAt: new Date(), updatedAt: new Date(),
  }));
  state.data.account = state.data.user.map(user => ({
    id: `credential-${user.id}`, userId: user.id, accountId: user.id,
    providerId: "credential", password: passwordHash, createdAt: new Date(), updatedAt: new Date(),
  }));
  state.data.session = []; state.data.verification = []; state.data.twoFactor = [];
});

function request(path: string, body: Record<string, unknown>) {
  return getAuth().handler(new Request(`http://localhost:3000/api/auth${path}`, {
    method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
    body: JSON.stringify(body),
  }));
}

describe("tenant username authentication", () => {
  it("signs into the selected tenant without requiring a phone or email verification", async () => {
    const response = await request("/sign-in/username", {
      username: loginUsername(" Northfield ", " ALEX "), password: "tenant-test-password",
    });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.user.id).toBe("user-0");
    expect(data.user.mustChangePassword).toBe(true);
  });

  it("requires MFA for platform administrators and leaves no authenticated session", async () => {
    const response = await request("/sign-in/username", {
      username: loginUsername("platform", "alex"), password: "tenant-test-password",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ twoFactorRedirect: true });
    expect(state.data.session).toHaveLength(0);
  });

  it("signs school staff in without MFA and blocks authenticator enrollment", async () => {
    const response = await request("/sign-in/username", {
      username: loginUsername("southfield", "alex"), password: "tenant-test-password",
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ user: { id: "user-1" } });
    const cookie = response.headers.getSetCookie().map(value => value.split(";")[0]).join("; ");
    const enrollment = await getAuth().handler(new Request("http://localhost:3000/api/auth/two-factor/enable", {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000", Cookie: cookie },
      body: JSON.stringify({ password: "tenant-test-password" }),
    }));
    expect(enrollment.status).toBe(403);
    expect(state.data.twoFactor).toHaveLength(0);
  });

  it.each([
    ["missing:alex", "tenant-test-password"],
    ["northfield:alex", "wrong-password"],
  ])("rejects an unknown tenant or incorrect password", async (username, password) => {
    const response = await request("/sign-in/username", { username, password });
    expect(response.status).toBe(401);
    expect(state.data.session).toHaveLength(0);
  });

  it("blocks alternate email login and self-service tenant username changes", async () => {
    expect((await request("/sign-in/email", { email: "0@accounts.klassa.invalid", password: "tenant-test-password" })).status).toBe(404);
    expect((await request("/update-user", { username: "southfield:admin" })).status).toBe(404);
  });

  it("rejects namespace injection and reserves the platform tenant", () => {
    expect(() => loginUsername("northfield:southfield", "alex")).toThrow();
    expect(() => loginUsername("northfield", "southfield:alex")).toThrow();
    expect(schoolTenantIdSchema.safeParse(" PLATFORM ").success).toBe(false);
    expect(loginUsername("platform", "admin")).toBe("platform:admin");
  });
});
