import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

// Optional: try loading dotenv / @next/env if running locally
try {
  const nextEnv = await import("@next/env");
  const load = nextEnv.default?.loadEnvConfig || nextEnv.loadEnvConfig;
  if (typeof load === "function") {
    load(process.cwd());
  }
} catch {
  // Ignored in container where environment variables are injected
}

if (process.env.KLASSO_DEMO_MODE === "true") {
  console.log("[deploy] Demo mode active. Skipping database migration and bootstrap.");
  process.exit(0);
}

// 1. Determine connection parameters
const pgUser = process.env.PGUSER || process.env.SERVICE_USER_POSTGRES;
const pgPassword = process.env.PGPASSWORD || process.env.SERVICE_PASSWORD_64_POSTGRES;
const pgHost = process.env.PGHOST || "postgres";
const pgPort = Number(process.env.PGPORT || 5432);
const pgDatabase = process.env.PGDATABASE || "klassa";
const databaseUrl = process.env.DATABASE_URL;

let client;
if (pgUser && pgPassword) {
  console.log(`[deploy] Connecting via PG parameters to ${pgHost}:${pgPort}/${pgDatabase} as user '${pgUser}'...`);
  client = postgres({
    host: pgHost,
    port: pgPort,
    database: pgDatabase,
    username: pgUser,
    password: pgPassword,
    max: 1,
    connect_timeout: 10,
    idle_timeout: 10,
  });
} else if (databaseUrl) {
  console.log("[deploy] Connecting via DATABASE_URL...");
  client = postgres(databaseUrl, {
    max: 1,
    connect_timeout: 10,
    idle_timeout: 10,
  });
} else {
  console.error("[deploy] Error: No database credentials provided (neither PGUSER/PGPASSWORD nor DATABASE_URL).");
  process.exit(1);
}

