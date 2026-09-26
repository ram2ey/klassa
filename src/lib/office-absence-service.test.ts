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
import { reviewAndExcuseGuardianAbsence } from "./office-absence-service";

const org = "00000000-0000-4000-8000-000000000001";
const noteId = "00000000-0000-4000-8000-000000000002";
const studentId = "00000000-0000-4000-8000-000000000003";
const sessionId = "00000000-0000-4000-8000-000000000004";
const recordId = "00000000-0000-4000-8000-000000000005";
const actor = { organizationId: org, userId: "office-user", name: "Office", role: "office_staff" as const };
const now = new Date("2026-09-26T09:00:00Z");
const note = [noteId, org, noteId, studentId, "2026-09-26", "illness", "submitted", null, null, now, now];

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "guardian_absence_notes"')) return [note];
    if (query.includes('from "attendance_sessions"')) return [[sessionId]];
    if (query.includes('from "attendance_records"')) return [[recordId, "absent"]];
    if (query.startsWith('insert into "audit_events"')) return [[noteId, org, actor.userId, "guardian.absence_note_excused", "guardian_absence_note", noteId, null, {}, now]];
    return [];
  });
});

describe("review and excuse guardian absence", () => {
  it("requires an office role before accessing the database", async () => {
    await expect(reviewAndExcuseGuardianAbsence({ ...actor, role: "teacher" }, noteId)).rejects.toThrow("Office staff access required");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("rejects a note outside the office school", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(reviewAndExcuseGuardianAbsence(actor, noteId)).rejects.toThrow("not found in your school");
    expect(mocks.execute.mock.calls[0][1]).toEqual([noteId, org]);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
  });
  it("requires a submitted absent morning mark", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "guardian_absence_notes"')) return [note];
      if (query.includes('from "attendance_sessions"')) return [[sessionId]];
      if (query.includes('from "attendance_records"')) return [[recordId, "present"]];
      return [];
    });
    await expect(reviewAndExcuseGuardianAbsence(actor, noteId)).rejects.toThrow("single absent morning mark");
    const sessionQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "attendance_sessions"'))!;
    expect(sessionQuery[1]).toEqual(expect.arrayContaining([org, "2026-09-26", "morning_roll_call", "submitted"]));
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it("writes the correction, excused mark, reviewed note, and audit event in one transaction", async () => {
    await expect(reviewAndExcuseGuardianAbsence(actor, noteId)).resolves.toEqual({ noteId, attendanceRecordId: recordId });
    const queries = mocks.execute.mock.calls.map(([query]) => query);
    expect(queries[0]).toContain("for update");
    expect(queries[2]).toContain("for update");
    expect(queries).toEqual(expect.arrayContaining([
      expect.stringContaining('insert into "attendance_corrections"'),
      expect.stringContaining('update "attendance_records"'),
      expect.stringContaining('update "guardian_absence_notes"'),
      expect.stringContaining('insert into "audit_events"'),
    ]));
    const correction = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "attendance_corrections"'))!;
    expect(correction[1]).toEqual(expect.arrayContaining([org, recordId, studentId, "absent", "excused", actor.userId]));
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("rolls back the correction when the audit write fails", async () => {
    const original = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.startsWith('insert into "audit_events"')) throw new Error("audit unavailable");
      return original(query, params);
    });
    await expect(reviewAndExcuseGuardianAbsence(actor, noteId)).rejects.toThrow();
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
