// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requirePlatformAdmin: mocks.authorize }));
vi.mock("@/db", () => ({ db: { select: mocks.select } }));
import { searchPlatformGuardiansAction } from "./platform-guardian-actions";

beforeEach(() => { mocks.authorize.mockReset(); mocks.select.mockReset(); });

describe("cross-school guardian search", () => {
  it("requires platform authorization before accessing guardians", async () => {
    mocks.authorize.mockRejectedValue(new Error("Platform administrator access required."));
    await expect(searchPlatformGuardiansAction("Alice")).rejects.toThrow("Platform administrator access required");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("requires MFA before accessing guardians", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: false });
    await expect(searchPlatformGuardiansAction("Alice")).rejects.toThrow("Multi-factor");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects broad one-character queries", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: true });
    await expect(searchPlatformGuardiansAction("A")).rejects.toThrow();
    expect(mocks.select).not.toHaveBeenCalled();
  });
});
