import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { databaseClient } from "@/db";
import { runWithRlsContext } from "@/db/rls-context";
import { saveSchoolRecord } from "./school-admin-service";
import { saveSchoolWorkflow } from "./school-workflow-service";
import { approveSchoolRollover, type RolloverInput } from "./school-rollover";

const school = randomUUID();
const user = `rollover-test-${randomUUID()}`;
const source = randomUUID();
const target = randomUUID();
const grade = randomUUID();
const sourceClass = randomUUID();
const targetClass = randomUUID();
const term = randomUUID();
const subject = randomUUID();
const actor = { organizationId: school, userId: user, name: "Admin", role: "school_admin" as const };
function scoped<T>(operation: () => T) {
  return runWithRlsContext({ organizationIds: [school], userId: user, platform: false }, operation);
}

describe("live school workflow and complete rollover receipts", () => {
  let owner: Sql;
  let placements: RolloverInput["placements"];
  beforeAll(async () => {
    owner = postgres(process.env.RLS_TEST_ADMIN_URL!, { max: 1 });
    await owner`INSERT INTO organizations (id, name, slug) VALUES (${school}, 'Rollover Test', ${`rollover-test-${school}`})`;
    await owner`INSERT INTO users (id, name, email) VALUES (${user}, 'Admin', ${`${user}@invalid.example`})`;
    await owner`INSERT INTO academic_years (id, organization_id, name, starts_on, ends_on, is_current) VALUES
      (${source}, ${school}, '2026', '2026-01-01', '2026-12-31', true),
      (${target}, ${school}, '2027', '2027-01-01', '2027-12-31', false)`;
    await owner`INSERT INTO grade_levels (id, organization_id, name, position) VALUES (${grade}, ${school}, 'Basic 5', 5)`;
    await owner`INSERT INTO classes (id, organization_id, academic_year_id, grade_level_id, name) VALUES
      (${sourceClass}, ${school}, ${source}, ${grade}, 'Current'), (${targetClass}, ${school}, ${target}, ${grade}, 'Next')`;
    await owner`INSERT INTO terms (id, organization_id, academic_year_id, name, starts_on, ends_on, position)
      VALUES (${term}, ${school}, ${source}, 'Annual', '2026-01-01', '2026-12-31', 1)`;
    await owner`INSERT INTO subjects (id, organization_id, code, name) VALUES (${subject}, ${school}, 'MATH', 'Maths')`;
  });
  afterAll(async () => {
    if (owner) {
      // Explicit child-first cleanup also checks the workflow left no unexpected dependencies.
      for (const table of ["audit_events", "report_card_subject_grades", "report_cards", "grade_corrections", "assessment_grades", "assessments",
        "assessment_categories", "attendance_corrections", "attendance_records", "attendance_sessions", "enrollments", "students", "classes", "subjects", "terms", "grade_levels", "academic_years"]) {
        await owner`DELETE FROM ${owner(table)} WHERE organization_id = ${school}`;
      }
      await owner`DELETE FROM users WHERE id = ${user}`;
      await owner`DELETE FROM organizations WHERE id = ${school}`;
      await owner.end();
    }
    await databaseClient.end();
  });

  it("enrolls pupils, publishes attendance and fractional grades, publishes reports, then closes the term and rolls over", async () => {
    const pupils: string[] = [];
    for (let i = 0; i < 3; i++) {
      const result = await scoped(() => saveSchoolRecord(actor, { kind: "student", firstName: "Test", lastName: `Pupil ${i}`,
        dateOfBirth: "2015-01-01", status: "active", classId: sourceClass }));
      pupils.push(result.entityId);
    }
    for (const studentId of pupils) await scoped(() => saveSchoolWorkflow(actor, {
      kind: "attendance", classId: sourceClass, sessionDate: "2026-09-01", studentId, status: "present" }));
    await scoped(() => saveSchoolWorkflow(actor, { kind: "attendance_submit", classId: sourceClass, sessionDate: "2026-09-01" }));
    const category = await scoped(() => saveSchoolWorkflow(actor, { kind: "category", academicYearId: source, subjectId: subject, name: "Exam", weight: 100 }));
    const assessment = await scoped(() => saveSchoolWorkflow(actor, { kind: "assessment", classId: sourceClass, termId: term,
      subjectId: subject, categoryId: category.entityId, title: "Fractional marks", maxScore: 199, dateDue: "2026-09-01" }));
    for (const studentId of pupils) await scoped(() => saveSchoolWorkflow(actor, {
      kind: "grade_entry", assessmentId: assessment.entityId, studentId, score: 185.06 }));
    const grades = await owner`SELECT percentage, letter_grade FROM assessment_grades WHERE organization_id = ${school}`;
    expect(grades).toHaveLength(3);
    expect(grades.every(row => row.percentage === "92.99" && row.letter_grade === "A-")).toBe(true);
    await scoped(() => saveSchoolWorkflow(actor, { kind: "assessment_publish", assessmentId: assessment.entityId }));
    for (const studentId of pupils) {
      const card = await scoped(() => saveSchoolWorkflow(actor, { kind: "report_generate", studentId, termId: term }));
      await scoped(() => saveSchoolWorkflow(actor, { kind: "report_status", reportCardId: card.entityId, status: "approved" }));
      await scoped(() => saveSchoolWorkflow(actor, { kind: "report_status", reportCardId: card.entityId, status: "published" }));
    }
    placements = [{ studentId: pupils[0], outcome: "move", classId: targetClass },
      { studentId: pupils[1], outcome: "graduate" }, { studentId: pupils[2], outcome: "withdraw" }];
    await expect(scoped(() => approveSchoolRollover(actor, { sourceYearId: source, targetYearId: target, placements })))
      .rejects.toThrow("Close every source-year term");
    await scoped(() => saveSchoolRecord(actor, { kind: "term_lock", termId: term, lockNotes: "Release verification" }));
    await expect(scoped(() => approveSchoolRollover(actor, { sourceYearId: source, targetYearId: target, placements })))
      .resolves.toEqual({ moved: 1, alreadyApplied: false });
    expect(await owner`SELECT id FROM academic_years WHERE organization_id = ${school} AND is_current`).toEqual([{ id: target }]);
    expect((await owner`SELECT status FROM attendance_sessions WHERE organization_id = ${school}`)[0].status).toBe("locked");
    expect((await owner`SELECT id FROM report_cards WHERE organization_id = ${school} AND status = 'published'`)).toHaveLength(3);
  });
  it("replays identical placements regardless of order without duplicate enrollment or audit writes", async () => {
    await expect(scoped(() => approveSchoolRollover(actor, { sourceYearId: source, targetYearId: target, placements: [...placements].reverse() })))
      .resolves.toEqual({ moved: 1, alreadyApplied: true });
    expect(await owner`SELECT id FROM enrollments WHERE organization_id = ${school} AND academic_year_id = ${target}`).toHaveLength(1);
    expect(await owner`SELECT id FROM audit_events WHERE organization_id = ${school} AND action = 'academic_year.rollover_approved'`).toHaveLength(1);
  });
  it.each([1, 2])("rejects a retry changing the leaving decision for pupil %s", async index => {
    const changed = placements.map((item, i) => i === index ? { studentId: item.studentId,
      outcome: item.outcome === "graduate" ? "withdraw" as const : "graduate" as const } : item);
    await expect(scoped(() => approveSchoolRollover(actor, { sourceYearId: source, targetYearId: target, placements: changed })))
      .rejects.toThrow("different placements");
    expect((await owner`SELECT status FROM students WHERE id = ${placements[index].studentId}`)[0].status)
      .toBe(index === 1 ? "graduated" : "withdrawn");
  });
  it("rejects an unverifiable legacy receipt rather than reporting a changed request as success", async () => {
    await owner`UPDATE audit_events SET metadata = metadata - 'fingerprint' WHERE organization_id = ${school} AND action = 'academic_year.rollover_approved'`;
    await expect(scoped(() => approveSchoolRollover(actor, { sourceYearId: source, targetYearId: target, placements })))
      .rejects.toThrow("different placements");
  });
});
