import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ insert: vi.fn() }));
vi.mock("@/db", () => ({ db: { insert: mocks.insert } }));
import { logAuditEvent } from "./audit";
const event = { organizationId: "school-a", actorUserId: "staff-a", action: "student.created", entityType: "student", entityId: "student-a" };
afterEach(() => { vi.unstubAllEnvs(); mocks.insert.mockReset(); });

describe("audit durability", () => {
  it("never connects to a real database in demo mode", async () => {
    vi.stubEnv("KLASSO_DEMO_MODE", "true");
    await logAuditEvent(event);
    expect(mocks.insert).not.toHaveBeenCalled();
  });
  it("propagates failed writes instead of reporting success", async () => {
    vi.stubEnv("KLASSO_DEMO_MODE", "false");
    mocks.insert.mockReturnValue({ values: () => ({ returning: async () => { throw new Error("Database offline"); } }) });
    await expect(logAuditEvent(event)).rejects.toThrow("Database offline");
  });
  it("rejects an unexpectedly empty insert result", async () => {
    vi.stubEnv("KLASSO_DEMO_MODE", "false");
    mocks.insert.mockReturnValue({ values: () => ({ returning: async () => [] }) });
    await expect(logAuditEvent(event)).rejects.toThrow("Audit write failed");
  });
  it("writes platform events without attributing them to a school", async () => {
    vi.stubEnv("KLASSO_DEMO_MODE", "false");
    const values = vi.fn().mockReturnValue({ returning: async () => [{ id: "audit-platform", organizationId: null,
      actorUserId: "admin-a", action: "platform_admin.created", entityType: "user", entityId: "admin-b",
      requestId: null, metadata: {}, createdAt: new Date() }] });
    mocks.insert.mockReturnValue({ values });
    const result = await logAuditEvent({ organizationId: null, actorUserId: "admin-a",
      action: "platform_admin.created", entityType: "user", entityId: "admin-b" });
    expect(values).toHaveBeenCalledWith(expect.objectContaining({ organizationId: null }));
    expect(result.organizationId).toBeNull();
  });
});
