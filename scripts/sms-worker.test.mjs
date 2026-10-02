import { test } from "node:test";
import { strict as assert } from "node:assert";
import { createSmsWorker } from "./sms-worker-core.mjs";

function harness(request, queued = 2) {
  let claims = 0;
  let heartbeats = 0;
  const writes = [];
  const sql = async (strings, ...values) => {
    const query = strings.join("?");
    writes.push({ query, values });
    if (query.includes("klassa_claim_sms_dispatch")) {
      claims++;
      return claims <= queued ? [{ id: String(claims), lease_token: values[0], recipient_phone: "+233241234567", message: "Notice", invitation_id: null }] : [];
    }
    if (query.startsWith("SELECT count")) return [{ queued: 2, failed: 0, unknown: 0 }];
    return [];
  };
  const worker = createSmsWorker({ sql, apiKey: "test", sender: "Test", enabled: true, request,
    writeHeartbeat: async () => { heartbeats++; } });
  return { worker, writes, claims: () => claims, heartbeats: () => heartbeats };
}
const accepted = () => new Response(JSON.stringify({ status: "success", summary: { _id: "campaign", total_sent: 1, total_rejected: 0 } }));

test("claims one dispatch at send time and reports health while the provider is blocked", async () => {
  let resolveRequest;
  let requestStarted;
  const started = new Promise(resolve => { requestStarted = resolve; });
  let requests = 0;
  const h = harness(async () => {
    requests++;
    if (requests === 1) {
      requestStarted();
      return new Promise(resolve => { resolveRequest = resolve; });
    }
    return accepted();
  });
  const tick = h.worker.tick();
  await started;
  assert.equal(h.claims(), 1);
  await h.worker.heartbeat();
  assert.equal(h.heartbeats(), 1);
  assert.equal(h.claims(), 1);
  resolveRequest(accepted());
  await tick;
  assert.equal(requests, 2);
  assert.equal(h.claims(), 3);
  assert.equal(h.writes.filter(write => write.query.includes("status = 'accepted', provider_ref")).length, 2);
});

test("a provider timeout becomes unknown and is never automatically resent", async () => {
  const h = harness(async () => { throw new Error("Timeout after acceptance"); }, 1);
  await h.worker.tick();
  const write = h.writes.find(write => write.query.includes("Provider outcome unknown"));
  assert.ok(write);
  assert.match(write.query, /lease_token = \?/);
  assert.ok(write.values.includes("1"));
  assert.equal(h.writes.filter(write => write.query.includes("status = 'queued'") && write.query.startsWith("UPDATE")).length, 1); // invitation cancellation only
});

test("a confirmed provider rejection is recorded against the owning lease", async () => {
  const h = harness(async () => new Response(JSON.stringify({ status: "error" }), { status: 400 }), 1);
  await h.worker.tick();
  const write = h.writes.find(write => write.query.includes("mNotify rejected the request"));
  assert.ok(write);
  assert.match(write.query, /WHERE id = \? AND lease_token = \?/);
  assert.ok(!h.writes.some(write => write.query.includes("status = 'accepted', provider_ref")));
});
