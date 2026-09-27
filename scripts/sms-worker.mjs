import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import postgres from "postgres";
import { deliveryOutcome } from "./mnotify-delivery.mjs";

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

function endpoint(path) {
  const url = new URL(`https://api.mnotify.com/api/${path}`);
  url.searchParams.set("key", apiKey);
  return url;
}

async function send(row) {
  try {
    const response = await fetch(endpoint("sms/quick"), { method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: [row.recipient_phone], sender, message: row.message,
        is_schedule: false, schedule_date: "" }), signal: AbortSignal.timeout(15_000) });
    const payload = await response.json();
    const ref = payload?.summary?._id;
    if (!response.ok || payload?.status !== "success" || typeof ref !== "string" || !ref ||
      Number(payload?.summary?.total_sent) !== 1 || Number(payload?.summary?.total_rejected ?? 0) !== 0) {
      await sql`UPDATE sms_dispatches SET status = 'failed', error = 'mNotify rejected the request',
        leased_until = NULL, updated_at = now() WHERE id = ${row.id} AND status = 'processing'`;
      if (row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'failed', updated_at = now()
        WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
      return;
    }
    await sql`UPDATE sms_dispatches SET status = 'accepted', provider_ref = ${ref}, error = NULL,
      leased_until = NULL, sent_at = now(), updated_at = now() WHERE id = ${row.id} AND status = 'processing'`;
    if (row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'sent', provider_ref = ${ref},
      updated_at = now() WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
  } catch {
    // A timeout may occur after provider acceptance. Never retry without reconciliation.
    await sql`UPDATE sms_dispatches SET status = 'unknown', error = 'Provider outcome unknown; review before retrying',
      leased_until = NULL, updated_at = now() WHERE id = ${row.id} AND status = 'processing'`;
    if (row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'unknown', updated_at = now()
      WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
  }
}

async function reconcile(row) {
  try {
    const response = await fetch(endpoint(`campaign/${encodeURIComponent(row.provider_ref)}`), { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return;
    const payload = await response.json();
    const status = deliveryOutcome(payload, row.recipient_phone);
    if (status === "delivered") {
      await sql`UPDATE sms_dispatches SET status = 'delivered', delivered_at = now(), updated_at = now()
        WHERE id = ${row.id} AND status = 'accepted'`;
      if (row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'delivered', updated_at = now()
        WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
    } else if (status === "failed") {
      await sql`UPDATE sms_dispatches SET status = 'failed', error = 'mNotify delivery failed', updated_at = now()
        WHERE id = ${row.id} AND status = 'accepted'`;
      if (row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'failed', updated_at = now()
        WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
    }
  } catch { /* The next poll can retry a read safely. */ }
}

async function reconcileInvitation(row) {
  try {
    const response = await fetch(endpoint(`campaign/${encodeURIComponent(row.provider_ref)}`), { signal: AbortSignal.timeout(10_000) });
    if (!response.ok) return;
    const payload = await response.json();
    const status = deliveryOutcome(payload, row.phone_number);
    if (status === "delivered") await sql`UPDATE sms_invitations SET delivery_status = 'delivered', updated_at = now()
      WHERE id = ${row.id} AND provider_ref = ${row.provider_ref} AND delivery_status = 'sent'`;
    else if (status === "failed") await sql`UPDATE sms_invitations
      SET delivery_status = 'failed', updated_at = now() WHERE id = ${row.id} AND provider_ref = ${row.provider_ref}
      AND delivery_status = 'sent'`;
  } catch { /* Read-only provider checks can be repeated. */ }
}

async function tick() {
  const [counts] = await sql`SELECT count(*) FILTER (WHERE status = 'queued')::int AS queued,
    count(*) FILTER (WHERE status = 'failed')::int AS failed,
    count(*) FILTER (WHERE status = 'unknown')::int AS unknown FROM sms_dispatches`;
  await sql`UPDATE sms_worker_status SET heartbeat_at = now(), queued_count = ${counts.queued},
    failed_count = ${counts.failed}, unknown_count = ${counts.unknown} WHERE id = 1`;
  await writeFile(heartbeatFile, String(Date.now()));
  if (!enabled) return;
  await sql`UPDATE sms_dispatches AS d SET status = 'cancelled', updated_at = now()
    FROM sms_invitations AS i WHERE d.invitation_id = i.id AND d.status = 'queued'
      AND (i.revoked_at IS NOT NULL OR i.accepted_at IS NOT NULL OR i.expires_at <= now())`;
  await sql`UPDATE sms_dispatches SET status = 'unknown', error = 'Worker stopped during provider request; review before retrying',
    leased_until = NULL, updated_at = now() WHERE status = 'processing' AND leased_until < now()`;
  const queued = await sql.begin(async tx => tx`
    UPDATE sms_dispatches SET status = 'processing', attempt_count = attempt_count + 1,
      leased_until = now() + interval '60 seconds', updated_at = now()
    WHERE id IN (SELECT id FROM sms_dispatches WHERE status = 'queued' ORDER BY created_at
      FOR UPDATE SKIP LOCKED LIMIT 10)
    RETURNING id, recipient_phone, message, invitation_id`);
  for (const row of queued) await send(row);
  const accepted = await sql`SELECT id, provider_ref, invitation_id, recipient_phone FROM sms_dispatches
    WHERE status = 'accepted' AND provider_ref IS NOT NULL ORDER BY sent_at LIMIT 30`;
  for (const row of accepted) await reconcile(row);
  await sql`UPDATE sms_dispatches SET status = 'unknown',
    error = 'No conclusive mNotify delivery report within 48 hours; review campaign ID', updated_at = now()
    WHERE status = 'accepted' AND sent_at < now() - interval '48 hours'`;
  await sql`UPDATE sms_invitations AS i SET delivery_status = 'unknown', updated_at = now()
    FROM sms_dispatches AS d WHERE d.invitation_id = i.id AND d.status = 'unknown'
      AND i.delivery_status = 'sent' AND i.provider_ref = d.provider_ref`;
  const invitations = await sql`SELECT id, provider_ref, phone_number FROM sms_invitations
    WHERE delivery_status = 'sent' AND provider_ref IS NOT NULL AND revoked_at IS NULL
      AND last_sent_at > now() - interval '48 hours' ORDER BY last_sent_at LIMIT 30`;
  for (const row of invitations) await reconcileInvitation(row);
}

for (;;) {
  try { await tick(); }
  catch (error) { process.stderr.write(`[sms-worker] ${error instanceof Error ? error.message : "Unknown database error"}\n`); }
  await sleep(15_000);
}
