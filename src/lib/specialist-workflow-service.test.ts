// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(), commit: vi.fn(), rollback: vi.fn() }));
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
import { saveSchoolWorkflow } from "@/lib/school-workflow-service";

const org = "00000000-0000-4000-8000-000000000001";
const record = "00000000-0000-4000-8000-000000000002";
const actor = { organizationId: org, userId: "nurse-a", name: "Nurse", role: "health_nurse" as const };
const caseRow = (area: string) => [record, org, record, "CASE-1", area, "confidential", "Case", "open", null,
  false, null, null, null, new Date(), new Date()];

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => query.includes('from "organizations"') ? [[org]] : []);
});

describe("live specialist workflow authorization", () => {
  it("rejects grades before opening a transaction", async () => {
    await expect(saveSchoolWorkflow(actor, { kind: "grade_entry", assessmentId: record, studentId: record,
      score: 80, feedback: "", correctionReason: "" })).rejects.toThrow("specialist role");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("prevents a nurse from creating a safeguarding case", async () => {
    await expect(saveSchoolWorkflow(actor, { kind: "sensitive_case", studentId: record, caseNumber: "CASE-1",
      area: "safeguarding", confidentialityTier: "confidential", title: "Concern" })).rejects.toThrow("case area");
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
  });
  it("lets a nurse create an audited medical case", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "students"')) return [[record]];
      if (query.startsWith('insert into "sensitive_cases"')) return [caseRow("health_medical")];
      if (query.startsWith('insert into "audit_events"')) return [[record, org, actor.userId, "sensitive_case.saved", "sensitive_case", record, null, {}, new Date()]];
      return [];
    });
    await expect(saveSchoolWorkflow(actor, { kind: "sensitive_case", studentId: record, caseNumber: "MED-1",
      area: "health_medical", confidentialityTier: "confidential", title: "Medical care plan" }))
      .resolves.toMatchObject({ entityId: record });
    const insert = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "sensitive_cases"'))!;
    expect(insert[1]).toContain(org);
    expect(insert[1]).toContain("health_medical");
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("prevents a nurse from adding notes to a SEN case", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "sensitive_cases"')) return [caseRow("special_needs")];
      return [];
    });
    await expect(saveSchoolWorkflow(actor, { kind: "sensitive_note", caseId: record, note: "Clinical note" })).rejects.toThrow("case area");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "sensitive_case_notes"'))).toBe(false);
  });
  it("prevents a nurse from decrypting another role's case notes", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "sensitive_cases"')) return [caseRow("safeguarding")];
      return [];
    });
    await expect(saveSchoolWorkflow(actor, { kind: "sensitive_access", caseId: record,
      accessReason: "Review concern" })).rejects.toThrow("case area");
    expect(mocks.execute.mock.calls.some(([query]) => query.includes('from "sensitive_case_notes"'))).toBe(false);
  });
  it("checks the linked case before resolving a directive", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "need_to_know_alerts"')) return [[record, org, record, record, "learning_support", "routine", "Summary", "Action", null, true, null, new Date(), new Date()]];
      if (query.includes('from "sensitive_cases"')) return [["special_needs"]];
      return [];
    });
    await expect(saveSchoolWorkflow(actor, { kind: "need_to_know_resolve", alertId: record,
      reason: "Resolved after review" })).rejects.toThrow("case area");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('update "need_to_know_alerts"'))).toBe(false);
  });
});
