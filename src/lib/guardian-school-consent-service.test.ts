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
import { updateGuardianSchoolConsent } from "./guardian-school-consent-service";

const schoolId = "00000000-0000-4000-8000-000000000001";
const guardianId = "00000000-0000-4000-8000-000000000002";
const studentId = "00000000-0000-4000-8000-000000000003";
const consentId = "00000000-0000-4000-8000-000000000004";
const account = { userId: "guardian-user", name: "Guardian", guardians: [{ id: guardianId, organizationId: schoolId }] };
const input = { guardianId, schoolId, kind: "media" as const, granted: true };
const now = new Date("2026-09-26T12:00:00Z");

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear(); mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "guardians"')) return [[guardianId, "+3541234567"]];
    if (query.includes('from "student_guardians"')) return [[studentId]];
    if (query.includes('from "guardian_consents"')) return [];
    if (query.startsWith('insert into "guardian_consents"')) return [[consentId]];
    if (query.startsWith('insert into "audit_events"')) return [[consentId, schoolId, account.userId, "guardian.school_consent_updated", "guardian_consent", guardianId, null, {}, now]];
    return [];
  });
});

describe("guardian school consents", () => {
  it("rejects an unlinked guardian profile before opening a transaction", async () => {
    await expect(updateGuardianSchoolConsent(account, { ...input, guardianId: studentId })).rejects.toThrow("not linked to your account");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
  it("requires a legal-responsibility link in the same school", async () => {
    mocks.execute.mockImplementation(async query => query.includes('from "guardians"') ? [[guardianId, "+3541234567"]] : []);
    await expect(updateGuardianSchoolConsent(account, input)).rejects.toThrow("legal-responsibility link");
    const linkQuery = mocks.execute.mock.calls.find(([query]) => query.includes('from "student_guardians"'))!;
    expect(linkQuery[1]).toEqual(expect.arrayContaining([schoolId, guardianId, true]));
    expect(mocks.execute.mock.calls.every(([query]) => query.startsWith("select"))).toBe(true);
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it("grants media consent with an audited record", async () => {
    await expect(updateGuardianSchoolConsent(account, input)).resolves.toEqual({ changed: true, granted: true });
    const insert = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "guardian_consents"'))!;
    expect(insert[1]).toEqual(expect.arrayContaining([schoolId, guardianId, "+3541234567", true]));
    const audit = mocks.execute.mock.calls.find(([query]) => query.startsWith('insert into "audit_events"'))!;
    expect(audit[1]).toContain(consentId);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("revokes only the chosen school permission and preserves SMS preferences", async () => {
    mocks.execute.mockImplementation(async query => {
      if (query.includes('from "guardians"')) return [[guardianId, "+3541234567"]];
      if (query.includes('from "student_guardians"')) return [[studentId]];
      if (query.includes('from "guardian_consents"')) return [[consentId, schoolId, guardianId, "+3541234567", false, true, false, true, true, null, null, now, now]];
      if (query.startsWith('insert into "audit_events"')) return [[consentId, schoolId, account.userId, "guardian.school_consent_updated", "guardian_consent", guardianId, null, {}, now]];
      return [];
    });
    await expect(updateGuardianSchoolConsent(account, { ...input, granted: false })).resolves.toEqual({ changed: true, granted: false });
    const [query, params] = mocks.execute.mock.calls.find(([statement]) => statement.startsWith('update "guardian_consents"'))!;
    expect(query).toContain('"media_consent"');
    expect(query).not.toContain('"opt_in_sms');
    expect(query).not.toContain('"excursion_consent"');
    expect(params).toContain(false);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("rolls back when the audit insert fails", async () => {
    const original = mocks.execute.getMockImplementation()!;
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.startsWith('insert into "audit_events"')) throw new Error("Audit unavailable");
      return original(query, params);
    });
    await expect(updateGuardianSchoolConsent(account, input)).rejects.toThrow();
    expect(mocks.rollback).toHaveBeenCalledOnce();
    expect(mocks.commit).not.toHaveBeenCalled();
  });
});
