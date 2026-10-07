import { randomUUID } from "node:crypto";
import postgres, { type Sql } from "postgres";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { db, databaseClient } from "@/db";
import { feePayments, reportCardSubjectGrades } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runWithRlsContext } from "@/db/rls-context";
import { saveMvpCommand } from "./mvp-service";
import { getMvpData } from "./mvp-data";
import { saveSchoolRecord } from "./school-admin-service";
import type { MvpInput } from "./mvp-policy";
import { requireStaff } from "./action-access";
import { getFeeReceipt, getFeeStatement } from "./mvp-print-data";

vi.mock("./action-access", () => ({ requireStaff: vi.fn() }));

const school = randomUUID(), otherSchool = randomUUID(), year = randomUUID(), grade = randomUUID(), klass = randomUUID(), term = randomUUID(), maths = randomUUID(), english = randomUUID(), foreignPupil = randomUUID();
const adminId = `mvp-admin-${randomUUID()}`, officeId = `mvp-office-${randomUUID()}`, teacherId = `mvp-teacher-${randomUUID()}`, subjectTeacherId = `mvp-subject-${randomUUID()}`;
const admin = { userId: adminId, name: "Admin", organizationId: school, role: "school_admin" as const };
const office = { ...admin, userId: officeId, role: "office_staff" as const };
const teacher = { ...admin, userId: teacherId, role: "teacher" as const };
const subjectTeacher = { ...admin, userId: subjectTeacherId, role: "teacher" as const };
let owner: Sql, pupil: string;
function scoped<T>(actor: typeof admin | typeof office | typeof teacher, action: () => T) {
  return runWithRlsContext({ organizationIds: [actor.organizationId], userId: actor.userId, platform: false }, action);
}
function command<T extends MvpInput>(input: T): T & { requestId: string } { return { ...input, requestId: randomUUID() }; }
function save(input: MvpInput, actor: typeof admin | typeof office | typeof teacher = admin) {
  return scoped(actor, () => saveMvpCommand(actor, command(input)));
}

