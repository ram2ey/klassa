import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";

/** Serializes first-admin creation and fails closed on an unconfigured installation. */
export async function bootstrapAdmin(client, env = process.env) {
  return client.begin(async sql => {
    await sql`SELECT pg_advisory_xact_lock(73492518)`;
    const existing = await sql`SELECT id FROM users WHERE is_platform_admin = true LIMIT 1`;
    if (existing.length) return { created: false };
    const username = (env.KLASSO_BOOTSTRAP_USERNAME ?? "").trim().toLowerCase();
    const name = (env.KLASSO_BOOTSTRAP_NAME ?? "").trim();
    const password = env.KLASSO_BOOTSTRAP_PASSWORD ?? "";
    if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)) {
      throw new Error("No platform administrator exists. KLASSO_BOOTSTRAP_USERNAME must contain 3-64 letters, numbers, dots, underscores or hyphens.");
    }
    if (name.length < 2 || name.length > 180) throw new Error("KLASSO_BOOTSTRAP_NAME must be between 2 and 180 characters.");
    if (password.length < 12 || password.length > 128) throw new Error("KLASSO_BOOTSTRAP_PASSWORD must be between 12 and 128 characters.");
    const userId = randomUUID();
    const hashedPassword = await hashPassword(password);
    await sql`INSERT INTO users (id, name, email, email_verified, username, display_username,
      is_platform_admin, must_change_password) VALUES
      (${userId}, ${name}, ${`${userId}@accounts.klassa.invalid`}, false, ${`platform:${username}`}, ${username}, true, false)`;
    await sql`INSERT INTO accounts (id, account_id, provider_id, user_id, password)
      VALUES (${randomUUID()}, ${userId}, 'credential', ${userId}, ${hashedPassword})`;
    return { created: true };
  });
}
