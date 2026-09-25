import { describe, expect, it } from "vitest";
import { formatGMTDateTime, SCHOOL_TIME_ZONE } from "./timezone";
import { schoolCommandSchema } from "./school-admin-policy";

describe("fixed GMT timezone", () => {
  it("keeps summer and winter timestamps at UTC+0", () => {
    expect(SCHOOL_TIME_ZONE).toBe("Etc/GMT");
    expect(formatGMTDateTime("2026-06-01T12:00:00Z")).toContain("12:00 GMT");
    expect(formatGMTDateTime("2026-12-01T12:00:00Z")).toContain("12:00 GMT");
  });
  it("does not accept a school timezone override in settings", () => {
    const parsed = schoolCommandSchema.parse({ kind: "settings", name: "School", timezone: "Europe/London" });
    expect(parsed).toEqual({ kind: "settings", name: "School" });
  });
});