describe("staff MVP on PostgreSQL", () => {
  beforeAll(async () => {
    owner = postgres(process.env.RLS_TEST_ADMIN_URL!, { max: 1 });
    await owner`INSERT INTO organizations (id,name,slug) VALUES (${school},'MVP school',${`mvp-${school}`}),(${otherSchool},'Other school',${`mvp-${otherSchool}`})`;
    for (const actor of [admin, office, teacher, subjectTeacher]) {
      await owner`INSERT INTO users (id,name,email,organization_id,role) VALUES (${actor.userId},${actor.name},${`${actor.userId}@invalid.example`},${school},${actor.role})`;
      await owner`INSERT INTO organization_memberships (organization_id,user_id,role) VALUES (${school},${actor.userId},${actor.role})`;
    }
    // A teacher who administers another school must still have no fee access here.
    await owner`INSERT INTO organization_memberships (organization_id,user_id,role) VALUES (${otherSchool},${subjectTeacherId},'school_admin')`;
    await owner`INSERT INTO academic_years (id,organization_id,name,starts_on,ends_on,is_current) VALUES (${year},${school},'2026','2026-01-01','2026-12-31',true)`;
    await owner`INSERT INTO grade_levels (id,organization_id,name,position) VALUES (${grade},${school},'Basic 4',4)`;
    await owner`INSERT INTO classes (id,organization_id,academic_year_id,grade_level_id,name,homeroom_teacher_id) VALUES (${klass},${school},${year},${grade},'4A',${teacherId})`;
    await owner`INSERT INTO terms (id,organization_id,academic_year_id,name,starts_on,ends_on,position) VALUES (${term},${school},${year},'Term 1','2026-01-01','2026-12-31',1)`;
    await owner`INSERT INTO subjects (id,organization_id,code,name) VALUES (${maths},${school},'MATH','Mathematics'),(${english},${school},'ENG','English')`;
    await owner`INSERT INTO teacher_class_assignments (organization_id,class_id,subject_id,teacher_id) VALUES (${school},${klass},${maths},${subjectTeacherId})`;
    await owner`INSERT INTO students (id,organization_id,student_number,first_name,last_name,date_of_birth,status) VALUES (${foreignPupil},${otherSchool},'FOREIGN-1','Foreign','Pupil','2015-01-01','active')`;
    const enrolled = await scoped(admin, () => saveSchoolRecord(admin, { kind: "student", firstName: "Ama", lastName: "Mensah", dateOfBirth: "2015-01-01", status: "active", classId: klass }));
    pupil = enrolled.entityId;
    await save({ kind: "class_subjects", classId: klass, subjectIds: [maths, english] });
  });
  afterAll(async () => {
    if (owner) {
      for (const table of ["mvp_operations","fee_payments","fee_entries","fee_definitions","fee_counters","audit_events","report_card_subject_grades","report_cards","term_marks","class_subjects","attendance_corrections","attendance_records","attendance_sessions","teacher_class_assignments","enrollments","students","classes","subjects","terms","grade_levels","academic_years","organization_memberships"]) await owner`DELETE FROM ${owner(table)} WHERE organization_id IN (${school},${otherSchool})`;
      await owner`DELETE FROM users WHERE id IN (${adminId},${officeId},${teacherId},${subjectTeacherId})`;
      await owner`DELETE FROM organizations WHERE id IN (${school},${otherSchool})`;
      await owner.end();
    }
    await databaseClient.end();
  });
  it("records one daily register and audits corrections", async () => {
    await save({ kind: "attendance", classId: klass, date: "2026-09-01", submit: true, rows: [{ studentId: pupil, status: "present" }] }, teacher);
    await expect(save({ kind: "attendance", classId: klass, date: "2026-09-01", submit: true, rows: [{ studentId: pupil, status: "absent" }] }, office)).rejects.toThrow("Explain");
    await save({ kind: "attendance", classId: klass, date: "2026-09-01", submit: true, rows: [{ studentId: pupil, status: "late" }], correctionReason: "Corrected from signed register" }, office);
    expect(await owner`SELECT id FROM attendance_sessions WHERE organization_id = ${school}`).toHaveLength(1);
    expect(await owner`SELECT id FROM attendance_corrections WHERE organization_id = ${school}`).toHaveLength(1);
  });
  it("requires complete scores, preserves zero marks, and locks term weights after the first save", async () => {
    await save({ kind: "marks", classId: klass, termId: term, subjectId: maths, rows: [{ studentId: pupil, classworkScore: 80, examScore: 75, remark: "Good progress" }] }, subjectTeacher);
    await expect(save({ kind: "term_weights", termId: term, classworkWeight: 30 })).rejects.toThrow("first marks");
    await expect(save({ kind: "class_subjects", classId: klass, subjectIds: [maths] })).rejects.toThrow("Subjects cannot change");
    await expect(save({ kind: "reports", classId: klass, termId: term, studentIds: [pupil], publish: true })).rejects.toThrow("English");
    expect(await owner`SELECT id FROM report_cards WHERE organization_id = ${school}`).toHaveLength(0);
    await save({ kind: "marks", classId: klass, termId: term, subjectId: english, rows: [{ studentId: pupil, classworkScore: 0, examScore: 0, remark: "Needs support" }] }, teacher);
    await save({ kind: "reports", classId: klass, termId: term, studentIds: [pupil], publish: false, teacherRemarks: "Keep practising" }, teacher);
    await save({ kind: "reports", classId: klass, termId: term, studentIds: [pupil], publish: true });
    const scores = await owner`SELECT score_percentage FROM report_card_subject_grades WHERE organization_id = ${school} ORDER BY score_percentage`;
    expect(scores.map(r => r.score_percentage)).toEqual(["0.00", "77.00"]);
    await save({ kind: "reports", classId: klass, termId: term, studentIds: [pupil], publish: true });
    expect(await owner`SELECT id FROM report_cards WHERE organization_id = ${school}`).toHaveLength(1);
  });
  it("requires correction reasons and creates a new immutable report version", async () => {
    const input: MvpInput = { kind: "marks", classId: klass, termId: term, subjectId: maths, rows: [{ studentId: pupil, classworkScore: 90, examScore: 75, remark: "Good progress" }] };
    await expect(save(input, teacher)).rejects.toThrow("Explain corrections");
    await save({ ...input, correctionReason: "Corrected classwork entry" }, teacher);
    const previous = await owner`SELECT score_percentage FROM report_card_subject_grades WHERE organization_id = ${school} AND subject_id = ${maths}`;
    expect(previous[0].score_percentage).toBe("77.00");
    await expect(scoped(admin, () => saveSchoolRecord(admin, { kind: "term_lock", termId: term }))).rejects.toThrow("corrected marks");
    await save({ kind: "reports", classId: klass, termId: term, studentIds: [pupil], publish: true });
    const versions = await owner`SELECT version FROM report_cards WHERE organization_id = ${school} ORDER BY version`;
    expect(versions.map(r => r.version)).toEqual([1, 2]);
    const [snapshot] = await owner`SELECT id FROM report_card_subject_grades WHERE organization_id = ${school} AND score_percentage = 77`;
    await expect(scoped(admin, async () => await db.update(reportCardSubjectGrades).set({ scorePercentage: "99.00" }).where(eq(reportCardSubjectGrades.id, snapshot.id)))).rejects.toThrow();
    const [card] = await owner`SELECT id FROM report_cards WHERE organization_id = ${school} AND version = 1`;
    await expect(scoped(admin, async () => await db.insert(reportCardSubjectGrades).values({ organizationId: school, reportCardId: card.id, subjectId: maths, scorePercentage: "99.00" }))).rejects.toThrow();
  });
  it("rejects unauthorized subject edits, teacher fees and foreign-school pupils", async () => {
    await expect(save({ kind: "marks", classId: klass, termId: term, subjectId: english, rows: [{ studentId: pupil, classworkScore: 1, examScore: 1, remark: "" }] }, subjectTeacher)).rejects.toThrow("not assigned");
    await expect(save({ kind: "payment", studentId: pupil, amountPesewas: 1, date: "2026-09-01", method: "cash" }, teacher)).rejects.toThrow("Teachers cannot");
    await expect(save({ kind: "payment", studentId: foreignPupil, amountPesewas: 1, date: "2026-09-01", method: "cash" })).rejects.toThrow("Pupil was not found");
    const view = await scoped(subjectTeacher, () => getMvpData(subjectTeacher, "marks", "2026-09-01"));
    expect(view.marks.every(m => m.subjectId === maths)).toBe(true);
    expect(view.pupils.some(p => p.id === foreignPupil)).toBe(false);
    expect(view.payments).toEqual([]);
    expect(await scoped(subjectTeacher, async () => await db.select().from(feePayments))).toEqual([]);
  });
  it("posts fees once, keeps opening debts unique, and calculates partial payments and credits", async () => {
    await save({ kind: "fee_entry", studentId: pupil, entryKind: "opening", amountPesewas: 10000, reason: "Unpaid prior term fees", date: "2026-09-01" });
    await expect(save({ kind: "fee_entry", studentId: pupil, entryKind: "opening", amountPesewas: 10000, reason: "Unpaid prior term fees", date: "2026-09-01" })).rejects.toThrow();
    const fee = await save({ kind: "fee_definition", classId: klass, termId: term, name: "Tuition", amountPesewas: 45000 });
    await save({ kind: "fee_apply", definitionId: fee.entityId, studentIds: [pupil] });
    const retry = await save({ kind: "fee_apply", definitionId: fee.entityId, studentIds: [pupil] });
    expect(retry.message).toContain("0 new");
    await save({ kind: "fee_entry", studentId: pupil, entryKind: "adjustment", amountPesewas: -5000, reason: "Sibling discount", date: "2026-09-01" });
    const input = command({ kind: "payment", studentId: pupil, amountPesewas: 20000, date: "2026-09-01", method: "mobile_money", reference: "TEST-1" });
    const payment = await scoped(office, () => saveMvpCommand(office, input));
    const repeated = await scoped(office, () => saveMvpCommand(office, input));
    expect(repeated.entityId).toBe(payment.entityId);
    const [row] = await owner`SELECT balance_after_pesewas FROM fee_payments WHERE id = ${payment.entityId}`;
    expect(Number(row.balance_after_pesewas)).toBe(30000);
    await expect(scoped(office, () => saveMvpCommand(office, { ...input, amountPesewas: 100 }))).rejects.toThrow("different details");
    const paid = await save({ kind: "payment", studentId: pupil, amountPesewas: 40000, date: "2026-09-01", method: "bank" }, office);
    const view = await scoped(admin, () => getMvpData(admin, "fees", "2026-09-01"));
    expect(view.balances.find(b => b.studentId === pupil)?.amountPesewas).toBe(-10000);
    await expect(save({ kind: "payment_void", paymentId: paid.entityId, reason: "Wrong account" }, office)).rejects.toThrow("Office staff");
    await save({ kind: "payment_void", paymentId: paid.entityId, reason: "Wrong account" });
    const afterVoid = await scoped(admin, () => getMvpData(admin, "fees", "2026-09-01"));
    expect(afterVoid.balances.find(b => b.studentId === pupil)?.amountPesewas).toBe(30000);
  });
  it("allocates distinct receipts concurrently and refuses direct ledger rewrites", async () => {
    await Promise.all([1, 2, 3].map(n => save({ kind: "payment", studentId: pupil, amountPesewas: n, date: "2026-09-01", method: "cash" }, office)));
    const payments = await owner`SELECT id,receipt_number FROM fee_payments WHERE organization_id = ${school}`;
    expect(new Set(payments.map(p => p.receipt_number)).size).toBe(payments.length);
    await expect(scoped(admin, async () => await db.update(feePayments).set({ amountPesewas: 1 }).where(eq(feePayments.id, payments[0].id)))).rejects.toThrow();
  });
  it("scopes printable statements and receipts to the signed-in school", async () => {
    vi.mocked(requireStaff).mockResolvedValue(office);
    const [payment] = await owner`SELECT id FROM fee_payments WHERE organization_id = ${school} LIMIT 1`;
    expect((await scoped(office, () => getFeeStatement(pupil)))?.pupil.id).toBe(pupil);
    expect((await scoped(office, () => getFeeReceipt(payment.id)))?.payment.id).toBe(payment.id);
    expect(await scoped(office, () => getFeeStatement(foreignPupil))).toBeNull();
    const foreignActor = { ...admin, organizationId: otherSchool, userId: subjectTeacherId };
    vi.mocked(requireStaff).mockResolvedValue(foreignActor);
    expect(await scoped(foreignActor, () => getFeeReceipt(payment.id))).toBeNull();
    expect(await scoped(foreignActor, () => getFeeStatement(pupil))).toBeNull();
  });
  it("rolls back payment and counter writes when the audit fails", async () => {
    const before = await owner`SELECT next_number FROM fee_counters WHERE organization_id = ${school}`;
    await owner.unsafe(`CREATE FUNCTION mvp_test_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.organization_id = '${school}' AND NEW.action = 'mvp.payment' THEN RAISE EXCEPTION 'test audit failure'; END IF; RETURN NEW; END $$`);
    await owner.unsafe('CREATE TRIGGER mvp_test_audit_failure BEFORE INSERT ON audit_events FOR EACH ROW EXECUTE FUNCTION mvp_test_audit_failure()');
    const input = command({ kind: "payment", studentId: pupil, amountPesewas: 100, date: "2026-09-01", method: "cash" });
    try {
      await expect(scoped(office, () => saveMvpCommand(office, input))).rejects.toThrow();
      expect(await owner`SELECT id FROM mvp_operations WHERE request_id = ${input.requestId}`).toHaveLength(0);
      expect(await owner`SELECT next_number FROM fee_counters WHERE organization_id = ${school}`).toEqual(before);
    } finally { await owner.unsafe('DROP TRIGGER mvp_test_audit_failure ON audit_events; DROP FUNCTION mvp_test_audit_failure()'); }
  });
  it("locks term marks after reviewed reports are published", async () => {
    await scoped(admin, () => saveSchoolRecord(admin, { kind: "term_lock", termId: term }));
    await expect(save({ kind: "marks", classId: klass, termId: term, subjectId: maths, rows: [{ studentId: pupil, classworkScore: 90, examScore: 75, remark: "" }], correctionReason: "Locked term test" })).rejects.toThrow("locked");
    await expect(save({ kind: "reports", classId: klass, termId: term, studentIds: [pupil], publish: true })).rejects.toThrow("locked");
  });
});
