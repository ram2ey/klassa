import { describe, expect, it, vi } from "vitest";
import {
  formatPeriodLabel,
  saveTimetablePeriod,
  deleteTimetablePeriod,
  TimetableError,
} from "./timetable-service";

describe("timetable service", () => {
  it("formats standard and custom period labels accurately", () => {
    expect(formatPeriodLabel("morning_roll_call")).toBe("Morning Roll Call");
    expect(formatPeriodLabel("period_1")).toBe("Period 1");
    expect(formatPeriodLabel("period_6")).toBe("Period 6");
    expect(formatPeriodLabel("science_lab_block")).toBe("Science Lab Block");
  });

  it("throws when start time is equal to or after end time", async () => {
    const mockActor = {
      userId: "user-1",
      organizationId: "org-1",
      role: "school_admin",
      name: "Admin",
      username: "admin",
      memberships: [],
    } as any;

    await expect(
      saveTimetablePeriod(mockActor, {
        classId: "11111111-1111-4111-8111-111111111111",
        dayOfWeek: "monday",
        period: "period_1",
        startTime: "10:00",
        endTime: "09:00",
      })
    ).rejects.toThrow(TimetableError);
  });

  it("validates time format with regex", async () => {
    const mockActor = {
      userId: "user-1",
      organizationId: "org-1",
      role: "school_admin",
      name: "Admin",
      username: "admin",
      memberships: [],
    } as any;

    await expect(
      saveTimetablePeriod(mockActor, {
        classId: "11111111-1111-4111-8111-111111111111",
        dayOfWeek: "monday",
        period: "period_1",
        startTime: "25:00",
        endTime: "26:00",
      })
    ).rejects.toThrow();
  });
});
