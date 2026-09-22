import { randomUUID } from "node:crypto";
import { loadEnvConfig } from "@next/env";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { users, accounts } from "../src/db/schema.ts";

loadEnvConfig(process.cwd());
if (process.env.KLASSO_DEMO_MODE === "true") throw new Error("Disable demo mode before bootstrapping a real superuser.");
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to bootstrap the platform administrator.");
const phone = (process.env.KLASSO_BOOTSTRAP_PHONE ?? "").trim().replace(/[\s().-]/g, "");
const name = (process.env.KLASSO_BOOTSTRAP_NAME ?? "").trim();
const password = process.env.KLASSO_BOOTSTRAP_PASSWORD ?? "";
const client = postgres(process.env.DATABASE_URL, { max: 1 });
try {
  const database = drizzle(client);
  const [existingAdmin] = await database.select({ id: users.id }).from(users).where(eq(users.isPlatformAdmin, true)).limit(1);
  if (existingAdmin) {
    console.log("A platform administrator already exists; bootstrap was skipped.");
  } else {
    if (!/^\+[1-9]\d{7,14}$/.test(phone) || name.length < 2 || name.length > 180 || password.length < 12 || password.length > 128) {
      throw new Error("Set KLASSO_BOOTSTRAP_PHONE in international format, KLASSO_BOOTSTRAP_NAME, and KLASSO_BOOTSTRAP_PASSWORD with 12–128 characters.");
    }
    const userId = randomUUID();
    await database.transaction(async tx => {
      // Unique phone/email constraints prevent this command from replacing or promoting an existing account.
      await tx.insert(users).values({ id: userId, name, email: `${userId}@accounts.klassa.invalid`,
        phoneNumber: phone, phoneNumberVerified: true, isPlatformAdmin: true });
      await tx.insert(accounts).values({ id: randomUUID(), userId, accountId: userId, providerId: "credential", password: await hashPassword(password) });
    });
    console.log("Platform administrator created. Sign in with the configured phone and password, then enroll your authenticator.");
  }
} catch (error) {
  const message = error instanceof Error ? error.message : "Unknown bootstrap error.";
  console.error(`Bootstrap failed: ${message} No existing account was changed.`);
  process.exitCode = 1;
} finally {
  delete process.env.KLASSO_BOOTSTRAP_PASSWORD;
  await client.end();
}
