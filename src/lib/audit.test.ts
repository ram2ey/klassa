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
});
