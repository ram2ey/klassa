import { test, after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { gzipSync, gunzipSync } from "node:zlib";
import postgres from "postgres";
import { verifyPassword } from "better-auth/crypto";
import { bootstrapAdmin } from "./bootstrap-admin.mjs";

const ownerUrl = process.env.RLS_TEST_ADMIN_URL;
if (!ownerUrl) throw new Error("Operations tests require RLS_TEST_ADMIN_URL for a migrated disposable database.");
if (!["localhost", "127.0.0.1"].includes(new URL(ownerUrl).hostname)) {
  throw new Error("Operations tests require a local disposable PostgreSQL cluster.");
}
const owner = postgres(ownerUrl, { max: 1, onnotice: () => {} });
const databaseName = `klassa_ops_${randomUUID().replaceAll("-", "")}`;
const targetUrl = new URL(ownerUrl);
targetUrl.pathname = `/${databaseName}`;
const target = postgres(targetUrl.toString(), { max: 2, onnotice: () => {} });
const securitySql = await readFile(new URL("./database-security.sql", import.meta.url), "utf8");

function pg(program, args, input = "") {
  const container = process.env.RLS_TEST_POSTGRES_CONTAINER;
  const command = container ? "docker" : process.env.PG_BIN ? join(process.env.PG_BIN, program + (process.platform === "win32" ? ".exe" : "")) : program;
  const parameters = container ? ["exec", "-i", container, program, ...args] : args;
  return new Promise((resolve, reject) => {
    const child = spawn(command, parameters, { windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let output = "", errors = "";
    child.stdout.setEncoding("utf8"); child.stdout.on("data", data => { output += data; });
    child.stderr.setEncoding("utf8"); child.stderr.on("data", data => { errors += data; });
    child.on("error", reject);
    child.stdin.on("error", reject);
    child.on("close", code => code === 0 ? resolve(output) : reject(new Error(`${program} failed: ${errors}`)));
    child.stdin.end(input);
  });
}
async function restore(sql) {
  await pg("psql", [`--dbname=${targetUrl}`, "--no-psqlrc", "--set=ON_ERROR_STOP=on", "--single-transaction"], sql + "\n" + securitySql);
}
async function privileges() {
  const [row] = await target`SELECT
    has_function_privilege('klassa_app', 'public.klassa_claim_sms_dispatch(uuid)', 'EXECUTE') AS app,
    has_function_privilege('klassa_sms_worker', 'public.klassa_claim_sms_dispatch(uuid)', 'EXECUTE') AS worker,
    has_table_privilege('klassa_sms_worker', 'public.guardians', 'SELECT') AS guardian_access`;
  assert.deepEqual(row, { app: false, worker: true, guardian_access: false });
}
before(async () => {
  await owner.unsafe(`CREATE DATABASE "${databaseName}"`);
  const dump = await pg("pg_dump", [`--dbname=${ownerUrl}`, "--format=plain", "--no-owner"]);
  await restore(dump);
  await target`DELETE FROM accounts WHERE user_id IN (SELECT id FROM users WHERE is_platform_admin)`;
  await target`DELETE FROM users WHERE is_platform_admin`;
});
after(async () => {
  await target.end();
  await owner.unsafe(`DROP DATABASE IF EXISTS "${databaseName}" WITH (FORCE)`);
  await owner.end();
});
test("first admin fails closed, stores a usable hash and serializes concurrent retries", async () => {
  await assert.rejects(bootstrapAdmin(target, {}), /BOOTSTRAP_USERNAME/);
  await assert.rejects(bootstrapAdmin(target, { KLASSO_BOOTSTRAP_USERNAME: "ops.admin", KLASSO_BOOTSTRAP_NAME: "Ops", KLASSO_BOOTSTRAP_PASSWORD: "short" }), /BOOTSTRAP_PASSWORD/);
  assert.equal((await target`SELECT id FROM users WHERE is_platform_admin`).length, 0);
  const env = { KLASSO_BOOTSTRAP_USERNAME: "ops.admin", KLASSO_BOOTSTRAP_NAME: "Operations Admin", KLASSO_BOOTSTRAP_PASSWORD: "OperationsOnlyTestPassword1234" };
  const results = await Promise.all([bootstrapAdmin(target, env), bootstrapAdmin(target, env)]);
  assert.equal(results.filter(result => result.created).length, 1);
  const [account] = await target`SELECT a.password FROM accounts a JOIN users u ON u.id = a.user_id WHERE u.is_platform_admin`;
  assert.equal(await verifyPassword({ hash: account.password, password: env.KLASSO_BOOTSTRAP_PASSWORD }), true);
  assert.deepEqual(await bootstrapAdmin(target, {}), { created: false });
});
test("compressed full dump restores data, ACLs and tenant isolation", async () => {
  const schools = [randomUUID(), randomUUID()];
  for (const id of schools) {
    await target`INSERT INTO organizations (id, name, slug) VALUES (${id}, 'Restore Test', ${`restore-${id}`})`;
    await target`INSERT INTO students (organization_id, student_number, first_name, last_name, date_of_birth)
      VALUES (${id}, 'RESTORE-1', 'Synthetic', 'Student', '2010-01-01')`;
  }
  const dump = await pg("pg_dump", [`--dbname=${targetUrl}`, "--format=plain", "--no-owner", "--clean", "--if-exists"]);
  assert.match(dump, /REVOKE ALL ON FUNCTION public\.klassa_claim_sms_dispatch/);
  const archive = gzipSync(dump);
  await target`DELETE FROM students WHERE organization_id IN (${schools[0]}, ${schools[1]})`;
  await restore(gunzipSync(archive).toString("utf8"));
  assert.equal((await target`SELECT id FROM students WHERE organization_id IN (${schools[0]}, ${schools[1]})`).length, 2);
  await privileges();
  await target.begin(async tx => {
    await tx.unsafe("SET LOCAL ROLE klassa_app");
    assert.equal((await tx`SELECT id FROM students`).length, 0);
    await tx`SELECT set_config('app.organization_ids', ${schools[0]}, true)`;
    assert.equal((await tx`SELECT id FROM students WHERE organization_id IN (${schools[0]}, ${schools[1]})`).length, 1);
  });
});
test("legacy privilege-free dump is repaired despite a complete migration ledger", async () => {
  const dump = await pg("pg_dump", [`--dbname=${targetUrl}`, "--format=plain", "--no-owner", "--no-privileges", "--clean", "--if-exists"]);
  await restore(dump);
  await privileges();
});
test("permission reconciliation rejects an application role that bypasses RLS", async () => {
  await assert.rejects(target.begin(async tx => {
    await tx.unsafe("ALTER ROLE klassa_app BYPASSRLS");
    await tx.unsafe(securitySql);
  }), /unsafe cluster privileges/);
  const [role] = await target`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'klassa_app'`;
  assert.equal(role.rolbypassrls, false);
});
