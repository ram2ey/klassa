// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), select: vi.fn(), audit: vi.fn(), client: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requirePlatformAdmin: mocks.authorize }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: mocks.audit }));
vi.mock("@/db", () => ({ db: { select: mocks.select }, databaseClient: mocks.client }));
import { GET } from "./route";

const id = "00000000-0000-4000-8000-000000000001";
const call = (schoolId = id) => GET(new Request(`https://example.test/platform/schools/${schoolId}/export`),
  { params: Promise.resolve({ id: schoolId }) });

beforeEach(() => { mocks.authorize.mockReset(); mocks.select.mockReset(); mocks.audit.mockReset(); mocks.client.mockReset(); });

describe("school data export", () => {
  it("requires platform authorization before reading school data", async () => {
    mocks.authorize.mockRejectedValue(new Error("Platform administrator access required."));
    await expect(call()).rejects.toThrow("Platform administrator access required");
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("requires MFA before reading school data", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: false });
    expect((await call()).status).toBe(403);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("rejects malformed school ids before querying", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: true });
    expect((await call("invalid")).status).toBe(400);
    expect(mocks.select).not.toHaveBeenCalled();
  });
  it("returns an audited tenant-scoped JSON download", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: true });
    mocks.select.mockImplementationOnce(() => ({ from: () => ({ where: async () => [{ id, name: "School A" }] }) }));
    mocks.select.mockImplementationOnce(() => ({ from: () => ({ innerJoin: () => ({ where: async () =>
      [{ id: "staff-a", name: "Teacher A", role: "teacher" }] }) }) }));
    mocks.client.mockImplementation((first: string | TemplateStringsArray) => {
      if (typeof first === "string") return { identifier: first };
      if (first[0].includes("information_schema")) return [{ table_name: "students" }];
      return [{ id: "student-a", organization_id: id }];
    });
    const response = await call();
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Disposition")).toContain(`klassa-school-${id}.json`);
    const body = await response.json();
    expect(body.school.name).toBe("School A");
    expect(body.staff[0].name).toBe("Teacher A");
    expect(body.tables.students[0].organization_id).toBe(id);
    expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ action: "platform.school_exported",
      organizationId: id }));
  });
});
