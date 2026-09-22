import { sql } from "drizzle-orm";
import { db } from "@/db";

export async function withOrganizationScope<T>(organizationId: string, operation: (transaction: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<T>) {
  return db.transaction(async (transaction) => {
    await transaction.execute(sql`select set_config('app.current_organization_id', ${organizationId}, true)`);
    return operation(transaction);
  });
}
