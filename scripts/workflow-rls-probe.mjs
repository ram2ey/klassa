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
    const yearA = randomUUID();
    const yearB = randomUUID();
    const userId = `rls-probe-${randomUUID()}`;
    const dayA = randomUUID();
    const dayB = randomUUID();
    const broadcastB = randomUUID();
    const dispatchB = randomUUID();
    const studentB = randomUUID();
    const privacyB = randomUUID();
    await tx`INSERT INTO organizations (id, name, slug) VALUES
      (${schoolA}, 'Probe A', ${`probe-${schoolA}`}), (${schoolB}, 'Probe B', ${`probe-${schoolB}`})`;
    await tx`INSERT INTO users (id, name, email) VALUES (${userId}, 'Probe staff', ${`${userId}@invalid.example`})`;
    await tx`INSERT INTO academic_years (id, organization_id, name, starts_on, ends_on) VALUES
      (${yearA}, ${schoolA}, '2026', '2026-01-01', '2026-12-31'),
      (${yearB}, ${schoolB}, '2026', '2026-01-01', '2026-12-31')`;
    await tx`INSERT INTO school_calendar_days (id, organization_id, academic_year_id, calendar_date, is_teaching_day, reason)
      VALUES (${dayA}, ${schoolA}, ${yearA}, '2026-09-28', true, 'Probe'),
        (${dayB}, ${schoolB}, ${yearB}, '2026-09-28', true, 'Probe')`;
    await tx`INSERT INTO emergency_broadcasts (id, organization_id, requested_by, scope, target_id,
      severity, reason, message, student_ids, unreachable_student_ids, recipient_count)
      VALUES (${broadcastB}, ${schoolB}, ${userId}, 'whole_school', 'all', 'lockdown', 'Probe',
        'Probe message', '[]'::jsonb, '[]'::jsonb, 0)`;
    await tx`INSERT INTO sms_dispatches (id, organization_id, recipient_phone, recipient_name, message)
      VALUES (${dispatchB}, ${schoolB}, '+233241234567', 'Probe contact', 'Probe message')`;
    await tx`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth)
      VALUES (${studentB}, ${schoolB}, 'PROBE-RLS-1', 'Probe', 'Pupil', '2018-01-01')`;
    await tx`INSERT INTO gdpr_requests (id, organization_id, student_id, request_type, requester_name,
      requester_role, requester_email, justification)
      VALUES (${privacyB}, ${schoolB}, ${studentB}, 'restrict', 'Probe guardian', 'guardian',
        'probe@invalid.example', 'A valid synthetic privacy request')`;
    await tx`SET ROLE klassa_app`;
    await tx`SELECT set_config('app.organization_ids', ${schoolA}, true)`;
    await tx`SELECT set_config('app.platform_access', 'false', true)`;
    assert.equal((await tx`SELECT count(*)::int AS n FROM school_calendar_days`)[0].n, 1);
    assert.equal((await tx`SELECT count(*)::int AS n FROM emergency_broadcasts`)[0].n, 0);
    assert.equal((await tx`SELECT count(*)::int AS n FROM sms_dispatches`)[0].n, 0);
    assert.equal((await tx`SELECT count(*)::int AS n FROM gdpr_requests`)[0].n, 0);
    assert.equal((await tx`UPDATE school_calendar_days SET reason = 'leak' WHERE id = ${dayB} RETURNING id`).length, 0);
    assert.equal((await tx`UPDATE gdpr_requests SET status = 'completed' WHERE id = ${privacyB} RETURNING id`).length, 0);
    await tx`SAVEPOINT denied_insert`;
    let denied = false;
    try {
      await tx`INSERT INTO school_calendar_days (organization_id, academic_year_id, calendar_date,
        is_teaching_day, reason) VALUES (${schoolB}, ${yearB}, '2026-09-29', false, 'leak')`;
    } catch { denied = true; }
    await tx`ROLLBACK TO SAVEPOINT denied_insert`;
    assert.equal(denied, true, "cross-school insert must fail");
    await tx`RELEASE SAVEPOINT denied_insert`;
    const own = await tx`INSERT INTO emergency_broadcasts (organization_id, requested_by, scope,
      target_id, severity, reason, message, student_ids, unreachable_student_ids, recipient_count)
      VALUES (${schoolA}, ${userId}, 'whole_school', 'all', 'lockdown', 'Probe', 'Probe message',
        '[]'::jsonb, '[]'::jsonb, 0) RETURNING id`;
    assert.equal(own.length, 1);
    throw rollback;
  });
} catch (error) {
  if (error !== rollback) throw error;
} finally { await sql.end(); }
process.stdout.write("Two-school calendar, broadcast, dispatch and privacy RLS probe passed; all rows rolled back.\n");
