import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url || !/^(localhost|127\.0\.0\.1)$/.test(new URL(url).hostname)) {
  throw new Error("This rollback-only probe requires a local disposable PostgreSQL DATABASE_URL.");
}
const sql = postgres(url, { max: 1 });
const rollback = new Error("ROLLBACK_PROBE");
try {
  await sql.begin(async tx => {
    const schoolA = randomUUID();
    const schoolB = randomUUID();
    const userId = `rls-probe-${randomUUID()}`;
    const studentA = randomUUID();
    const dispatchB = randomUUID();
    const studentB = randomUUID();
    const privacyB = randomUUID();
    await tx`INSERT INTO organizations (id, name, slug) VALUES
      (${schoolA}, 'Probe A', ${`probe-${schoolA}`}), (${schoolB}, 'Probe B', ${`probe-${schoolB}`})`;
    await tx`INSERT INTO users (id, name, email) VALUES (${userId}, 'Probe staff', ${`${userId}@invalid.example`})`;
    await tx`INSERT INTO sms_dispatches (id, organization_id, recipient_phone, recipient_name, message)
      VALUES (${dispatchB}, ${schoolB}, '+233241234567', 'Probe contact', 'Probe message')`;
    await tx`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth) VALUES
      (${studentA}, ${schoolA}, 'PROBE-RLS-1', 'Probe', 'A', '2018-01-01'),
      (${studentB}, ${schoolB}, 'PROBE-RLS-1', 'Probe', 'B', '2018-01-01')`;
    await tx`INSERT INTO gdpr_requests (id, organization_id, student_id, request_type, requester_name,
      requester_role, requester_email, justification)
      VALUES (${privacyB}, ${schoolB}, ${studentB}, 'restrict', 'Probe guardian', 'guardian',
        'probe@invalid.example', 'A valid synthetic privacy request')`;
    await tx`SET ROLE klassa_app`;
    await tx`SELECT set_config('app.organization_ids', ${schoolA}, true)`;
    await tx`SELECT set_config('app.platform_access', 'false', true)`;
    assert.equal((await tx`SELECT id FROM students WHERE id IN (${studentA}, ${studentB})`).length, 1);
    assert.equal((await tx`SELECT count(*)::int AS n FROM sms_dispatches`)[0].n, 0);
    assert.equal((await tx`SELECT count(*)::int AS n FROM gdpr_requests`)[0].n, 0);
    assert.equal((await tx`UPDATE students SET first_name = 'leak' WHERE id = ${studentB} RETURNING id`).length, 0);
    assert.equal((await tx`UPDATE gdpr_requests SET status = 'completed' WHERE id = ${privacyB} RETURNING id`).length, 0);
    await tx`SAVEPOINT denied_insert`;
    let denied = false;
    try {
      await tx`INSERT INTO sms_dispatches (organization_id, recipient_phone, recipient_name, message)
        VALUES (${schoolB}, '+233241234567', 'Probe contact', 'Cross-school write')`;
    } catch { denied = true; }
    await tx`ROLLBACK TO SAVEPOINT denied_insert`;
    assert.equal(denied, true, "cross-school insert must fail");
    await tx`RELEASE SAVEPOINT denied_insert`;
    const own = await tx`INSERT INTO sms_dispatches (organization_id, recipient_phone, recipient_name, message)
      VALUES (${schoolA}, '+233241234567', 'Probe contact', 'Own-school write') RETURNING id`;
    assert.equal(own.length, 1);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await sql.end(); }
process.stdout.write("Two-school pupil, SMS and privacy RLS probe passed; all rows rolled back.\n");
