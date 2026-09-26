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
import { createSchoolGdprRequest, decideSchoolGdprRequest, generateSchoolGdprExtract } from "./school-gdpr-service";

const org = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const requestId = "00000000-0000-4000-8000-000000000003";
const cardId = "00000000-0000-4000-8000-000000000004";
const actor = { organizationId: org, userId: "admin-user", name: "Admin", role: "school_admin" as const };
const now = new Date("2026-09-26T10:00:00Z");
const requestRow = [requestId, org, studentId, "export", "pending", "Pat Parent", "guardian", "pat@example.com",
  "Please provide a student record extract", null, null, true, null, null, now, now];
const input = { studentId, requestType: "export" as const, requesterName: "Pat Parent",
  requesterRole: "guardian" as const, requesterEmail: "pat@example.com", justification: "Please provide a student record extract" };

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "gdpr_requests"')) return [requestRow];
    if (query.includes('from "students"')) return query.includes('"student_number"')
      ? [[studentId, "ST-1", null, "Ada", null, "Lee", null, new Date("2012-05-01T00:00:00Z"), "active"]] : [[studentId]];
    if (query.includes('from "organizations"')) return [["Northfield School"]];
    if (query.includes('from "enrollments"')) return [["2026/27", "7A", "active", new Date("2026-08-01T00:00:00Z"), null]];
    if (query.includes('from "attendance_records"')) return [[new Date("2026-09-26T00:00:00Z"), "morning_roll_call", "present", 0, null]];
    if (query.includes('from "report_cards"')) return [[cardId, "Autumn", 1, "88", "3.50", "96", now]];
    if (query.includes('from "report_card_subject_grades"')) return [[cardId, "Mathematics", "88", "B+"]];
    if (query.startsWith('insert into "gdpr_requests"')) return [[requestId]];
    if (query.startsWith('insert into "audit_events"')) return [[requestId, org, actor.userId, "gdpr.extract_generated", "gdpr_request", requestId, null, {}, now]];
    return [];
  });
});

describe("live school data rights requests", () => {
  it("requires school administrator access before touching the database", async () => {
    await expect(createSchoolGdprRequest({ ...actor, role: "teacher" }, input)).rejects.toThrow("administrator access required");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects a request for a student outside the selected school", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(createSchoolGdprRequest(actor, input)).rejects.toThrow("not found in your school");
    expect(mocks.execute.mock.calls[0][1]).toEqual([studentId, org]);
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it("records a request and its audit event atomically", async () => {
    await expect(createSchoolGdprRequest(actor, input)).resolves.toEqual({ requestId });
    const insert = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "gdpr_requests"'))!;
    expect(insert[1]).toEqual(expect.arrayContaining([org, studentId, "export", "Pat Parent", "pat@example.com", true]));
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "audit_events"'))).toBe(true);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("generates a school-scoped extract without sensitive or third-party records", async () => {
    const extract = await generateSchoolGdprExtract(actor, requestId);
    expect(extract.student).toMatchObject({ firstName: "Ada", lastName: "Lee" });
    expect(extract.attendance).toHaveLength(1);
    expect(extract.publishedReportCards[0].subjects).toEqual([{ subjectName: "Mathematics", scorePercentage: "88", letterGrade: "B+" }]);
    expect(JSON.stringify(extract)).not.toContain("Pat Parent");
    expect(JSON.stringify(extract)).not.toContain("sensitiveCases");
    const reportQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "report_cards"'))!;
    expect(reportQuery[1]).toEqual(expect.arrayContaining([org, studentId, "published"]));
    expect(mocks.execute.mock.calls.find(([query]) => query.includes('from "gdpr_requests"'))![1]).toEqual([requestId, org]);
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "audit_events"'))).toBe(true);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("requires a generated extract before an export request can be closed", async () => {
    await expect(decideSchoolGdprRequest(actor, { requestId, status: "completed", note: "Identity verified and extract delivered" }))
      .rejects.toThrow("Generate and review the extract");
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it("records a fulfilled decision and explanation in the same transaction", async () => {
    const original = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (query, params) => query.includes('from "gdpr_requests"')
      ? [[...requestRow.slice(0, 12), now, actor.userId, now, now]] : original(query, params));
    await expect(decideSchoolGdprRequest(actor, { requestId, status: "completed",
      note: "Identity verified and extract delivered" })).resolves.toEqual({ requestId, status: "completed" });
    const audit = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "audit_events"'))!;
    expect(audit[1]).toEqual(expect.arrayContaining([org, actor.userId, "gdpr.request_fulfilled", requestId]));
    expect(JSON.stringify(audit[1])).toContain("Identity verified and extract delivered");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("does not generate an extract from another school's request", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(generateSchoolGdprExtract(actor, requestId)).rejects.toThrow("not found in your school");
    expect(mocks.execute.mock.calls[0][1]).toEqual([requestId, org]);
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
  });
  it("rolls back a generated extract status change if auditing fails", async () => {
    const original = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.startsWith('insert into "audit_events"')) throw new Error("Audit unavailable");
      return original(query, params);
    });
    await expect(generateSchoolGdprExtract(actor, requestId)).rejects.toThrow();
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
