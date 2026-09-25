import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import postgres from "postgres";

// Optional: try loading dotenv / @next/env if available locally, but ignore if not found
try {
  const nextEnv = await import("@next/env");
  const load = nextEnv.default?.loadEnvConfig || nextEnv.loadEnvConfig;
  if (typeof load === "function") {
    load(process.cwd());
  }
} catch {
  // Not required in container environment where process.env is injected by Docker
}

if (process.env.KLASSO_DEMO_MODE === "true") {
  console.log("[bootstrap] Demo mode active. Skipping real superuser bootstrap.");
  process.exit(0);
}

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.log("[bootstrap] Notice: DATABASE_URL is not set. Skipping bootstrap.");
  process.exit(0);
}

const username = (process.env.KLASSO_BOOTSTRAP_USERNAME ?? "").trim().toLowerCase();
const name = (process.env.KLASSO_BOOTSTRAP_NAME ?? "").trim();
const password = process.env.KLASSO_BOOTSTRAP_PASSWORD ?? "";

const client = postgres(databaseUrl, { max: 1 });

try {
  // Check if a platform admin already exists
  const existingAdmins = await client`
    SELECT id FROM users WHERE is_platform_admin = true LIMIT 1
  `;

  if (existingAdmins.length > 0) {
    console.log("[bootstrap] A platform administrator already exists; bootstrap skipped.");
  } else if (!username && !name && !password) {
    console.log("[bootstrap] No platform administrator exists yet.");
    console.log("[bootstrap] KLASSO_BOOTSTRAP_USERNAME / PASSWORD not set in environment. Skipping creation.");
    console.log("[bootstrap] You can configure them in Coolify Environment Variables and redeploy anytime to bootstrap an administrator.");
  } else {
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
      console.warn(`[bootstrap] Warning: KLASSO_BOOTSTRAP_USERNAME must contain 3-64 lowercase letters, numbers, dots, underscores or hyphens. Admin creation skipped.`);
    } else if (name.length < 2 || name.length > 180) {
      console.warn("[bootstrap] Warning: KLASSO_BOOTSTRAP_NAME must be between 2 and 180 characters. Admin creation skipped.");
    } else if (password.length < 12 || password.length > 128) {
      console.warn("[bootstrap] Warning: KLASSO_BOOTSTRAP_PASSWORD must be between 12 and 128 characters. Admin creation skipped.");
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

      console.log(`[bootstrap] Platform administrator (${name}, platform / ${username}) created successfully!`);
      console.log("[bootstrap] Sign in with the tenant ID platform, configured username and password, then enroll your authenticator.");
    }
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown bootstrap error.";
  console.error(`[bootstrap] Error: ${message}`);
} finally {
  delete process.env.KLASSO_BOOTSTRAP_PASSWORD;
  await client.end();
}

