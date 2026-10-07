import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, attendanceCorrections, attendanceRecords, attendanceSessions, classSubjects, classes, enrollments,
  feeCounters, feeDefinitions, feeEntries, feePayments, mvpOperations, organizations, reportCards, reportCardSubjectGrades,
  students, subjects, teacherClassAssignments, termMarks, terms } from "@/db/schema";
import type { requireStaff } from "./action-access";
import { logAuditEvent } from "./audit";
import { SchoolAdminError } from "./school-admin-policy";
import { accountBalance, mvpCommandSchema, termTotal, type MvpCommand } from "./mvp-policy";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
function found<T>(row: T | undefined, label: string): T {
  if (!row) throw new SchoolAdminError(`${label} was not found in your school.`);
  return row;
}
function admin(actor: Actor) {
  if (actor.role !== "school_admin") throw new SchoolAdminError("Only a school administrator can do this.");
}
async function classAccess(tx: Tx, actor: Actor, classId: string, subjectId?: string, homeroomOnly = false) {
  const klass = found((await tx.select().from(classes).where(and(eq(classes.organizationId, actor.organizationId), eq(classes.id, classId))))[0], "Class");
  if (actor.role === "teacher") {
    const assignments = await tx.select().from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, actor.organizationId), eq(teacherClassAssignments.teacherId, actor.userId), eq(teacherClassAssignments.classId, classId)));
    const home = klass.homeroomTeacherId === actor.userId || assignments.some(a => a.isPrimaryHomeroom);
    if (!home && (homeroomOnly || !assignments.some(a => subjectId ? a.subjectId === subjectId : true))) throw new SchoolAdminError("This class or subject is not assigned to you.");
  }
  return klass;
}
async function termForClass(tx: Tx, org: string, termId: string, yearId: string, requireOpen = true) {
  const term = found((await tx.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.id, termId))))[0], "Term");
  if (term.academicYearId !== yearId) throw new SchoolAdminError("The class and term must belong to the same academic year.");
  if (requireOpen && term.isLocked) throw new SchoolAdminError("This term is closed and locked.");
  return term;
}
async function activeRoster(tx: Tx, org: string, classId: string, yearId: string) {
  return tx.select({ id: students.id, firstName: students.firstName, lastName: students.lastName }).from(students)
    .innerJoin(enrollments, eq(enrollments.studentId, students.id)).where(and(eq(students.organizationId, org), eq(students.status, "active"),
      eq(enrollments.organizationId, org), eq(enrollments.classId, classId), eq(enrollments.academicYearId, yearId), eq(enrollments.status, "active")));
}
async function pupilBalance(tx: Tx, org: string, studentId: string) {
  const [entries, payments] = await Promise.all([
    tx.select().from(feeEntries).where(and(eq(feeEntries.organizationId, org), eq(feeEntries.studentId, studentId))),
    tx.select().from(feePayments).where(and(eq(feePayments.organizationId, org), eq(feePayments.studentId, studentId))),
  ]);
  return accountBalance(entries, payments);
}

