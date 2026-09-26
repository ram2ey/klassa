// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<(query: string, params: unknown[]) => Promise<unknown[][]>>(),
  authorize: vi.fn(),
}));
vi.mock("@/lib/action-access", () => ({ requireGuardian: mocks.authorize }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(query: string, params: unknown[]) {
      const result = mocks.execute(query, params);
      return Object.assign(result, { values: () => result });
    },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { getGuardianPortalData } from "./guardian-portal-data";

const schoolId = "00000000-0000-4000-8000-000000000001";
const otherSchoolId = "00000000-0000-4000-8000-000000000002";
const guardianId = "00000000-0000-4000-8000-000000000003";
const studentId = "00000000-0000-4000-8000-000000000004";

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.authorize.mockReset().mockResolvedValue({
    userId: "guardian-user", name: "Guardian",
    guardians: [{ id: guardianId, organizationId: schoolId }],
  });
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "student_guardians"')) return [[guardianId, studentId, schoolId, "parent"]];
    if (query.includes('from "students"')) {
      return [[studentId, otherSchoolId, "Foreign", null, "Student", "ST-000001", "active"]];
    }
    return [];
  });
});

describe("guardian portal tenant boundary", () => {
  it("scopes student and enrollment reads and discards a mismatched school row", async () => {
    const result = await getGuardianPortalData();
    expect(result.students).toEqual([]);
    for (const table of ["students", "enrollments"]) {
      const call = mocks.execute.mock.calls.find(([query]) => query.includes(`from "${table}"`));
      expect(call).toBeDefined();
      expect(call![0]).toContain(`"${table}"."organization_id"`);
      expect(call![1]).toContain(schoolId);
      expect(call![1]).toContain(studentId);
    }
  });
});
