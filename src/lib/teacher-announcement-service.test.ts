// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>() }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) { const result = mocks.execute(sql, params); return Object.assign(result, { values: () => result }); },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> { return operation(client); },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { saveSchoolWorkflow } from "@/lib/school-workflow-service";

const org = "00000000-0000-4000-8000-000000000001";
const klass = "00000000-0000-4000-8000-000000000002";
const actor = { organizationId: org, userId: "teacher-a", name: "Teacher", role: "teacher" as const };
const command = { kind: "announcement" as const, title: "Class trip", content: "Please bring a coat.",
  targetType: "class" as const, targetId: klass, priority: "normal" as const, status: "published" as const };

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset().mockImplementation(async query => {
    if (query.includes('from "organizations"')) return [[org]];
    if (query.includes('from "classes"')) return [[null]];
    return [];
  });
});

describe("teacher class notices", () => {
  it("rejects an unassigned class before creating a notice", async () => {
    await expect(saveSchoolWorkflow(actor, command)).rejects.toThrow("not assigned");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "announcements"'))).toBe(false);
  });
  it("rejects school-wide notices from a teacher", async () => {
    await expect(saveSchoolWorkflow(actor, { ...command, targetType: "school", targetId: "all" })).rejects.toThrow("assigned class");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "announcements"'))).toBe(false);
  });
  it("permits a subject teacher to publish to an assigned class", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "teacher_class_assignments"')) return [[klass, org, actor.userId, klass, klass, false, new Date(), new Date()]];
      if (query.includes('from "classes"')) return [[null]];
      if (query.startsWith('insert into "announcements"')) return [[klass]];
      if (query.startsWith('insert into "audit_events"')) return [[klass]];
      return [];
    });
    await expect(saveSchoolWorkflow(actor, command)).resolves.toMatchObject({ entityId: klass });
    const insert = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "announcements"'))!;
    expect(insert[1]).toContain(klass);
    expect(insert[1]).toContain("class");
  });
});
