// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(), commit: vi.fn() }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) { const result = mocks.execute(sql, params); return Object.assign(result, { values: () => result }); },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> {
      const result = await operation(client); mocks.commit(); return result;
    },
  };
  return { db: drizzle(client as unknown as Sql) };
});
import { previewParentSmsRecipients, queueParentSmsAnnouncement } from "./parent-sms-service";

const org = "00000000-0000-4000-8000-000000000001";
const student = "00000000-0000-4000-8000-000000000002";
const g1 = "00000000-0000-4000-8000-000000000003";
const g2 = "00000000-0000-4000-8000-000000000004";
const g3 = "00000000-0000-4000-8000-000000000005";
const actor = { organizationId: org, userId: "office", name: "Office", role: "office_staff" as const };

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset(); mocks.commit.mockClear();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "organizations"')) return [[org]];
    if (query.includes('from "students"')) return [[student]];
    if (query.includes('from "student_guardians"')) return [
      [student, g1, "Ama", "Mensah", "020 123 4567", new Date("2026-01-01T00:00:00Z")],
      [student, g2, "Kojo", "Owusu", null, null],
      [student, g3, "Efua", "Asare", "+233241234567", new Date("2026-01-01T00:00:00Z")],
    ];
    if (query.includes('from "court_restrictions"')) return [];
    if (query.includes('from "guardian_consents"')) return [[g1, true], [g3, false]];
    if (query.startsWith('insert into "audit_events"')) return [["00000000-0000-4000-8000-000000000009", org, actor.userId,
      "parent_sms_announcement.queued", "sms_announcement", "campaign", null, {}, new Date()]];
    return [];
  });
});
afterEach(() => vi.unstubAllEnvs());

describe("school parent SMS", () => {
  const input = { scope: "whole_school" as const, targetId: "all", message: "School closes at noon today." };

  it("previews reachable numbers and counts missing or opted-out contacts", async () => {
    await expect(previewParentSmsRecipients(actor, input)).resolves.toEqual({ recipientCount: 1, unreachableCount: 2 });
    expect(mocks.commit).not.toHaveBeenCalled();
  });

  it("queues one announcement per reachable guardian and records the audit event", async () => {
    const result = await queueParentSmsAnnouncement(actor, { ...input, requestId: crypto.randomUUID() });
    expect(result).toMatchObject({ queuedCount: 1, unreachableCount: 2 });
    const queued = mocks.execute.mock.calls.filter(([query]) => query.startsWith('insert into "sms_dispatches"'));
    expect(queued).toHaveLength(1);
    expect(queued[0]?.[1]).toContain("announcement");
    expect(queued[0]?.[1]).toContain("queued");
    expect(mocks.execute.mock.calls.some(([query]) => query.startsWith('insert into "audit_events"'))).toBe(true);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("rejects invalid audience targets before looking up recipients", async () => {
    await expect(previewParentSmsRecipients(actor, { ...input, scope: "class", targetId: "outside-school" }))
      .rejects.toThrow("Choose a valid grade or class.");
    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
