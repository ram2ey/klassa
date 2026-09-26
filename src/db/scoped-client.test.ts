// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Sql } from "postgres";
import { beginRlsContext, runWithRlsContext } from "./rls-context";
import { createScopedClient } from "./scoped-client";

type Call = { connection: number; query: string; params: unknown[] };

function fakeClient() {
  const calls: Call[] = [];
  let nextConnection = 0;
  const queryOn = (connection: number, query: string, params: unknown[] = []) => {
    calls.push({ connection, query, params });
    return Object.assign(Promise.resolve([{ ok: true }]), { values: () => Promise.resolve([[true]]) });
  };
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe: (query: string, params?: unknown[]) => queryOn(0, query, params),
    begin: async <T>(operation: (connection: { unsafe: (query: string, params?: unknown[]) => ReturnType<typeof queryOn> }) => Promise<T>) => {
      const connection = ++nextConnection;
      return operation({ unsafe: (query, params) => queryOn(connection, query, params) });
    },
  };
  return { client: createScopedClient(client as unknown as Sql), calls };
}

describe("database RLS scope", () => {
  it("sets transaction-local school scope on the same connection as a direct query", async () => {
    const { client, calls } = fakeClient();
    await runWithRlsContext({ organizationIds: ["school-a"], userId: "staff-a", platform: false },
      () => client.unsafe("select * from students", []).values());
    expect(calls).toHaveLength(2);
    expect(calls[0].query).toContain("set_config('app.organization_ids'");
    expect(calls[0].params).toEqual(["school-a", "staff-a", "false"]);
    expect(calls[1]).toMatchObject({ connection: calls[0].connection, query: "select * from students" });
  });

  it("sets scope once for an explicit transaction and keeps requests isolated", async () => {
    const { client, calls } = fakeClient();
    await Promise.all([
      runWithRlsContext({ organizationIds: ["school-a"], userId: "staff-a", platform: false },
        () => client.begin(async tx => tx.unsafe("select a", []))),
      runWithRlsContext({ organizationIds: ["school-b"], userId: "staff-b", platform: false },
        () => client.begin(async tx => tx.unsafe("select b", []))),
    ]);
    const scopes = calls.filter(call => call.query.includes("set_config"));
    expect(scopes.map(scope => scope.params[0]).sort()).toEqual(["school-a", "school-b"]);
    for (const scope of scopes) {
      const query = calls.find(call => call.connection === scope.connection && !call.query.includes("set_config"));
      expect(query?.query).toBe(scope.params[0] === "school-a" ? "select a" : "select b");
    }
  });

  it("does not set a school scope for pre-authentication queries", async () => {
    const { client, calls } = fakeClient();
    await client.unsafe("select * from users", []);
    expect(calls).toEqual([{ connection: 0, query: "select * from users", params: [] }]);
  });

  it("keeps concurrent awaited authorization guards in separate scopes", async () => {
    const { client, calls } = fakeClient();
    async function readFor(school: string) {
      async function authorize() {
        const scope = beginRlsContext();
        await Promise.resolve();
        scope.organizationIds = [school];
        scope.userId = `staff-${school}`;
      }
      await authorize();
      return client.unsafe(`select ${school}`, []).values();
    }
    await Promise.all([readFor("school-a"), readFor("school-b")]);
    for (const school of ["school-a", "school-b"]) {
      const query = calls.find(call => call.query === `select ${school}`)!;
      const scope = calls.find(call => call.connection === query.connection && call.query.includes("set_config"))!;
      expect(scope.params[0]).toBe(school);
    }
  });
});
