import { describe, expect, it } from "vitest";
import { buildTeacherSafetyNotices } from "@/lib/teacher-safety";

const now = new Date("2026-09-25T12:00:00Z");
const alert = {
  id: "alert-1", studentId: "assigned", category: "safety", severity: "urgent" as const,
  directiveSummary: "Child protective services investigation: allow a quiet break.",
  actionRequired: "Contact CPS if the student requests help.", isActive: true, expiresAt: null,
};
const restriction = {
  studentId: "assigned", prohibitPickup: true, isEnforced: true,
  effectiveDate: "2026-09-01", expirationDate: "2026-09-30",
};

describe("teacher safety notices", () => {
  it("returns only assigned, active and current information with redacted directives", () => {
    const result = buildTeacherSafetyNotices(["assigned"], [
      alert,
      { ...alert, id: "other", studentId: "other" },
      { ...alert, id: "inactive", isActive: false },
      { ...alert, id: "expired", expiresAt: new Date("2026-09-24T12:00:00Z") },
    ], [restriction, { ...restriction, studentId: "other" },
      { ...restriction, effectiveDate: "2026-09-26" },
      { ...restriction, expirationDate: "2026-09-24" }], now);

    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0]).toMatchObject({ id: "alert-1", studentId: "assigned" });
    expect(result.alerts[0].directiveSummary).not.toContain("Child protective services");
    expect(result.alerts[0].actionRequired).not.toContain("CPS");
    expect(result.alerts[0]).not.toHaveProperty("caseId");
    expect(result.pickupWarnings).toEqual(["assigned"]);
  });

  it("omits restrictions that are unenforced or do not prohibit pickup", () => {
    const result = buildTeacherSafetyNotices(["assigned"], [], [
      { ...restriction, isEnforced: false },
      { ...restriction, prohibitPickup: false },
    ], now);
    expect(result.pickupWarnings).toEqual([]);
  });
});
