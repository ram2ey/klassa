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

