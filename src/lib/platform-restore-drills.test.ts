// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  authorize: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/action-access", () => ({ requirePlatformAdmin: mocks.authorize }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) { const result = mocks.execute(sql, params); return Object.assign(result, { values: () => result }); } };
  return { db: drizzle(client as unknown as Sql) };
});
import { getPlatformRestoreDrillData } from "./platform-restore-drills";

const org = "00000000-0000-4000-8000-000000000001";
const drillId = "00000000-0000-4000-8000-000000000002";
const date = new Date("2026-09-26T10:00:00Z");
beforeEach(() => {
  mocks.execute.mockReset().mockResolvedValue([[drillId, org, "Northfield School", date, "backup.sql.gz",
    123456, "a".repeat(64), true, "1.50", 42, 20, 30, 2, "passed", "Alex Admin", "Counts matched"]]);
  mocks.authorize.mockReset().mockResolvedValue({ id: "platform-admin" });
});

describe("platform restore drill data", () => {
  it("requires platform administration before loading drill records", async () => {
    mocks.authorize.mockRejectedValue(new Error("Platform administrator access required."));
    await expect(getPlatformRestoreDrillData()).rejects.toThrow("Platform administrator access required");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("loads the latest recorded verification metrics with school and operator labels", async () => {
    const result = await getPlatformRestoreDrillData();
    expect(mocks.authorize).toHaveBeenCalledOnce();
    expect(result.drills[0]).toMatchObject({ id: drillId, organizationId: org, schoolName: "Northfield School",
      checksumVerified: true, rpoHoursValidated: "1.50", rtoMinutesElapsed: 42,
      reconciledStudents: 20, reconciledGuardians: 30, reconciledCases: 2, operatorName: "Alex Admin" });
    const query = mocks.execute.mock.calls[0][0];
    expect(query).toContain('from "restore_drills"');
    expect(query).toContain('inner join "organizations"');
    expect(query).toContain('left join "users"');
    expect(query).toContain('order by "restore_drills"."drill_date" desc');
    expect(query).toContain("limit");
  });
});
