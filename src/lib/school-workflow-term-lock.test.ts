// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>() }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) {
      const result = mocks.execute(sql, params);
      return Object.assign(result, { values: () => result });
    },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> { return operation(client); },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { saveSchoolWorkflow } from "./school-workflow-service";

const org = "00000000-0000-4000-8000-000000000001";
const termId = "00000000-0000-4000-8000-000000000002";
const studentId = "00000000-0000-4000-8000-000000000003";
const cardId = "00000000-0000-4000-8000-000000000004";
const yearId = "00000000-0000-4000-8000-000000000005";
const classId = "00000000-0000-4000-8000-000000000006";
const actor = { organizationId: org, userId: "admin", name: "Admin", role: "school_admin" as const };

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "organizations"')) return [[org]];
    if (query.includes('from "report_cards"')) return [[cardId, org, studentId, yearId, termId, classId, 1, "draft"]];
    if (query.includes('from "terms"')) {
      if (query.includes('"academic_year_id"')) return [[termId, org, yearId, "Autumn", "2026-09-01", "2026-12-15", 1, true]];
      return [[true, "Autumn"]];
    }
    return [];
  });
});

describe("closed term report cards", () => {
  it.each([
    { kind: "report_generate" as const, studentId, termId },
    { kind: "report_status" as const, reportCardId: cardId, status: "approved" as const },
    { kind: "report_remarks" as const, reportCardId: cardId, teacherRemarks: "Updated" },
  ])("rejects $kind after term closure", async command => {
    await expect(saveSchoolWorkflow(actor, command)).rejects.toThrow("closed and locked");
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
  });
});
