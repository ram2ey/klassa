import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { databaseClient } from "@/db";
import { runWithRlsContext } from "@/db/rls-context";
import { queueParentSmsAnnouncement } from "./parent-sms-service";
import { createSmsWorker } from "../../scripts/sms-worker-core.mjs";

const school = randomUUID();
const pupil = randomUUID();
const guardian = randomUUID();
const user = `worker-test-${randomUUID()}`;
const phone = "+233241234567";
const actor = { organizationId: school, userId: user, name: "Office", role: "office_staff" as const };

describe("restricted SMS worker eligibility and recovery", () => {
  let owner: Sql;
  let worker: Sql;
  async function queue() {
    await runWithRlsContext({ organizationIds: [school], userId: user, platform: false }, () =>
      queueParentSmsAnnouncement(actor, { scope: "whole_school", targetId: "all", message: "School closes at noon.", requestId: randomUUID() }));
  }
  async function claim() {
    return worker`SELECT * FROM public.klassa_claim_sms_dispatch(${randomUUID()})`;
  }
  beforeAll(async () => {
    const adminUrl = process.env.RLS_TEST_ADMIN_URL!;
    if (!/^(localhost|127\.0\.0\.1)$/.test(new URL(adminUrl).hostname)) throw new Error("Use a local disposable test database.");
    owner = postgres(adminUrl, { max: 1 });
    const workerUrl = new URL(adminUrl);
    workerUrl.username = "klassa_sms_worker";
    workerUrl.password = process.env.KLASSO_SMS_WORKER_PASSWORD!;
    worker = postgres(workerUrl.toString(), { max: 2 });
    await owner`INSERT INTO organizations (id, name, slug) VALUES (${school}, 'Worker Test', ${`worker-test-${school}`})`;
    await owner`INSERT INTO users (id, name, email) VALUES (${user}, 'Office', ${`${user}@invalid.example`})`;
    await owner`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth, status)
      VALUES (${pupil}, ${school}, 'WORKER-1', 'Test', 'Pupil', '2015-01-01', 'active')`;
    await owner`INSERT INTO guardians (id, organization_id, first_name, last_name, phone, phone_verified_at)
      VALUES (${guardian}, ${school}, 'Test', 'Guardian', ${phone}, now())`;
    await owner`INSERT INTO student_guardians (organization_id, student_id, guardian_id, relationship, has_legal_responsibility)
      VALUES (${school}, ${pupil}, ${guardian}, 'parent', true)`;
  });
  beforeEach(async () => {
    await owner`DELETE FROM sms_dispatches WHERE organization_id = ${school}`;
    await owner`DELETE FROM court_restrictions WHERE organization_id = ${school}`;
    await owner`DELETE FROM guardian_consents WHERE organization_id = ${school}`;
    await owner`UPDATE guardians SET phone = ${phone}, phone_verified_at = now() WHERE id = ${guardian}`;
    await owner`UPDATE students SET status = 'active', processing_restricted_at = NULL WHERE id = ${pupil}`;
    await owner`UPDATE student_guardians SET has_legal_responsibility = true WHERE guardian_id = ${guardian}`;
    await owner`UPDATE organizations SET suspended_at = NULL WHERE id = ${school}`;
  });
  afterAll(async () => {
    await worker?.end();
    if (owner) {
      await owner`DELETE FROM sms_dispatches WHERE organization_id = ${school}`;
      await owner`DELETE FROM audit_events WHERE organization_id = ${school}`;
      await owner`DELETE FROM court_restrictions WHERE organization_id = ${school}`;
      await owner`DELETE FROM guardian_consents WHERE organization_id = ${school}`;
      await owner`DELETE FROM student_guardians WHERE organization_id = ${school}`;
      await owner`DELETE FROM guardians WHERE organization_id = ${school}`;
      await owner`DELETE FROM students WHERE organization_id = ${school}`;
      await owner`DELETE FROM users WHERE id = ${user}`;
      await owner`DELETE FROM organizations WHERE id = ${school}`;
      await owner.end();
    }
    await databaseClient.end();
  });

  it.each(["changed_phone", "unverified", "opted_out", "no_legal_link", "withdrawn", "privacy_hold", "suspended_school", "contact_order", "disclosure_order"])(
    "cancels a queued message after %s without claiming it", async change => {
      await queue();
      if (change === "changed_phone") await owner`UPDATE guardians SET phone = '+233241234568' WHERE id = ${guardian}`;
      if (change === "unverified") await owner`UPDATE guardians SET phone_verified_at = NULL WHERE id = ${guardian}`;
      if (change === "opted_out") await owner`INSERT INTO guardian_consents (organization_id, guardian_id, phone, opt_in_sms_announcements)
        VALUES (${school}, ${guardian}, ${phone}, false)`;
      if (change === "no_legal_link") await owner`UPDATE student_guardians SET has_legal_responsibility = false WHERE guardian_id = ${guardian}`;
      if (change === "withdrawn") await owner`UPDATE students SET status = 'withdrawn' WHERE id = ${pupil}`;
      if (change === "privacy_hold") await owner`UPDATE students SET processing_restricted_at = now() WHERE id = ${pupil}`;
      if (change === "suspended_school") await owner`UPDATE organizations SET suspended_at = now() WHERE id = ${school}`;
      if (change.endsWith("_order")) await owner`INSERT INTO court_restrictions
        (organization_id, student_id, restricted_guardian_id, restricted_person_name, docket_number, issuing_court, summary,
          effective_date, prohibit_pickup, prohibit_direct_contact, prohibit_disclosure)
        VALUES (${school}, ${pupil}, ${guardian}, 'Test Guardian', 'TEST-1', 'Test Court', 'Test restriction',
          CURRENT_DATE, false, ${change === "contact_order"}, ${change === "disclosure_order"})`;
      expect(await claim()).toHaveLength(0);
      const [dispatch] = await owner`SELECT status, attempt_count, lease_token FROM sms_dispatches WHERE organization_id = ${school}`;
      expect(dispatch).toMatchObject({ status: "cancelled", attempt_count: 0, lease_token: null });
    });

  it("normalizes verified local numbers and claims a dispatch exactly once across workers", async () => {
    await owner`UPDATE guardians SET phone = '024 123 4567' WHERE id = ${guardian}`;
    await queue();
    const claims = await Promise.all([claim(), claim()]);
    expect(claims.flat()).toHaveLength(1);
    expect(claims.flat()[0].recipient_phone).toBe(phone);
    expect(claims.flat()[0].lease_token).toBeTruthy();
  });
  it("keeps pupil data inaccessible to the worker and the privileged claim function inaccessible to the web role", async () => {
    await expect(worker`SELECT * FROM guardians`).rejects.toThrow("permission denied");
    await expect(databaseClient`SELECT * FROM public.klassa_claim_sms_dispatch(${randomUUID()})`).rejects.toThrow("permission denied");
  });
  it("records a timeout as unknown and does not resend it on the next tick", async () => {
    await queue();
    let requests = 0;
    const runtime = createSmsWorker({ sql: worker, enabled: true, apiKey: "test", sender: "Test",
      writeHeartbeat: async () => {}, request: async () => { requests++; throw new Error("Timeout"); } });
    await runtime.tick();
    await runtime.tick();
    expect(requests).toBe(1);
    expect((await owner`SELECT status, attempt_count FROM sms_dispatches WHERE organization_id = ${school}`)[0])
      .toMatchObject({ status: "unknown", attempt_count: 1 });
  });
  it("reconciles provider acceptance to confirmed recipient delivery", async () => {
    await queue();
    const runtime = createSmsWorker({ sql: worker, enabled: true, apiKey: "test", sender: "Test", writeHeartbeat: async () => {},
      request: async (_url: unknown, init?: RequestInit) => new Response(JSON.stringify(init?.method === "POST"
        ? { status: "success", summary: { _id: "test-campaign", total_sent: 1, total_rejected: 0 } }
        : { status: "success", report: [{ recipient: phone, status: "DELIVERED" }] })) });
    await runtime.tick();
    expect((await owner`SELECT status, provider_ref, lease_token FROM sms_dispatches WHERE organization_id = ${school}`)[0])
      .toMatchObject({ status: "delivered", provider_ref: "test-campaign", lease_token: null });
  });
  it("preserves late provider proof after lease expiry without a second worker resending", async () => {
    await queue();
    let releaseRequest!: (response: Response) => void;
    let markStarted!: () => void;
    const started = new Promise<void>(resolve => { markStarted = resolve; });
    let requests = 0;
    const runtime = createSmsWorker({ sql: worker, enabled: true, apiKey: "test", sender: "Test", writeHeartbeat: async () => {},
      request: async (_url: unknown, init?: RequestInit) => {
        if (init?.method === "POST") {
          requests++;
          markStarted();
          return new Promise<Response>(resolve => { releaseRequest = resolve; });
        }
        return new Response(JSON.stringify({ status: "success", report: [{ recipient: phone, status: "DELIVERED" }] }));
      } });
    const originalTick = runtime.tick();
    await started;
    await runtime.heartbeat();
    await owner`UPDATE sms_dispatches SET leased_until = now() - interval '1 second' WHERE organization_id = ${school}`;
    const recovery = createSmsWorker({ sql: worker, enabled: true, apiKey: "test", sender: "Test", writeHeartbeat: async () => {},
      request: async () => { throw new Error("Recovery must not send this message again"); } });
    await recovery.tick();
    expect((await owner`SELECT status FROM sms_dispatches WHERE organization_id = ${school}`)[0].status).toBe("unknown");
    releaseRequest(new Response(JSON.stringify({ status: "success", summary: { _id: "late-proof", total_sent: 1, total_rejected: 0 } })));
    await originalTick;
    expect(requests).toBe(1);
    expect((await owner`SELECT status, provider_ref FROM sms_dispatches WHERE organization_id = ${school}`)[0])
      .toMatchObject({ status: "delivered", provider_ref: "late-proof" });
  });
});
