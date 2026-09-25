// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  authorize: vi.fn(), commit: vi.fn(), rollback: vi.fn(),
}));
vi.mock("@/lib/action-access", () => ({ requireStaff: mocks.authorize }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  // Exercise Drizzle's real SQL generation without opening a database connection.
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) {
      const result = mocks.execute(sql, params);
      return Object.assign(result, { values: () => result });
    },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> {
      try { const result = await operation(client); mocks.commit(); return result; }
      catch (error) { mocks.rollback(); throw error; }
    },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { createLiveStudent, listLiveStudents, updateLiveStudentStatus } from "./live-roster";

const organizationId = "00000000-0000-0000-0000-000000000002";
beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.authorize.mockResolvedValue({ organizationId, userId: "verified-staff", role: "school_admin", name: "Verified Staff" });
});
afterEach(() => vi.unstubAllEnvs());

describe("live roster SQL and transaction boundaries", () => {
  it("scopes reads to the authenticated school", async () => {
    mocks.execute.mockResolvedValue([]);
    await listLiveStudents();
    const [sql, params] = mocks.execute.mock.calls[0];
    expect(sql).toContain('where "students"."organization_id" =');
    expect(params).toEqual([organizationId]);
  });
  it("includes both school and student number in updates and rolls back when auditing fails", async () => {
    mocks.execute.mockImplementation(async sql => {
      if (sql.startsWith('update "students"')) return [["student-uuid"]];
      throw new Error("Audit storage unavailable");
    });
    await expect(updateLiveStudentStatus("SHARED-NUMBER", "Active")).rejects.toThrow();
    const [sql, params] = mocks.execute.mock.calls[0];
    expect(sql).toMatch(/where \("students"\."organization_id" = \$\d+ and "students"\."student_number" = \$\d+\)/);
    expect(params.slice(-2)).toEqual([organizationId, "SHARED-NUMBER"]);
    expect(mocks.execute.mock.calls[1][0]).toContain('insert into "audit_events"');
    expect(mocks.execute.mock.calls[1][1]).toContain("verified-staff");
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("does not report a missing student as successfully updated", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(updateLiveStudentStatus("MISSING", "Pending")).rejects.toThrow("Student not found");
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("does not insert a student without an unambiguous enrollment in the authenticated school", async () => {
    mocks.execute.mockResolvedValue([]);
    await expect(createLiveStudent({ firstName: "Ada", lastName: "Lovelace",
      dateOfBirth: "2014-01-01", gradeLevel: "Grade 7", className: "7B" })).rejects.toThrow("existing class");
    expect(mocks.execute).toHaveBeenCalledOnce();
    expect(mocks.execute.mock.calls[0][1].filter(value => value === organizationId)).toHaveLength(3);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
