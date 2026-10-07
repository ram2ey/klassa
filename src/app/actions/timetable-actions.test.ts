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


describe("timetable release boundary", () => {
  it("authorizes the caller and rejects timetable writes before the service runs", async () => {
    mocks.requireStaff.mockResolvedValue({ userId: "admin", organizationId: "school", role: "school_admin" });
    await expect(saveTimetablePeriodAction({ classId: "11111111-1111-4111-8111-111111111111", dayOfWeek: "monday", period: "period_1", startTime: "08:50", endTime: "09:40" })).rejects.toThrow("not included");
    await expect(deleteTimetablePeriodAction({ periodId: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow("not included");
    expect(mocks.saveTimetablePeriod).not.toHaveBeenCalled();
    expect(mocks.deleteTimetablePeriod).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
  it("does not bypass authorization for a deferred feature", async () => {
    mocks.requireStaff.mockRejectedValue(new Error("Access denied"));
    await expect(deleteTimetablePeriodAction({ periodId: "11111111-1111-4111-8111-111111111111" })).rejects.toThrow("Access denied");
  });
});
