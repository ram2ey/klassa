// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({ execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  authorize: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requireStaff: mocks.authorize }));
vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = { options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) { const result = mocks.execute(sql, params); return Object.assign(result, { values: () => result }); } };
  return { db: drizzle(client as unknown as Sql) };
});
import { getSchoolGdprData } from "./school-gdpr-data";

const org = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  mocks.execute.mockReset().mockResolvedValue([]);
  mocks.authorize.mockReset().mockResolvedValue({ organizationId: org, userId: "admin-user", role: "school_admin" });
});

describe("school data rights ledger", () => {
  it("requires the school administrator role and scopes the request query", async () => {
    await expect(getSchoolGdprData()).resolves.toEqual({ requests: [] });
    expect(mocks.authorize).toHaveBeenCalledWith(["school_admin"]);
    const [query, params] = mocks.execute.mock.calls[0];
    expect(query).toContain('"gdpr_requests"."organization_id" =');
    expect(query).toContain('"students"."organization_id"');
    expect(params).toContain(org);
    expect(query).toContain('order by "gdpr_requests"."created_at" desc');
  });
});
