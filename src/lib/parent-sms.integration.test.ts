import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseClient } from "@/db";
import { runWithRlsContext } from "@/db/rls-context";
import { previewParentSmsRecipients, queueParentSmsAnnouncement } from "./parent-sms-service";

const school = randomUUID();
const actorId = `sms-test-${randomUUID()}`;
const previousYear = randomUUID();
const currentYear = randomUUID();
const grade = randomUUID();
const nextGrade = randomUUID();
const oldClass = randomUUID();
const currentClass = randomUUID();
const nextClass = randomUUID();
const pupils = Array.from({ length: 4 }, () => randomUUID());
const contacts = Array.from({ length: 4 }, () => randomUUID());
const actor = { organizationId: school, userId: actorId, name: "Office", role: "office_staff" as const };
function scoped<T>(operation: () => T) {
  return runWithRlsContext({ organizationIds: [school], userId: actorId, platform: false }, operation);
}

describe("live parent SMS targeting and retries", () => {
  let owner: Sql;
  beforeAll(async () => {
    owner = postgres(process.env.RLS_TEST_ADMIN_URL!, { max: 1 });
    await owner.begin(async tx => {
      await tx`INSERT INTO organizations (id, name, slug) VALUES (${school}, 'SMS Test', ${`sms-test-${school}`})`;
      await tx`INSERT INTO users (id, name, email) VALUES (${actorId}, 'Office', ${`${actorId}@invalid.example`})`;
      await tx`INSERT INTO academic_years (id, organization_id, name, starts_on, ends_on, is_current) VALUES
        (${previousYear}, ${school}, 'Previous', '2025-01-01', '2025-12-31', false),
        (${currentYear}, ${school}, 'Current', '2026-01-01', '2026-12-31', true)`;
      await tx`INSERT INTO grade_levels (id, organization_id, name, position) VALUES
        (${grade}, ${school}, 'Basic 5', 5), (${nextGrade}, ${school}, 'Basic 6', 6)`;
      await tx`INSERT INTO classes (id, organization_id, academic_year_id, grade_level_id, name) VALUES
        (${oldClass}, ${school}, ${previousYear}, ${grade}, 'Old Basic 5'),
        (${currentClass}, ${school}, ${currentYear}, ${grade}, 'Current Basic 5'),
        (${nextClass}, ${school}, ${currentYear}, ${nextGrade}, 'Current Basic 6')`;
      for (let i = 0; i < pupils.length; i++) {
        await tx`INSERT INTO students (id, organization_id, student_number, first_name, last_name, date_of_birth, status, processing_restricted_at)
          VALUES (${pupils[i]}, ${school}, ${`TEST-${i}`}, 'Pupil', ${String(i)}, '2015-01-01',
            ${i === 2 ? 'withdrawn' : 'active'}, ${i === 3 ? new Date() : null})`;
        await tx`INSERT INTO guardians (id, organization_id, first_name, last_name, phone, phone_verified_at)
          VALUES (${contacts[i]}, ${school}, 'Guardian', ${String(i)}, ${`+23324123456${i}`}, now())`;
        await tx`INSERT INTO student_guardians (organization_id, student_id, guardian_id, relationship, has_legal_responsibility)
          VALUES (${school}, ${pupils[i]}, ${contacts[i]}, 'parent', true)`;
        await tx`INSERT INTO enrollments (organization_id, student_id, academic_year_id, class_id, status, starts_on)
          VALUES (${school}, ${pupils[i]}, ${currentYear}, ${i === 1 ? nextClass : currentClass}, 'active', '2026-01-01')`;
      }
      // Rollover keeps historic enrollments active, even for pupils now in Basic 6.
      await tx`INSERT INTO enrollments (organization_id, student_id, academic_year_id, class_id, status, starts_on, ends_on)
        VALUES (${school}, ${pupils[1]}, ${previousYear}, ${oldClass}, 'active', '2025-01-01', '2025-12-31')`;
    });
  });
  afterAll(async () => {
    if (owner) {
      await owner.begin(async tx => {
        await tx`DELETE FROM sms_dispatches WHERE organization_id = ${school}`;
        await tx`DELETE FROM audit_events WHERE organization_id = ${school}`;
        await tx`DELETE FROM enrollments WHERE organization_id = ${school}`;
        await tx`DELETE FROM student_guardians WHERE organization_id = ${school}`;
        await tx`DELETE FROM guardians WHERE organization_id = ${school}`;
        await tx`DELETE FROM students WHERE organization_id = ${school}`;
        await tx`DELETE FROM classes WHERE organization_id = ${school}`;
        await tx`DELETE FROM grade_levels WHERE organization_id = ${school}`;
        await tx`DELETE FROM academic_years WHERE organization_id = ${school}`;
        await tx`DELETE FROM users WHERE id = ${actorId}`;
        await tx`DELETE FROM organizations WHERE id = ${school}`;
      });
      await owner.end();
    }
    await databaseClient.end();
  });
  const message = "School closes at noon today.";

  it("targets only current-grade, active, unrestricted pupils after rollover", async () => {
    await expect(scoped(() => previewParentSmsRecipients(actor, { scope: "grade", targetId: grade, message })))
      .resolves.toEqual({ recipientCount: 1, unreachableCount: 0 });
    await expect(scoped(() => previewParentSmsRecipients(actor, { scope: "class", targetId: currentClass, message })))
      .resolves.toEqual({ recipientCount: 1, unreachableCount: 0 });
    await expect(scoped(() => previewParentSmsRecipients(actor, { scope: "whole_school", targetId: "all", message })))
      .resolves.toEqual({ recipientCount: 2, unreachableCount: 0 });
  });
  it("rejects historic class IDs", async () => {
    await expect(scoped(() => previewParentSmsRecipients(actor, { scope: "class", targetId: oldClass, message })))
      .rejects.toThrow("current academic year");
  });
  it("commits one campaign for concurrent requests and replays it after recipients change", async () => {
    const input = { scope: "grade" as const, targetId: grade, message, requestId: randomUUID() };
    const results = await Promise.all(Array.from({ length: 3 }, () => scoped(() => queueParentSmsAnnouncement(actor, input))));
    expect(results[0]).toEqual(results[1]);
    expect(results[0]).toEqual(results[2]);
    expect(results[0].queuedCount).toBe(1);
    const dispatches = await owner`SELECT id FROM sms_dispatches WHERE organization_id = ${school}`;
    const receipts = await owner`SELECT id FROM audit_events WHERE organization_id = ${school}`;
    expect(dispatches).toHaveLength(1);
    expect(receipts).toHaveLength(1);
    await owner`UPDATE guardians SET phone_verified_at = NULL WHERE id = ${contacts[0]}`;
    await expect(scoped(() => queueParentSmsAnnouncement(actor, input))).resolves.toEqual(results[0]);
    await expect(scoped(() => queueParentSmsAnnouncement(actor, { ...input, message: "A different notice" })))
      .rejects.toThrow("already used");
    await owner`UPDATE guardians SET phone_verified_at = now() WHERE id = ${contacts[0]}`;
  });
  it("rolls back dispatches when the audit write fails", async () => {
    const invalidActor = { ...actor, userId: `missing-${randomUUID()}` };
    await expect(scoped(() => queueParentSmsAnnouncement(invalidActor, {
      scope: "grade", targetId: grade, message, requestId: randomUUID(),
    }))).rejects.toThrow();
    const dispatches = await owner`SELECT id FROM sms_dispatches WHERE organization_id = ${school}`;
    expect(dispatches).toHaveLength(1);
  });
});
