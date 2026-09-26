// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  authorize: vi.fn(), commit: vi.fn(), rollback: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requireStaff: mocks.authorize }));
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
import { saveSchoolRecord } from "./school-admin-service";
import { getSchoolAdminData } from "./school-admin-data";

const org = "00000000-0000-4000-8000-000000000001";
const record = "00000000-0000-4000-8000-000000000002";
const other = "00000000-0000-4000-8000-000000000003";
const actor = { organizationId: org, userId: "school-admin", name: "Admin", role: "school_admin" as const };
const now = "2026-09-25T12:00:00.000Z";
beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.authorize.mockReset().mockResolvedValue(actor);
  mocks.execute.mockImplementation(async query => query.includes('from "organizations"') ? [[org]] : []);
});
afterEach(() => vi.unstubAllEnvs());

describe("live school administration boundaries", () => {
  it("rejects a non-administrator before any database operation", async () => {
    await expect(saveSchoolRecord({ ...actor, role: "teacher" }, { kind: "settings", name: "School" })).rejects.toThrow("cannot change");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("requires school administrator authorization and scopes every dashboard query", async () => {
    await getSchoolAdminData();
    expect(mocks.authorize).toHaveBeenCalledWith(["school_admin"]);
    for (const [query, params] of mocks.execute.mock.calls) {
      expect(query).toContain("where");
      expect(params).toContain(org);
    }
    const staffQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "organization_memberships"'))![0];
    expect(staffQuery).not.toContain('"password"');
    expect(staffQuery).not.toContain('"phone_number"');
  });
  it("rejects a guardian relationship to a student outside the current school", async () => {
    await expect(saveSchoolRecord(actor, { kind: "guardian_link", studentId: record, guardianId: other,
      relationship: "parent", isPrimary: true, hasLegalResponsibility: true })).rejects.toThrow("Student was not found");
    const [query, params] = mocks.execute.mock.calls[1];
    expect(query).toContain('"students"."organization_id"');
    expect(params).toEqual([record, org]);
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
  });
  it("rejects a foreign academic year before creating a class", async () => {
    await expect(saveSchoolRecord(actor, { kind: "class", name: "7A", academicYearId: record, gradeLevelId: other })).rejects.toThrow("Academic year was not found");
    expect(mocks.execute.mock.calls[1][1]).toEqual([record, org]);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("rejects a subject assignment when its class is outside the school", async () => {
    await expect(saveSchoolRecord(actor, { kind: "teacher_subject_assignment", classId: record, subjectId: other,
      teacherId: "teacher-a" })).rejects.toThrow("Class was not found");
    expect(mocks.execute.mock.calls[1][1]).toEqual([record, org]);
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("requires an active teacher membership before assigning a subject", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "classes"') || query.includes('from "subjects"')) return [[record]];
      if (query.includes('from "organization_memberships"')) return [["office_staff"]];
      return [];
    });
    await expect(saveSchoolRecord(actor, { kind: "teacher_subject_assignment", classId: record, subjectId: other,
      teacherId: "office-a" })).rejects.toThrow("teacher role");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "teacher_class_assignments"'))).toBe(false);
  });
  it("creates an audited class and subject assignment", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "classes"') || query.includes('from "subjects"')) return [[record]];
      if (query.includes('from "organization_memberships"')) return [["teacher"]];
      if (query.startsWith('insert into "teacher_class_assignments"')) return [[other]];
      if (query.startsWith('insert into "audit_events"')) return [[record]];
      return [];
    });
    await expect(saveSchoolRecord(actor, { kind: "teacher_subject_assignment", classId: record, subjectId: other,
      teacherId: "teacher-a" })).resolves.toEqual({ entityId: other });
    const insert = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "teacher_class_assignments"'))!;
    expect(insert[1]).toEqual(expect.arrayContaining([org, record, other, "teacher-a", false]));
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "audit_events"'))).toBe(true);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("prevents duplicate class, subject, and teacher assignments", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "classes"') || query.includes('from "subjects"')) return [[record]];
      if (query.includes('from "organization_memberships"')) return [["teacher"]];
      if (query.includes('from "teacher_class_assignments"')) return [[other]];
      return [];
    });
    await expect(saveSchoolRecord(actor, { kind: "teacher_subject_assignment", classId: record, subjectId: other,
      teacherId: "teacher-a" })).rejects.toThrow("already has");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "teacher_class_assignments"'))).toBe(false);
  });
  it("cannot remove a homeroom assignment through the subject editor", async () => {
    mocks.execute.mockResolvedValueOnce([[org]]).mockResolvedValueOnce([[record, true]]);
    await expect(saveSchoolRecord(actor, { kind: "teacher_subject_assignment_remove", id: record })).rejects.toThrow("homeroom teachers");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('delete from "teacher_class_assignments"'))).toBe(false);
  });
  it("removes a subject assignment within the school", async () => {
    mocks.execute.mockResolvedValueOnce([[org]]).mockResolvedValueOnce([[record, false]])
      .mockResolvedValueOnce([]).mockResolvedValueOnce([[record]]);
    await expect(saveSchoolRecord(actor, { kind: "teacher_subject_assignment_remove", id: record })).resolves.toEqual({ entityId: record });
    const removal = mocks.execute.mock.calls.find(([query]) => query.startsWith('delete from "teacher_class_assignments"'))!;
    expect(removal[1]).toContain(org);
    expect(removal[1]).toContain(false);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("does not report an out-of-school guardian update as saved", async () => {
    await expect(saveSchoolRecord(actor, { kind: "guardian", id: record, firstName: "Alex", lastName: "Smith", email: "", phone: "" })).rejects.toThrow("Guardian was not found");
    const [query, params] = mocks.execute.mock.calls[1];
    expect(query).toMatch(/where \("guardians"\."id" = \$\d+ and "guardians"\."organization_id" = \$\d+\)/);
    expect(params.slice(-2)).toEqual([record, org]);
  });
  it("prevents an administrator from removing their own access", async () => {
    mocks.execute.mockResolvedValueOnce([[org]]).mockResolvedValueOnce([[record, org, actor.userId, "school_admin", now, now]]);
    await expect(saveSchoolRecord(actor, { kind: "staff_role", membershipId: record, role: "teacher" })).rejects.toThrow("another school administrator");
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
  });
  it("rejects terms outside the selected school's academic year", async () => {
    mocks.execute.mockResolvedValueOnce([[org]]).mockResolvedValueOnce([[record, org, "2026/27", "2026-08-01", "2027-06-30", true, now, now]]);
    await expect(saveSchoolRecord(actor, { kind: "term", name: "Autumn", academicYearId: record,
      startsOn: "2026-07-01", endsOn: "2026-12-20", position: 1 })).rejects.toThrow("within the academic year");
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("serializes current-year changes and rolls back when the audit write fails", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.startsWith('select')) return [[org]];
      if (query.startsWith('insert into "academic_years"')) return [[record]];
      if (query.startsWith('insert into "audit_events"')) throw new Error("Audit unavailable");
      return [];
    });
    await expect(saveSchoolRecord(actor, { kind: "year", name: "2026/27", startsOn: "2026-08-01", endsOn: "2027-06-30", isCurrent: true })).rejects.toMatchObject({ cause: expect.objectContaining({ message: "Audit unavailable" }) });
    expect(mocks.execute.mock.calls[0][0]).toContain("for update");
    const [query, params] = mocks.execute.mock.calls[1];
    expect(query).toContain('where "academic_years"."organization_id"');
    expect(params.at(-1)).toBe(org);
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("saves student status and current class placement in the same audited transaction", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "academic_years"')) return [[other, org, "2026/27", "2026-08-01", "2027-06-30", true, now, now]];
      if (query.includes('from "classes"') || query.includes('from "students"') || query.startsWith('update "students"')) return [[record]];
      if (query.startsWith('insert into "audit_events"')) return [[record, org, actor.userId, "student.saved", "student", record, null, {}, now]];
      return [];
    });
    await expect(saveSchoolRecord(actor, { kind: "student", id: record, firstName: "Ada", lastName: "Lovelace",
      dateOfBirth: "2014-01-01", status: "active", classId: record })).resolves.toEqual({ entityId: record });
    const enrollment = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "enrollments"'))!;
    expect(enrollment[0]).toContain("on conflict");
    expect(enrollment[1]).toContain(org);
    expect(enrollment[1]).toContain(other);
    expect(enrollment[1]).toContain("active");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
