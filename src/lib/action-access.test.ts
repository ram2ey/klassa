import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ session: vi.fn(), user: vi.fn() }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: mocks.user }) }) }) } }));
import { requireDemoAction, requireStaff, requirePlatformAdmin } from "./action-access";

beforeEach(() => { vi.stubEnv("KLASSO_DEMO_MODE", "false"); mocks.session.mockReset(); mocks.user.mockReset(); });
afterEach(() => vi.unstubAllEnvs());

describe("server action authorization", () => {
  it("does not grant platform powers to a school administrator", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin", isPlatformAdmin: true } });
    mocks.user.mockResolvedValue([{ id: "admin", role: "school_admin", organizationId: "school-a", twoFactorEnabled: true, isPlatformAdmin: false }]);
    await expect(requirePlatformAdmin()).rejects.toThrow("Platform administrator");
  });
  it("requires membership in the selected school even if the legacy account role is admin", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin" }, session: { activeOrganizationId: "school-b" } });
    mocks.user.mockResolvedValueOnce([{ id: "admin", role: "school_admin", organizationId: "school-a", twoFactorEnabled: true }]).mockResolvedValueOnce([]);
    await expect(requireStaff(["school_admin"])).rejects.toThrow("Access denied");
  });
  it("uses the selected school's membership role", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin" }, session: { activeOrganizationId: "school-b" } });
    mocks.user.mockResolvedValueOnce([{ id: "admin", role: "school_admin", organizationId: "school-a", twoFactorEnabled: true }]).mockResolvedValueOnce([{ role: "teacher" }]);
    await expect(requireStaff(["school_admin"])).rejects.toThrow("Access denied");
  });
  it("rejects anonymous callers", async () => {
    mocks.session.mockResolvedValue(null);
    await expect(requireStaff(["school_admin"])).rejects.toThrow("Authentication required");
    expect(mocks.user).not.toHaveBeenCalled();
  });
  it("uses database role rather than session-supplied role", async () => {
    mocks.session.mockResolvedValue({ user: { id: "teacher", role: "school_admin" } });
    mocks.user.mockResolvedValue([{ id: "teacher", organizationId: "school-a", role: "teacher", twoFactorEnabled: true }]);
    await expect(requireStaff(["school_admin"])).rejects.toThrow("Access denied");
  });
  it("allows school staff without MFA when their membership is valid", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin" } });
    mocks.user.mockResolvedValueOnce([{ id: "admin", organizationId: "school-a", role: "school_admin", twoFactorEnabled: false, isPlatformAdmin: false }])
      .mockResolvedValueOnce([{ role: "school_admin" }]);
    await expect(requireStaff(["school_admin"])).resolves.toMatchObject({ userId: "admin", organizationId: "school-a" });
  });
  it("requires MFA for platform administrators and membership for school access", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin" } });
    mocks.user.mockResolvedValue([{ id: "admin", organizationId: "school-a", role: "school_admin", twoFactorEnabled: false, isPlatformAdmin: true }]);
    await expect(requireStaff(["school_admin"])).rejects.toThrow("two-factor");
    await expect(requirePlatformAdmin()).rejects.toThrow("two-factor");
    mocks.user.mockResolvedValue([{ id: "admin", organizationId: null, role: "school_admin", twoFactorEnabled: true }]);
    await expect(requireStaff(["school_admin"])).rejects.toThrow("Access denied");
  });
  it("blocks fixture workflows even for authenticated administrators", async () => {
    mocks.session.mockResolvedValue({ user: { id: "admin" } });
    mocks.user.mockResolvedValue([{ id: "admin", organizationId: "school-a", role: "school_admin", twoFactorEnabled: true }]);
    await expect(requireDemoAction()).rejects.toThrow("Live support is not implemented");
  });
  it("does not authenticate the explicitly enabled local demo", async () => {
    vi.stubEnv("KLASSO_DEMO_MODE", "true");
    await requireDemoAction();
    expect(mocks.session).not.toHaveBeenCalled();
  });
});