try {
  // 2. Retry loop: wait for PostgreSQL to be ready and accept queries
  let connected = false;
  for (let attempt = 1; attempt <= 20; attempt++) {
    try {
      await client`SELECT 1`;
      connected = true;
      console.log(`[deploy] Successfully connected to PostgreSQL on attempt ${attempt}.`);
      break;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`[deploy] Waiting for PostgreSQL (attempt ${attempt}/20): ${msg}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }

  if (!connected) {
    throw new Error("Could not connect to PostgreSQL within 40 seconds.");
  }

  // 3. Apply migrations programmatically
  console.log("[deploy] Applying Drizzle database migrations from ./drizzle ...");
  const db = drizzle(client);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("[deploy] Database migrations applied successfully!");

  // The web container must never connect as the migration/table-owner role.
  const appPassword = process.env.KLASSO_APP_DATABASE_PASSWORD ?? "";
  if (!/^[A-Za-z0-9]{32,128}$/.test(appPassword)) {
    throw new Error("KLASSO_APP_DATABASE_PASSWORD must be a generated 32-128 character alphanumeric secret.");
  }
  await client.unsafe(`ALTER ROLE klassa_app LOGIN PASSWORD '${appPassword}'`);
  const smsWorkerPassword = process.env.KLASSO_SMS_WORKER_PASSWORD ?? "";
  if (!/^[A-Za-z0-9]{32,128}$/.test(smsWorkerPassword)) {
    throw new Error("KLASSO_SMS_WORKER_PASSWORD must be a generated 32-128 character alphanumeric secret.");
  }
  await client.unsafe(`ALTER ROLE klassa_sms_worker LOGIN PASSWORD '${smsWorkerPassword}'`);
  const missingPolicies = await client`
    SELECT tables.relname AS table_name
    FROM pg_class AS tables
    JOIN pg_namespace AS schemas ON schemas.oid = tables.relnamespace
    JOIN pg_attribute AS columns ON columns.attrelid = tables.oid
    WHERE schemas.nspname = 'public' AND tables.relkind = 'r'
      AND columns.attname = 'organization_id' AND NOT columns.attisdropped
      AND tables.relname NOT IN (
        'organizations', 'users', 'organization_memberships',
        'invitations', 'sms_invitations', 'invitation_sms_limits', 'rate_limit_logs'
      )
      AND (NOT tables.relrowsecurity OR NOT EXISTS (
        SELECT 1 FROM pg_policies AS policies
        WHERE policies.schemaname = 'public' AND policies.tablename = tables.relname
      ))
  `;
  if (missingPolicies.length) {
    throw new Error(`Tenant RLS is missing on: ${missingPolicies.map(row => row.table_name).join(", ")}`);
  }
  const appClient = pgUser && pgPassword
    ? postgres({ host: pgHost, port: pgPort, database: pgDatabase,
      username: "klassa_app", password: appPassword, max: 1, connect_timeout: 10 })
    : (() => {
      const url = new URL(databaseUrl);
      url.username = "klassa_app";
      url.password = appPassword;
      return postgres(url.toString(), { max: 1, connect_timeout: 10 });
    })();
  try {
    const [probe] = await appClient`
      SELECT current_user AS role, row_security_active('public.students'::regclass) AS rls_active
    `;
    if (probe?.role !== "klassa_app" || probe.rls_active !== true) {
      throw new Error("The web database role is not subject to student row security.");
    }
  } finally {
    await appClient.end();
  }
  const probeSchoolA = randomUUID();
  const probeSchoolB = randomUUID();
  const probeStudentA = randomUUID();
  const probeStudentB = randomUUID();
  const rollbackProbe = new Error("RLS_PROBE_ROLLBACK");
  try {
    await client.begin(async sql => {
      await sql`INSERT INTO organizations (id, name, slug) VALUES
        (${probeSchoolA}, 'RLS Probe A', ${`rls-probe-${probeSchoolA}`}),
        (${probeSchoolB}, 'RLS Probe B', ${`rls-probe-${probeSchoolB}`})`;
      await sql`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth) VALUES
        (${probeStudentA}, ${probeSchoolA}, 'RLS-A', 'Probe', 'A', '2010-01-01'),
        (${probeStudentB}, ${probeSchoolB}, 'RLS-B', 'Probe', 'B', '2010-01-01')`;
      await sql.unsafe("SET LOCAL ROLE klassa_app");
      const withoutScope = await sql`SELECT id FROM students WHERE id IN (${probeStudentA}, ${probeStudentB})`;
      if (withoutScope.length !== 0) throw new Error("RLS allowed school data without context.");
      await sql`SELECT set_config('app.organization_ids', ${probeSchoolA}, true)`;
      const visible = await sql`SELECT id FROM students WHERE id IN (${probeStudentA}, ${probeStudentB})`;
      if (visible.length !== 1 || visible[0].id !== probeStudentA) {
        throw new Error("RLS did not isolate the selected school.");
      }
      const foreignUpdate = await sql`UPDATE students SET first_name = 'Blocked' WHERE id = ${probeStudentB} RETURNING id`;
      if (foreignUpdate.length !== 0) throw new Error("RLS permitted a cross-school update.");
      await sql`SELECT set_config('app.platform_access', 'true', true)`;
      const platformVisible = await sql`SELECT id FROM students WHERE id IN (${probeStudentA}, ${probeStudentB})`;
      if (platformVisible.length !== 2) throw new Error("Platform scope could not read both schools.");
      throw rollbackProbe;
    });
  } catch (error) {
    if (error !== rollbackProbe) throw error;
  }
  console.log("[deploy] Restricted web database role and tenant policies verified.");

  // 4. Platform administrator bootstrap
  console.log("[deploy] Checking platform administrator status...");
  const existingAdmins = await client`
    SELECT id FROM users WHERE is_platform_admin = true LIMIT 1
  `;

  const username = (process.env.KLASSO_BOOTSTRAP_USERNAME ?? "").trim().toLowerCase();
  const name = (process.env.KLASSO_BOOTSTRAP_NAME ?? "").trim();
  const password = process.env.KLASSO_BOOTSTRAP_PASSWORD ?? "";

  if (existingAdmins.length > 0) {
    console.log("[deploy] A platform administrator already exists; bootstrap skipped.");
  } else if (!username && !name && !password) {
    console.log("[deploy] No platform administrator exists yet.");
    console.log("[deploy] Notice: KLASSO_BOOTSTRAP_USERNAME / PASSWORD not set in environment. Skipping admin creation.");
    console.log("[deploy] You can configure them in Coolify Environment Variables and redeploy anytime to bootstrap an administrator.");
  } else {
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
      console.warn(`[deploy] Warning: KLASSO_BOOTSTRAP_USERNAME must contain 3-64 lowercase letters, numbers, dots, underscores or hyphens. Admin creation skipped.`);
    } else if (name.length < 2 || name.length > 180) {
      console.warn("[deploy] Warning: KLASSO_BOOTSTRAP_NAME must be between 2 and 180 characters. Admin creation skipped.");
    } else if (password.length < 12 || password.length > 128) {
      console.warn("[deploy] Warning: KLASSO_BOOTSTRAP_PASSWORD must be between 12 and 128 characters. Admin creation skipped.");
    } else {
      const userId = randomUUID();
      const accountId = randomUUID();
      const hashedPassword = await hashPassword(password);
      const email = `${userId}@accounts.klassa.invalid`;

      await client.begin(async (sql) => {
        await sql`
          INSERT INTO users (
            id, name, email, email_verified, username, display_username,
            is_platform_admin, must_change_password
          )
          VALUES (
            ${userId}, ${name}, ${email}, false, ${"platform:" + username}, ${username},
            true, false
          )
        `;
        await sql`
          INSERT INTO accounts (
            id, account_id, provider_id, user_id, password
          )
          VALUES (
            ${accountId}, ${userId}, 'credential', ${userId}, ${hashedPassword}
          )
        `;
      });

      console.log(`[deploy] Platform administrator (${name}, platform / ${username}) created successfully!`);
    }
  }

  console.log("[deploy] Database preparation completed successfully.");
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown error during deployment.";
  console.error(`[deploy] Fatal error during database preparation: ${message}`);
  process.exit(1);
} finally {
  delete process.env.KLASSO_BOOTSTRAP_PASSWORD;
  await client.end();
}
