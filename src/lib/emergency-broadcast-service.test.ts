// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  commit: vi.fn(), rollback: vi.fn() }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) { const result = mocks.execute(sql, params); return Object.assign(result, { values: () => result }); },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> {
      try { const result = await operation(client); mocks.commit(); return result; }
      catch (error) { mocks.rollback(); throw error; }
    },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { approveEmergencyBroadcast } from "./emergency-broadcast-service";

const org = "00000000-0000-4000-8000-000000000001";
const otherOrg = "00000000-0000-4000-8000-000000000002";
const broadcastId = "00000000-0000-4000-8000-000000000003";
const studentId = "00000000-0000-4000-8000-000000000004";
const actor = { organizationId: org, userId: "approver", name: "Office", role: "office_staff" as const };
const row = [broadcastId, org, "requester", null, null, "pending", "whole_school", "all", "lockdown",
  "Verified safety incident", "Please stay at home", [studentId], [], 1, new Date(), new Date()];

beforeEach(() => { mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => query.includes('from "emergency_broadcasts"') ? [row] : []); });

describe("second-staff emergency approval", () => {
  it("denies self-approval before queueing", async () => {
    await expect(approveEmergencyBroadcast({ ...actor, userId: "requester" }, broadcastId))
      .rejects.toThrow("different staff member");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "sms_dispatches"'))).toBe(false);
  });
  it("queries the broadcast inside the selected school", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(approveEmergencyBroadcast({ ...actor, organizationId: otherOrg }, broadcastId))
      .rejects.toThrow("already been reviewed");
    expect(mocks.execute.mock.calls[0][1]).toContain(otherOrg);
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "sms_dispatches"'))).toBe(false);
  });
  it("does not allow a second approval of an approved request", async () => {
    mocks.execute.mockImplementation(async query => query.includes('from "emergency_broadcasts"')
      ? [[...row.slice(0, 5), "approved", ...row.slice(6)]] : []);
    await expect(approveEmergencyBroadcast(actor, broadcastId)).rejects.toThrow("already been reviewed");
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
});
