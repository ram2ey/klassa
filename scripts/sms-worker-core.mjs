import { randomUUID } from "node:crypto";
import { deliveryOutcome } from "./mnotify-delivery.mjs";

export function createSmsWorker({ sql, apiKey, sender, enabled, writeHeartbeat, request = globalThis.fetch }) {
  function endpoint(path) {
    const url = new URL(`https://api.mnotify.com/api/${path}`);
    url.searchParams.set("key", apiKey);
    return url;
  }

  async function send(row) {
    try {
      const response = await request(endpoint("sms/quick"), { method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: [row.recipient_phone], sender, message: row.message,
          is_schedule: false, schedule_date: "" }), signal: AbortSignal.timeout(15_000) });
      const payload = await response.json();
      const ref = payload?.summary?._id;
      if (!response.ok || payload?.status !== "success" || typeof ref !== "string" || !ref ||
        Number(payload?.summary?.total_sent) !== 1 || Number(payload?.summary?.total_rejected ?? 0) !== 0) {
        const [updated] = await sql`UPDATE sms_dispatches SET status = 'failed', error = 'mNotify rejected the request',
          leased_until = NULL, lease_token = NULL, updated_at = now() WHERE id = ${row.id} AND lease_token = ${row.lease_token} AND status IN ('processing', 'unknown') RETURNING id`;
        if (updated && row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'failed', updated_at = now()
          WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
        return;
      }
      const [updated] = await sql`UPDATE sms_dispatches SET status = 'accepted', provider_ref = ${ref}, error = NULL,
        leased_until = NULL, lease_token = NULL, sent_at = now(), updated_at = now() WHERE id = ${row.id} AND lease_token = ${row.lease_token} AND status IN ('processing', 'unknown') RETURNING id`;
      if (updated && row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'sent', provider_ref = ${ref},
        updated_at = now() WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
    } catch {
      // A timeout may occur after provider acceptance. Never retry without reconciliation.
      const [updated] = await sql`UPDATE sms_dispatches SET status = 'unknown', error = 'Provider outcome unknown; review before retrying',
        leased_until = NULL, lease_token = NULL, updated_at = now() WHERE id = ${row.id} AND lease_token = ${row.lease_token} AND status IN ('processing', 'unknown') RETURNING id`;
      if (updated && row.invitation_id) await sql`UPDATE sms_invitations SET delivery_status = 'unknown', updated_at = now()
        WHERE id = ${row.invitation_id} AND revoked_at IS NULL`;
    }
  }

  async function reconcile(row) {
    try {
      const response = await request(endpoint(`campaign/${encodeURIComponent(row.provider_ref)}`), { signal: AbortSignal.timeout(10_000) });
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
    finally {
      await sql`UPDATE sms_dispatches SET updated_at = now() WHERE id = ${row.id}
        AND status = 'accepted' AND provider_ref = ${row.provider_ref}`;
    }
  }

  async function reconcileInvitation(row) {
    try {
      const response = await request(endpoint(`campaign/${encodeURIComponent(row.provider_ref)}`), { signal: AbortSignal.timeout(10_000) });
      if (!response.ok) return;
      const payload = await response.json();
      const status = deliveryOutcome(payload, row.phone_number);
      if (status === "delivered") await sql`UPDATE sms_invitations SET delivery_status = 'delivered', updated_at = now()
        WHERE id = ${row.id} AND provider_ref = ${row.provider_ref} AND delivery_status = 'sent'`;
      else if (status === "failed") await sql`UPDATE sms_invitations
        SET delivery_status = 'failed', updated_at = now() WHERE id = ${row.id} AND provider_ref = ${row.provider_ref}
        AND delivery_status = 'sent'`;
    } catch { /* Read-only provider checks can be repeated. */ }
    finally {
      await sql`UPDATE sms_invitations SET updated_at = now() WHERE id = ${row.id}
        AND delivery_status = 'sent' AND provider_ref = ${row.provider_ref}`;
    }
  }

  async function heartbeat() {
    const [counts] = await sql`SELECT count(*) FILTER (WHERE status = 'queued')::int AS queued,
      count(*) FILTER (WHERE status = 'failed')::int AS failed,
      count(*) FILTER (WHERE status = 'unknown')::int AS unknown FROM sms_dispatches`;
    await sql`UPDATE sms_worker_status SET heartbeat_at = now(), queued_count = ${counts.queued},
      failed_count = ${counts.failed}, unknown_count = ${counts.unknown} WHERE id = 1`;
    await writeHeartbeat();
  }

  async function tick() {
    if (!enabled) return;
    await sql`UPDATE sms_dispatches AS d SET status = 'cancelled', updated_at = now()
      FROM sms_invitations AS i WHERE d.invitation_id = i.id AND d.status = 'queued'
        AND (i.revoked_at IS NOT NULL OR i.accepted_at IS NOT NULL OR i.expires_at <= now())`;
    await sql`UPDATE sms_dispatches SET status = 'unknown', error = 'Worker stopped during provider request; review before retrying',
      leased_until = NULL, updated_at = now() WHERE status = 'processing' AND leased_until < now()`;
    // Claim immediately before each bounded provider request, never a whole batch.
    for (let i = 0; i < 10; i++) {
      const [row] = await sql`SELECT * FROM public.klassa_claim_sms_dispatch(${randomUUID()})`;
      if (!row) break;
      await send(row);
    }
    const accepted = await sql`SELECT id, provider_ref, invitation_id, recipient_phone FROM sms_dispatches
      WHERE status = 'accepted' AND provider_ref IS NOT NULL ORDER BY updated_at, id LIMIT 30`;
    for (const row of accepted) await reconcile(row);
    await sql`UPDATE sms_dispatches SET status = 'unknown',
      error = 'No conclusive mNotify delivery report within 48 hours; review campaign ID', updated_at = now()
      WHERE status = 'accepted' AND sent_at < now() - interval '48 hours'`;
    await sql`UPDATE sms_invitations AS i SET delivery_status = 'unknown', updated_at = now()
      FROM sms_dispatches AS d WHERE d.invitation_id = i.id AND d.status = 'unknown'
        AND i.delivery_status = 'sent' AND i.provider_ref = d.provider_ref`;
    const invitations = await sql`SELECT id, provider_ref, phone_number FROM sms_invitations
      WHERE delivery_status = 'sent' AND provider_ref IS NOT NULL AND revoked_at IS NULL
        AND last_sent_at > now() - interval '48 hours' ORDER BY updated_at, id LIMIT 30`;
    for (const row of invitations) await reconcileInvitation(row);
  }

  return { tick, heartbeat };
}
