// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(), authorize: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requireStaff: mocks.authorize }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) { const result = mocks.execute(sql, params); return Object.assign(result, { values: () => result }); },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { getSpecialistData } from "@/lib/specialist-data";

const org = "00000000-0000-4000-8000-000000000001";
const caseId = "00000000-0000-4000-8000-000000000002";
beforeEach(() => {
  mocks.authorize.mockReset(); mocks.execute.mockReset();
  mocks.execute.mockImplementation(async query => query.includes('from "organizations"') ? [[org, "School A"]] : []);
});

describe("specialist dashboard data", () => {
  it("loads only nurse case areas and no court orders", async () => {
    mocks.authorize.mockResolvedValue({ organizationId: org, role: "health_nurse", userId: "nurse", name: "Nurse" });
    const data = await getSpecialistData();
    expect(data.areas).toEqual(["health_medical"]);
    const caseQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "sensitive_cases"'))!;
    expect(caseQuery[1]).toContain(org);
    expect(caseQuery[1]).toContain("health_medical");
    expect(caseQuery[1]).not.toContain("safeguarding");
    expect(mocks.execute.mock.calls.some(([query]) => query.includes('from "court_restrictions"'))).toBe(false);
  });
  it("loads the safeguarding lead's permitted areas and court orders", async () => {
    mocks.authorize.mockResolvedValue({ organizationId: org, role: "safeguarding_lead", userId: "lead", name: "Lead" });
    const data = await getSpecialistData();
    expect(data.areas).toEqual(["safeguarding", "health_medical", "disciplinary"]);
    const caseQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "sensitive_cases"'))!;
    expect(caseQuery[1]).not.toContain("special_needs");
    const courtQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "court_restrictions"'))!;
    expect(courtQuery[1]).toContain(org);
  });
  it("scopes notes, access history, and directives to permitted case IDs", async () => {
    mocks.authorize.mockResolvedValue({ organizationId: org, role: "senco", userId: "senco", name: "SENCO" });
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org, "School A"]];
      if (query.includes('from "sensitive_cases"')) return [[caseId, caseId, "SEN-1", "special_needs", "confidential", "Support plan", "open", new Date(), new Date()]];
      return [];
    });
    await getSpecialistData();
    for (const table of ["sensitive_case_notes", "sensitive_access_logs", "need_to_know_alerts"]) {
      const query = mocks.execute.mock.calls.find(([sql]) => sql.includes(`from "${table}"`))!;
      expect(query[1]).toContain(org);
      expect(query[1]).toContain(caseId);
    }
  });
  it("loads SEN profiles and reviews for the SENCO", async () => {
    mocks.authorize.mockResolvedValue({ organizationId: org, role: "senco", userId: "senco", name: "SENCO" });
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "organizations"')) return [[org, "School A"]];
      if (query.includes('from "sen_profiles"')) return [[caseId, org, caseId, null, "targeted", "Cognition", null, "Plan", null, "senco", 12, "2026-11-20", null, "active", new Date(), new Date()]];
      if (query.includes('from "sen_reviews"')) return [[caseId, org, caseId, caseId, "senco", "2026-09-26", "termly", "Dr. Bell", "Met", "Next", "targeted", "2026-11-20", null, new Date(), new Date()]];
      return [];
    });
    const data = await getSpecialistData();
    expect(data.senProfiles).toBeDefined();
    expect(data.senReviews).toBeDefined();
    expect(mocks.execute.mock.calls.some(([sql]) => sql.includes('from "sen_profiles"'))).toBe(true);
    expect(mocks.execute.mock.calls.some(([sql]) => sql.includes('from "sen_reviews"'))).toBe(true);
  });
});