/** School lock serializes receipt allocation, setup, roster changes and retry receipts. */
export async function saveMvpCommand(actor: Actor, raw: MvpCommand) {
  if (!["school_admin", "office_staff", "teacher"].includes(actor.role)) throw new SchoolAdminError("School staff access required.");
  const value = mvpCommandSchema.parse(raw);
  if (actor.role === "office_staff" && !["payment", "attendance"].includes(value.kind)) throw new SchoolAdminError("Office staff can record payments and correct attendance.");
  if (actor.role === "teacher" && !["marks", "reports", "attendance"].includes(value.kind)) throw new SchoolAdminError("Teachers cannot access fees or school setup.");
  if (value.kind === "reports" && value.publish) admin(actor);
  const org = actor.organizationId;
  return db.transaction(async tx => {
    found((await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update"))[0], "School");
    const hash = fingerprint(value);
    const [receipt] = await tx.select().from(mvpOperations).where(and(eq(mvpOperations.organizationId, org), eq(mvpOperations.requestId, value.requestId)));
    if (receipt) {
      if (receipt.actorId !== actor.userId || receipt.fingerprint !== hash) throw new SchoolAdminError("This request was already used for different details. Start a new request.");
      return receipt.result;
    }
    let result: { entityId: string; message: string; ids?: string[] };
    switch (value.kind) {
      case "class_subjects": {
        admin(actor);
        await classAccess(tx, actor, value.classId);
        const chosen = await tx.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.organizationId, org), inArray(subjects.id, value.subjectIds)));
        if (chosen.length !== value.subjectIds.length) throw new SchoolAdminError("Choose subjects from this school.");
        const existingMarks = await tx.select({ id: termMarks.id }).from(termMarks).where(and(eq(termMarks.organizationId, org), eq(termMarks.classId, value.classId))).limit(1);
        if (existingMarks.length) throw new SchoolAdminError("Subjects cannot change after marks have been saved for this class. Configure the next year's class instead.");
        await tx.delete(classSubjects).where(and(eq(classSubjects.organizationId, org), eq(classSubjects.classId, value.classId)));
        await tx.insert(classSubjects).values(value.subjectIds.map(subjectId => ({ organizationId: org, classId: value.classId, subjectId })));
        result = { entityId: value.classId, message: "Class subjects saved." };
        break;
      }
      case "term_weights": {
        admin(actor);
        const term = found((await tx.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.id, value.termId))))[0], "Term");
        if (term.isLocked) throw new SchoolAdminError("This term is closed and locked.");
        if ((await tx.select({ id: termMarks.id }).from(termMarks).where(and(eq(termMarks.organizationId, org), eq(termMarks.termId, term.id))).limit(1)).length) throw new SchoolAdminError("Weights cannot change after the first marks are saved.");
        await tx.update(terms).set({ classworkWeight: value.classworkWeight, updatedAt: new Date() }).where(eq(terms.id, term.id));
        result = { entityId: term.id, message: "Term weighting saved." };
        break;
      }
      case "marks": {
        const klass = await classAccess(tx, actor, value.classId, value.subjectId);
        await termForClass(tx, org, value.termId, klass.academicYearId);
        found((await tx.select().from(classSubjects).where(and(eq(classSubjects.organizationId, org), eq(classSubjects.classId, klass.id), eq(classSubjects.subjectId, value.subjectId))))[0], "Class subject");
        const roster = await activeRoster(tx, org, klass.id, klass.academicYearId);
        if (new Set(value.rows.map(r => r.studentId)).size !== value.rows.length || value.rows.some(r => !roster.some(p => p.id === r.studentId))) throw new SchoolAdminError("Choose each active pupil in this class at most once.");
        const published = await tx.select({ studentId: reportCards.studentId }).from(reportCards).where(and(eq(reportCards.organizationId, org), eq(reportCards.termId, value.termId), eq(reportCards.status, "published")));
        for (const row of value.rows) {
          const [previous] = await tx.select().from(termMarks).where(and(eq(termMarks.organizationId, org), eq(termMarks.studentId, row.studentId), eq(termMarks.termId, value.termId), eq(termMarks.subjectId, value.subjectId)));
          const fields = { classworkScore: row.classworkScore === null ? null : row.classworkScore.toFixed(2), examScore: row.examScore === null ? null : row.examScore.toFixed(2), remark: row.remark };
          const changed = !previous || previous.classworkScore !== fields.classworkScore || previous.examScore !== fields.examScore || previous.remark !== fields.remark;
          if (changed && published.some(p => p.studentId === row.studentId) && value.correctionReason.length < 4) throw new SchoolAdminError("Explain corrections to marks used in a published report.");
          if (previous && changed) await tx.update(termMarks).set({ ...fields, classId: klass.id, updatedBy: actor.userId, updatedAt: new Date() }).where(eq(termMarks.id, previous.id));
          else if (!previous) await tx.insert(termMarks).values({ ...fields, organizationId: org, classId: klass.id, studentId: row.studentId, termId: value.termId, subjectId: value.subjectId, updatedBy: actor.userId });
        }
        result = { entityId: klass.id, message: "Term marks saved. Published reports remain unchanged until a new version is published." };
        break;
      }
      case "reports": {
        const klass = await classAccess(tx, actor, value.classId, undefined, true);
        const term = await termForClass(tx, org, value.termId, klass.academicYearId);
        const roster = await activeRoster(tx, org, klass.id, klass.academicYearId);
        if (value.studentIds.some(id => !roster.some(p => p.id === id))) throw new SchoolAdminError("Choose active pupils in this class.");
        const offered = await tx.select({ id: subjects.id, name: subjects.name }).from(classSubjects).innerJoin(subjects, eq(subjects.id, classSubjects.subjectId))
          .where(and(eq(classSubjects.organizationId, org), eq(classSubjects.classId, klass.id), eq(subjects.organizationId, org))).orderBy(subjects.name);
        if (!offered.length) throw new SchoolAdminError("Configure the subjects offered by this class first.");
        const marks = await tx.select().from(termMarks).where(and(eq(termMarks.organizationId, org), eq(termMarks.termId, term.id), inArray(termMarks.studentId, value.studentIds)));
        const sessions = await tx.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), eq(attendanceSessions.academicYearId, term.academicYearId), eq(attendanceSessions.period, "morning_roll_call"),
          inArray(attendanceSessions.status, ["submitted", "locked"]), sql`${attendanceSessions.sessionDate} BETWEEN ${term.startsOn} AND ${term.endsOn}`));
        const records = sessions.length ? await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessions.map(s => s.id)), inArray(attendanceRecords.studentId, value.studentIds))) : [];
        const ids: string[] = [];
        for (const studentId of value.studentIds) {
          const results = offered.map(subject => {
            const mark = marks.find(m => m.studentId === studentId && m.subjectId === subject.id);
            if (!mark || mark.classworkScore === null || mark.examScore === null) {
              const pupil = roster.find(p => p.id === studentId)!;
              throw new SchoolAdminError(`Complete both scores for ${pupil.firstName} ${pupil.lastName}: ${subject.name}. No reports were changed.`);
            }
            return { subjectId: subject.id, subjectName: subject.name, classworkScore: mark.classworkScore, examScore: mark.examScore,
              classworkWeight: term.classworkWeight, scorePercentage: termTotal(Number(mark.classworkScore), Number(mark.examScore), term.classworkWeight)!, comments: mark.remark };
          });
          const attendance = records.filter(r => r.studentId === studentId);
          const counts = { daysPresent: attendance.filter(r => r.status === "present").length, daysAbsent: attendance.filter(r => r.status === "absent").length,
            daysLate: attendance.filter(r => r.status === "late").length, daysExcused: attendance.filter(r => r.status === "excused").length };
          const [latest] = await tx.select().from(reportCards).where(and(eq(reportCards.organizationId, org), eq(reportCards.studentId, studentId), eq(reportCards.termId, term.id))).orderBy(desc(reportCards.version)).limit(1);
          const teacherRemarks = value.teacherRemarks || latest?.teacherRemarks || "";
          const principalRemarks = actor.role === "teacher" ? latest?.principalRemarks || "" : value.principalRemarks || latest?.principalRemarks || "";
          const sourceFingerprint = fingerprint({ results, counts, teacherRemarks, principalRemarks });
          if (latest?.sourceFingerprint === sourceFingerprint && latest.status === "published") { ids.push(latest.id); continue; }
          const fields = { ...counts, teacherRemarks, principalRemarks, sourceFingerprint,
            overallPercentage: (results.reduce((sum, r) => sum + Number(r.scorePercentage), 0) / results.length).toFixed(2),
            attendanceRate: attendance.length ? ((counts.daysPresent + counts.daysLate + counts.daysExcused) / attendance.length * 100).toFixed(1) : null };
          let cardId: string;
          if (latest?.status === "draft") {
            cardId = latest.id;
            await tx.update(reportCards).set({ ...fields, classId: klass.id, updatedAt: new Date() }).where(eq(reportCards.id, cardId));
            await tx.delete(reportCardSubjectGrades).where(and(eq(reportCardSubjectGrades.organizationId, org), eq(reportCardSubjectGrades.reportCardId, cardId)));
          } else {
            const [card] = await tx.insert(reportCards).values({ ...fields, organizationId: org, studentId, academicYearId: klass.academicYearId, termId: term.id, classId: klass.id, version: (latest?.version ?? 0) + 1 }).returning();
            cardId = card.id;
          }
          await tx.insert(reportCardSubjectGrades).values(results.map(r => ({ ...r, organizationId: org, reportCardId: cardId })));
          if (value.publish) await tx.update(reportCards).set({ status: "published", approvedBy: actor.userId, publishedAt: new Date(), updatedAt: new Date() }).where(eq(reportCards.id, cardId));
          ids.push(cardId);
        }
        result = { entityId: klass.id, ids, message: `${ids.length} report(s) ${value.publish ? "published" : "prepared for review"}.` };
        break;
      }
      case "attendance": {
        const klass = await classAccess(tx, actor, value.classId, undefined, true);
        const year = found((await tx.select().from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.id, klass.academicYearId))))[0], "Academic year");
        if (value.date < year.startsOn || value.date > year.endsOn || value.date > new Date().toISOString().slice(0, 10)) throw new SchoolAdminError("Choose a date within the academic year and no later than today.");
        const locked = await tx.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.academicYearId, year.id), eq(terms.isLocked, true), sql`${terms.startsOn} <= ${value.date} AND ${terms.endsOn} >= ${value.date}`));
        if (locked.length) throw new SchoolAdminError("This term is closed and locked.");
        const roster = await activeRoster(tx, org, klass.id, year.id);
        if (new Set(value.rows.map(r => r.studentId)).size !== value.rows.length || value.rows.some(r => !roster.some(p => p.id === r.studentId)) || value.rows.length !== roster.length) throw new SchoolAdminError("Mark every active pupil in this class exactly once.");
        let [session] = await tx.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), eq(attendanceSessions.classId, klass.id), eq(attendanceSessions.sessionDate, value.date), eq(attendanceSessions.period, "morning_roll_call")));
        if (session?.status === "locked") throw new SchoolAdminError("This register is locked.");
        if (actor.role === "office_staff" && session?.status !== "submitted") throw new SchoolAdminError("Office staff can correct submitted registers. A teacher or administrator must first take attendance.");
        if (!session) [session] = await tx.insert(attendanceSessions).values({ organizationId: org, academicYearId: year.id, classId: klass.id, sessionDate: value.date, period: "morning_roll_call", recordedBy: actor.userId }).returning();
        const previous = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), eq(attendanceRecords.sessionId, session.id)));
        for (const row of value.rows) {
          const old = previous.find(p => p.studentId === row.studentId);
          if (session.status === "submitted" && (!old || old.status !== row.status)) {
            if (value.correctionReason.length < 4) throw new SchoolAdminError("Explain changes to a submitted register.");
            if (old) await tx.insert(attendanceCorrections).values({ organizationId: org, attendanceRecordId: old.id, studentId: row.studentId, previousStatus: old.status, newStatus: row.status, reason: value.correctionReason, correctedBy: actor.userId });
          }
          if (old) await tx.update(attendanceRecords).set({ status: row.status, updatedAt: new Date() }).where(eq(attendanceRecords.id, old.id));
          else await tx.insert(attendanceRecords).values({ organizationId: org, sessionId: session.id, studentId: row.studentId, status: row.status });
        }
        if (value.submit && session.status !== "submitted") await tx.update(attendanceSessions).set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(eq(attendanceSessions.id, session.id));
        result = { entityId: session.id, message: session.status === "submitted" ? "Attendance corrections saved." : value.submit ? "Daily register submitted." : "Daily register saved as draft." };
        break;
      }
      case "fee_definition": {
        admin(actor);
        const klass = await classAccess(tx, actor, value.classId);
        await termForClass(tx, org, value.termId, klass.academicYearId, false);
        const [definition] = await tx.insert(feeDefinitions).values({ organizationId: org, classId: klass.id, termId: value.termId, name: value.name, amountPesewas: value.amountPesewas }).returning();
        result = { entityId: definition.id, message: "Class fee saved. Review pupils before applying it." };
        break;
      }
      case "fee_apply": {
        admin(actor);
        const definition = found((await tx.select().from(feeDefinitions).where(and(eq(feeDefinitions.organizationId, org), eq(feeDefinitions.id, value.definitionId))))[0], "Class fee");
        const klass = await classAccess(tx, actor, definition.classId);
        const roster = await activeRoster(tx, org, klass.id, klass.academicYearId);
        if (value.studentIds.some(id => !roster.some(p => p.id === id))) throw new SchoolAdminError("Choose active pupils in the fee's class.");
        const posted = await tx.insert(feeEntries).values(value.studentIds.map(studentId => ({ organizationId: org, studentId, termId: definition.termId, definitionId: definition.id, kind: "charge" as const,
          label: definition.name, amountPesewas: definition.amountPesewas, entryDate: new Date().toISOString().slice(0, 10), recordedBy: actor.userId }))).onConflictDoNothing().returning();
        result = { entityId: definition.id, message: `${posted.length} new charge(s) applied; existing charges kept.` };
        break;
      }
      case "fee_entry": {
        admin(actor);
        if (value.date > new Date().toISOString().slice(0, 10)) throw new SchoolAdminError("An account entry cannot be dated in the future.");
        found((await tx.select().from(students).where(and(eq(students.organizationId, org), eq(students.id, value.studentId))))[0], "Pupil");
        if (value.termId) found((await tx.select().from(terms).where(and(eq(terms.organizationId, org), eq(terms.id, value.termId))))[0], "Term");
        if (value.entryKind === "opening" && value.amountPesewas < 0) throw new SchoolAdminError("Opening debt must be positive; use an adjustment for credit.");
        const [entry] = await tx.insert(feeEntries).values({ organizationId: org, studentId: value.studentId, termId: value.termId, kind: value.entryKind,
          label: value.entryKind === "opening" ? "Opening balance" : "Individual adjustment", amountPesewas: value.amountPesewas, reason: value.reason, entryDate: value.date, recordedBy: actor.userId }).returning();
        result = { entityId: entry.id, message: "Pupil account updated." };
        break;
      }
      case "payment": {
        if (value.date > new Date().toISOString().slice(0, 10)) throw new SchoolAdminError("A payment cannot be dated in the future.");
        found((await tx.select().from(students).where(and(eq(students.organizationId, org), eq(students.id, value.studentId))))[0], "Pupil");
        await tx.insert(feeCounters).values({ organizationId: org }).onConflictDoNothing();
        const [counter] = await tx.update(feeCounters).set({ nextNumber: sql`${feeCounters.nextNumber} + 1` }).where(eq(feeCounters.organizationId, org)).returning();
        const receiptNumber = `RC-${String(counter.nextNumber - 1).padStart(6, "0")}`;
        const balanceAfterPesewas = (await pupilBalance(tx, org, value.studentId)) - value.amountPesewas;
        const [payment] = await tx.insert(feePayments).values({ organizationId: org, studentId: value.studentId, amountPesewas: value.amountPesewas, balanceAfterPesewas, receiptNumber,
          paymentDate: value.date, method: value.method, reference: value.reference, recordedBy: actor.userId }).returning();
        result = { entityId: payment.id, message: `Payment recorded. Receipt ${receiptNumber}.` };
        break;
      }
      case "payment_void": {
        admin(actor);
        const payment = found((await tx.select().from(feePayments).where(and(eq(feePayments.organizationId, org), eq(feePayments.id, value.paymentId))))[0], "Payment");
        if (payment.voidedAt) throw new SchoolAdminError("This payment is already void.");
        await tx.update(feePayments).set({ voidedAt: new Date(), voidedBy: actor.userId, voidReason: value.reason }).where(eq(feePayments.id, payment.id));
        result = { entityId: payment.id, message: `Receipt ${payment.receiptNumber} voided; the original payment remains on record.` };
        break;
      }
    }
    await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: `mvp.${value.kind}`, entityType: value.kind, entityId: result.entityId, requestId: value.requestId,
      metadata: { command: value, result } }, tx);
    await tx.insert(mvpOperations).values({ organizationId: org, requestId: value.requestId, actorId: actor.userId, fingerprint: hash, result });
    return result;
  });
}
