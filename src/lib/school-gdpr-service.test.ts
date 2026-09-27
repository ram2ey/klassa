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
import { createSchoolGdprRequest, decideSchoolGdprRequest } from "./school-gdpr-service";

const org = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const actor = { organizationId: org, userId: "admin-user", name: "Admin", role: "school_admin" as const };
const now = new Date("2026-09-26T10:00:00Z");
const requestRow = [requestId, org, studentId, "rectify", "pending", "Pat Parent", "guardian", "pat@example.com",
  "Please correct the pupil record", null, null, null, true, null, null, now, now];
const input = { studentId, requestType: "rectify" as const, requesterName: "Pat Parent",
  requesterRole: "guardian" as const, requesterEmail: "pat@example.com", justification: "Please correct the pupil record" };

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "gdpr_requests"')) return [requestRow];
    if (query.includes('from "students"')) return [[studentId]];
    if (query.startsWith('insert into "gdpr_requests"')) return [[requestId]];
    if (query.startsWith('insert into "audit_events"')) return [[requestId]];
    return [];
  });
});

describe("school privacy request ledger", () => {
  it("requires administrator access and school scope", async () => {
    await expect(createSchoolGdprRequest({ ...actor, role: "teacher" }, input)).rejects.toThrow("administrator access required");
    expect(mocks.execute).not.toHaveBeenCalled();
    mocks.execute.mockResolvedValue([]);
    await expect(createSchoolGdprRequest(actor, input)).rejects.toThrow("not found in your school");
    expect(mocks.execute.mock.calls[0][1]).toEqual([studentId, org]);
  });

  it("records a request and audit entry in one transaction", async () => {
    await expect(createSchoolGdprRequest(actor, input)).resolves.toEqual({ requestId });
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "gdpr_requests"'))).toBe(true);
    expect(mocks.execute.mock.calls.some(([query, params]) => query.startsWith('insert into "audit_events"') && params.includes("privacy.request_recorded"))).toBe(true);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("records a decision without changing the pupil record", async () => {
    await expect(decideSchoolGdprRequest(actor, { requestId, status: "completed",
      note: "Identity checked; school office corrected the record" })).resolves.toEqual({ requestId, status: "completed" });
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('update "gdpr_requests"'))).toBe(true);
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('update "students"'))).toBe(false);
    expect(mocks.execute.mock.calls.some(([query, params]) => query.startsWith('insert into "audit_events"') && params.includes("privacy.decision_recorded"))).toBe(true);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("keeps erasure open and rolls back if audit recording fails", async () => {
    const original = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (query, params) => query.includes('from "gdpr_requests"')
      ? [[...requestRow.slice(0, 3), "anonymize", ...requestRow.slice(4)]] : original(query, params));
    await expect(decideSchoolGdprRequest(actor, { requestId, status: "completed",
      note: "Pending retention review" })).rejects.toThrow("retention and dependency review");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('update "gdpr_requests"'))).toBe(false);

    mocks.execute.mockReset().mockImplementation(async (query, params) => {
      if (query.startsWith('insert into "audit_events"')) throw new Error("Audit unavailable");
      return original(query, params);
    });
    await expect(decideSchoolGdprRequest(actor, { requestId, status: "rejected",
      note: "Identity could not be verified" })).rejects.toThrow("Failed query");
    expect(mocks.rollback).toHaveBeenCalledTimes(2);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
