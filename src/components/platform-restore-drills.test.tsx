import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlatformRestoreDrills } from "./platform-restore-drills";
import type { PlatformRestoreDrillData } from "@/lib/platform-restore-drills";

const drill = { id: "drill-1", organizationId: "school-1", schoolName: "Northfield School",
  drillDate: new Date("2026-09-26T10:00:00Z"), backupFilename: "backup.sql.gz", backupSizeBytes: 123456,
  checksumSha256: "a".repeat(64), checksumVerified: false, rpoHoursValidated: "1.50",
  rtoMinutesElapsed: 42, reconciledStudents: 20, reconciledGuardians: 30, reconciledCases: 2,
  status: "partial", operatorName: "Alex Admin", notes: "Two records need review" } as PlatformRestoreDrillData["drills"][number];

describe("platform disaster recovery drills view", () => {
  it("shows recorded result, integrity, recovery times, and reconciled counts", () => {
    const html = renderToStaticMarkup(<PlatformRestoreDrills data={{ drills: [drill] }} />);
    expect(html).toContain("Northfield School");
    expect(html).toContain("partial");
    expect(html).toContain("Not verified");
    expect(html).toContain("1.5 hours");
    expect(html).toContain("42 minutes");
    expect(html).toContain("20 students");
    expect(html).toContain("backup.sql.gz");
    expect(html).toContain("Two records need review");
  });
  it("explains when no drills have been recorded", () => {
    const html = renderToStaticMarkup(<PlatformRestoreDrills data={{ drills: [] }} />);
    expect(html).toContain("No restore drills have been recorded yet.");
  });
});
