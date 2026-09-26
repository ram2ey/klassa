// @vitest-environment node
import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { guardians, students } from "./schema";
import { createScopedClient } from "./scoped-client";
import { beginRlsContext, runWithRlsContext } from "./rls-context";

const adminUrl = process.env.RLS_TEST_ADMIN_URL;
const appUrl = process.env.RLS_TEST_APP_URL;

describe.skipIf(!adminUrl || !appUrl)("PostgreSQL tenant row security", () => {
  const schoolA = randomUUID();
  const schoolB = randomUUID();
  const studentA = randomUUID();
  const studentB = randomUUID();
  const guardianA = randomUUID();
  const guardianB = randomUUID();
  const guardianUserA = `rls-guardian-${randomUUID()}`;
  const guardianUserB = `rls-guardian-${randomUUID()}`;
  let owner: Sql;
  let appClient: Sql;
  let db: ReturnType<typeof drizzle>;

  beforeAll(async () => {
    owner = postgres(adminUrl!, { max: 1 });
    appClient = postgres(appUrl!, { max: 2 });
    db = drizzle(createScopedClient(appClient));
    await owner`INSERT INTO organizations (id, name, slug) VALUES
      (${schoolA}, 'RLS Test A', ${`rls-test-${schoolA}`}),
      (${schoolB}, 'RLS Test B', ${`rls-test-${schoolB}`})`;
    await owner`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth) VALUES
      (${studentA}, ${schoolA}, 'RLS-TEST-A', 'Student', 'A', '2010-01-01'),
      (${studentB}, ${schoolB}, 'RLS-TEST-B', 'Student', 'B', '2010-01-01')`;
    await owner`INSERT INTO users (id, name, email) VALUES
      (${guardianUserA}, 'Guardian A', ${`${guardianUserA}@accounts.klassa.invalid`}),
      (${guardianUserB}, 'Guardian B', ${`${guardianUserB}@accounts.klassa.invalid`})`;
    await owner`INSERT INTO guardians (id, organization_id, user_id, first_name, last_name) VALUES
      (${guardianA}, ${schoolA}, ${guardianUserA}, 'Guardian', 'A'),
      (${guardianB}, ${schoolB}, ${guardianUserB}, 'Guardian', 'B')`;
  });

  afterAll(async () => {
    if (owner) {
      await owner`DELETE FROM guardians WHERE id IN (${guardianA}, ${guardianB})`;
      await owner`DELETE FROM students WHERE id IN (${studentA}, ${studentB})`;
      await owner`DELETE FROM users WHERE id IN (${guardianUserA}, ${guardianUserB})`;
      await owner`DELETE FROM organizations WHERE id IN (${schoolA}, ${schoolB})`;
      await owner.end();
    }
    if (appClient) await appClient.end();
  });

  it("denies unscoped reads", async () => {
    const rows = await db.select({ id: students.id }).from(students)
      .where(inArray(students.id, [studentA, studentB]));
    expect(rows).toEqual([]);
  });

  it("limits reads and writes to the verified school", async () => {
    await runWithRlsContext({ organizationIds: [schoolA], userId: "staff-a", platform: false }, async () => {
      const rows = await db.select({ id: students.id }).from(students)
        .where(inArray(students.id, [studentA, studentB]));
      expect(rows).toEqual([{ id: studentA }]);
      const foreignUpdate = await db.update(students).set({ firstName: "Blocked" })
        .where(inArray(students.id, [studentB])).returning({ id: students.id });
      expect(foreignUpdate).toEqual([]);
      const transactionRows = await db.transaction(tx => tx.select({ id: students.id }).from(students)
        .where(inArray(students.id, [studentA, studentB])));
      expect(transactionRows).toEqual([{ id: studentA }]);
    });
  });

  it("allows platform context across schools", async () => {
    const rows = await runWithRlsContext({ organizationIds: [], userId: "platform-admin", platform: true },
      async () => db.select({ id: students.id }).from(students).where(inArray(students.id, [studentA, studentB])));
    expect(rows.map(row => row.id).sort()).toEqual([studentA, studentB].sort());
  });

  it("allows a guardian to find only their own profile before school scope is known", async () => {
    await runWithRlsContext({ organizationIds: [], userId: guardianUserA, platform: false }, async () => {
      const rows = await db.select({ id: guardians.id }).from(guardians)
        .where(inArray(guardians.id, [guardianA, guardianB]));
      expect(rows).toEqual([{ id: guardianA }]);
      const selfUpdate = await db.update(guardians).set({ firstName: "Blocked" })
        .where(inArray(guardians.id, [guardianA])).returning({ id: guardians.id });
      expect(selfUpdate).toEqual([]);
    });
  });

  it("inherits a scope established by an awaited authorization guard", async () => {
    await runWithRlsContext({ organizationIds: [], userId: "", platform: false }, async () => {
      async function authorizeSchool() {
        const scope = beginRlsContext();
        await Promise.resolve();
        scope.organizationIds = [schoolB];
        scope.userId = "staff-b";
      }
      await authorizeSchool();
      const rows = await db.select({ id: students.id }).from(students)
        .where(inArray(students.id, [studentA, studentB]));
      expect(rows).toEqual([{ id: studentB }]);
    });
  });
});
