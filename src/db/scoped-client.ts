import type { Sql } from "postgres";
import { getRlsContext, type RlsContext } from "./rls-context";

async function applyScope(connection: Sql, scope: RlsContext): Promise<void> {
  await connection.unsafe(
    "select set_config('app.organization_ids', $1, true), set_config('app.user_id', $2, true), set_config('app.platform_access', $3, true)",
    [scope.organizationIds.join(","), scope.userId, scope.platform ? "true" : "false"],
  );
}

/**
 * A Drizzle query outside an explicit transaction still needs SET LOCAL on the
 * same connection as the query. The lazy query object starts that transaction
 * only when Drizzle awaits it or asks for array rows via values().
 */
export function createScopedClient(client: Sql): Sql {
  return new Proxy(client, {
    get(target, property) {
      if (property === "unsafe") {
        return (query: string, params: unknown[] = []) => {
          const scope = getRlsContext();
          if (!scope) return target.unsafe(query, params as never[]);
          const run = (values: boolean) => target.begin(async connection => {
            await applyScope(connection as unknown as Sql, scope);
            const result = connection.unsafe(query, params as never[]);
            return values ? result.values() : result;
          });
          return {
            then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) => run(false).then(resolve, reject),
            values: () => run(true),
          };
        };
      }
      if (property === "begin") {
        return <T>(operation: (connection: Sql) => Promise<T>) => {
          const scope = getRlsContext();
          return target.begin(async connection => {
            if (scope) await applyScope(connection as unknown as Sql, scope);
            return operation(connection as unknown as Sql);
          });
        };
      }
      return Reflect.get(target, property, target);
    },
    apply() {
      throw new Error("Use Drizzle queries or an explicitly scoped SQL transaction.");
    },
  });
}
