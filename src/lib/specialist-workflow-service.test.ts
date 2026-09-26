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
  it("prevents a nurse from compiling a statutory disclosure package", async () => {
    await expect(saveSchoolWorkflow(actor, {
      kind: "statutory_disclosure",
      studentId: record,
      recipientAgency: "Social Services",
      reason: "Section 47 inquiry",
    })).rejects.toThrow("specialist role");
  });
  it("lets a safeguarding lead compile an audited statutory disclosure package", async () => {
    const dslActor = { organizationId: org, userId: "dsl-1", name: "Safeguarding Lead", role: "safeguarding_lead" as const };
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org, "Northfield Academy", "northfield"]];
      if (query.includes('from "students"')) return [[record, org, "ST-100", null, "Ada", null, "Lovelace", null, "2010-01-01", "active", new Date(), new Date()]];
      if (query.includes('from "sensitive_cases"')) return [caseRow("safeguarding")];
      if (query.includes('from "court_restrictions"')) return [];
      if (query.startsWith('insert into "audit_events"')) return [[record, org, dslActor.userId, "disclosure_package.exported", "student", record, null, {}, new Date()]];
      return [];
    });
    const result = await saveSchoolWorkflow(dslActor, {
      kind: "statutory_disclosure",
      studentId: record,
      recipientAgency: "Reykjavik Child Protection Services",
      reason: "Statutory child protection case conference",
    });
    expect(result.disclosurePackage).toBeDefined();
    expect(result.disclosurePackage?.studentName).toBe("Ada Lovelace");
    expect(result.disclosurePackage?.schoolName).toBe("Northfield Academy");
    expect(result.disclosurePackage?.recipientAgency).toBe("Reykjavik Child Protection Services");
    expect(result.disclosurePackage?.digitalIntegrityChecksum).toHaveLength(16);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("prevents a SENCO from recording a clinic visit", async () => {
    const sencoActor = { organizationId: org, userId: "senco-1", name: "SENCO Lead", role: "senco" as const };
    await expect(saveSchoolWorkflow(sencoActor, {
      kind: "clinic_visit",
      studentId: record,
      category: "first_aid",
      symptoms: "Minor scrape",
      treatment: "Cleaned and bandaged",
      outcome: "returned_to_class",
      guardianNotified: false,
    })).rejects.toThrow("specialist role");
  });
  it("lets a nurse record an audited clinic visit", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "students"')) return [[record, org, "ST-100", null, "Ada", null, "Lovelace", null, "2010-01-01", "active", new Date(), new Date()]];
      if (query.startsWith('insert into "clinic_visits"')) return [[record, org, record, actor.userId, "first_aid", "Minor scrape", "Bandage", "returned_to_class", false, null, "2026-09-26", new Date(), new Date()]];
      if (query.startsWith('insert into "audit_events"')) return [[record, org, actor.userId, "clinic_visit.logged", "clinic_visit", record, null, {}, new Date()]];
      return [];
    });
    const result = await saveSchoolWorkflow(actor, {
      kind: "clinic_visit",
      studentId: record,
      category: "first_aid",
      symptoms: "Minor scrape",
      treatment: "Bandage applied",
      outcome: "returned_to_class",
      guardianNotified: false,
    });
    expect(result.entityId).toBe(record);
    expect(mocks.commit).toHaveBeenCalledOnce();
    const auditCall = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "audit_events"'));
    expect(auditCall).toBeDefined();
  });
});
