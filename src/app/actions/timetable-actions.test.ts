// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireStaff: vi.fn(),
  saveTimetablePeriod: vi.fn(),
  deleteTimetablePeriod: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/action-access", () => ({
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/lib/timetable-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/timetable-service")>(
    "@/lib/timetable-service"
  );
  return {
    ...actual,
    saveTimetablePeriod: mocks.saveTimetablePeriod,
    deleteTimetablePeriod: mocks.deleteTimetablePeriod,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  saveTimetablePeriodAction,
  deleteTimetablePeriodAction,
} from "./timetable-actions";

beforeEach(() => {
  mocks.requireStaff.mockReset();
  mocks.saveTimetablePeriod.mockReset();
  mocks.deleteTimetablePeriod.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("timetable actions", () => {
  describe("saveTimetablePeriodAction", () => {
    it("calls saveTimetablePeriod and revalidates path on success", async () => {
      mocks.requireStaff.mockResolvedValue({
        userId: "admin-1",
        organizationId: "org-1",
        role: "school_admin",
      });
      mocks.saveTimetablePeriod.mockResolvedValue({
        success: true,
        periodId: "p-1",
      });

      const result = await saveTimetablePeriodAction({
        classId: "11111111-1111-4111-8111-111111111111",
        dayOfWeek: "monday",
        period: "period_1",
        startTime: "08:50",
        endTime: "09:40",
      });

      expect(result).toEqual({ success: true, periodId: "p-1" });
      expect(mocks.saveTimetablePeriod).toHaveBeenCalledWith(
        expect.objectContaining({ organizationId: "org-1" }),
        expect.objectContaining({ period: "period_1" })
      );
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    });

    it("returns error on validation failure", async () => {
      mocks.requireStaff.mockResolvedValue({
        userId: "admin-1",
        organizationId: "org-1",
      });

      const result = await saveTimetablePeriodAction({
        classId: "not-a-uuid",
        dayOfWeek: "monday",
        period: "period_1",
        startTime: "08:50",
        endTime: "09:40",
      });

      expect(result.success).toBe(false);
      expect(mocks.saveTimetablePeriod).not.toHaveBeenCalled();
    });
  });

  describe("deleteTimetablePeriodAction", () => {
    it("calls deleteTimetablePeriod and revalidates path on success", async () => {
      mocks.requireStaff.mockResolvedValue({
        userId: "admin-1",
        organizationId: "org-1",
        role: "school_admin",
      });
      mocks.deleteTimetablePeriod.mockResolvedValue({ success: true });

      const result = await deleteTimetablePeriodAction({
        periodId: "11111111-1111-4111-8111-111111111111",
      });

      expect(result).toEqual({ success: true });
      expect(mocks.deleteTimetablePeriod).toHaveBeenCalled();
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    });
  });
});
