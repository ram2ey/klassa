// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), transaction: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requirePlatformAdmin: mocks.authorize }));
vi.mock("@/db", () => ({ db: { transaction: mocks.transaction } }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { publishPlatformAnnouncementAction } from "./platform-announcement-actions";

const input = { title: "Maintenance", content: "The service will be unavailable tonight." };
beforeEach(() => { mocks.authorize.mockReset(); mocks.transaction.mockReset(); });

describe("platform maintenance announcements", () => {
  it("checks platform access before starting a broadcast", async () => {
    mocks.authorize.mockRejectedValue(new Error("Platform administrator access required."));
    await expect(publishPlatformAnnouncementAction(input)).rejects.toThrow("Platform administrator access required");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("requires MFA before starting a broadcast", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: false });
    await expect(publishPlatformAnnouncementAction(input)).rejects.toThrow("Multi-factor");
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
  it("rejects an empty notice before starting a transaction", async () => {
    mocks.authorize.mockResolvedValue({ id: "admin", twoFactorEnabled: true });
    await expect(publishPlatformAnnouncementAction({ title: "Hi", content: "Short" })).rejects.toThrow();
    expect(mocks.transaction).not.toHaveBeenCalled();
  });
});
