import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { createSmsWorker } from "./sms-worker-core.mjs";

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const heartbeatFile = join(tmpdir(), "klassa-sms-worker-heartbeat");
const enabled = process.env.SMS_DELIVERY_ENABLED === "true";
const apiKey = process.env.MNOTIFY_API_KEY ?? "";
const sender = process.env.MNOTIFY_SENDER_ID ?? "";
if (enabled && (!apiKey || !/^[A-Za-z0-9 _-]{1,11}$/.test(sender))) {
  throw new Error("SMS delivery is enabled but mNotify API key or approved sender ID is missing.");
}
const sql = postgres({ host: process.env.PGHOST || "postgres", port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "klassa", username: process.env.PGUSER || "klassa_sms_worker",
  password: process.env.PGPASSWORD || "", max: 2, connect_timeout: 10 });
const worker = createSmsWorker({ sql, apiKey, sender, enabled,
  writeHeartbeat: () => writeFile(heartbeatFile, String(Date.now())) });
const logError = error => process.stderr.write(`[sms-worker] ${error instanceof Error ? error.message : "Unknown database error"}\n`);
let heartbeatPending = false;
async function heartbeat() {
  if (heartbeatPending) return;
  heartbeatPending = true;
  try { await worker.heartbeat(); } catch (error) { logError(error); }
  finally { heartbeatPending = false; }
}
// Network requests cannot delay health reporting. The second DB connection is
// available for heartbeats while the dispatch loop owns the first.
await heartbeat();
setInterval(() => { void heartbeat(); }, 20_000);
for (;;) {
  try { await worker.tick(); } catch (error) { logError(error); }
  await sleep(15_000);
}
