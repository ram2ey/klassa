import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { academicYears, attendanceRecords, attendanceSessions, classes, enrollments, gdprRequests,
  organizations, reportCardSubjectGrades, reportCards, students, subjects, terms } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
export class SchoolGdprError extends Error {}
export const gdprRequestInput = z.object({ studentId: z.uuid(),
  requestType: z.enum(["export", "rectify", "anonymize", "restrict"]),
  requesterName: z.string().trim().min(2).max(180),
  requesterRole: z.enum(["guardian", "student", "representative", "other"]),
  requesterEmail: z.email().max(255), justification: z.string().trim().min(10).max(2000) });
export type GdprRequestInput = z.input<typeof gdprRequestInput>;
export const gdprDecisionInput = z.object({ requestId: z.uuid(),
  status: z.enum(["completed", "rejected"]), note: z.string().trim().min(10).max(2000) });
export type GdprDecisionInput = z.input<typeof gdprDecisionInput>;

function requireAdmin(actor: Actor) {
  if (actor.role !== "school_admin") throw new SchoolGdprError("School administrator access required.");
}

export async function createSchoolGdprRequest(actor: Actor, raw: GdprRequestInput) {
  requireAdmin(actor);
  const input = gdprRequestInput.parse(raw);
  return db.transaction(async tx => {
    const [student] = await tx.select({ id: students.id }).from(students).where(and(
      eq(students.id, input.studentId), eq(students.organizationId, actor.organizationId)));
    if (!student) throw new SchoolGdprError("Student was not found in your school.");
    const [created] = await tx.insert(gdprRequests).values({ organizationId: actor.organizationId,
      studentId: student.id, requestType: input.requestType, requesterName: input.requesterName,
      requesterRole: input.requesterRole, requesterEmail: input.requesterEmail,
      justification: input.justification, safeguardingRedacted: input.requestType === "export" })
      .returning({ id: gdprRequests.id });
    if (!created) throw new SchoolGdprError("The request could not be recorded.");
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: "gdpr.request_recorded", entityType: "gdpr_request", entityId: created.id,
      metadata: { studentId: student.id, requestType: input.requestType } }, tx);
    return { requestId: created.id };
  });
}

export async function generateSchoolGdprExtract(actor: Actor, rawRequestId: string) {
  requireAdmin(actor);
  const requestId = z.uuid().parse(rawRequestId);
  return db.transaction(async tx => {
    const [request] = await tx.select().from(gdprRequests).where(and(
      eq(gdprRequests.id, requestId), eq(gdprRequests.organizationId, actor.organizationId))).for("update");
    if (!request) throw new SchoolGdprError("Request was not found in your school.");
    if (request.requestType !== "export" || request.status === "rejected") {
      throw new SchoolGdprError("This request is not available for a data extract.");
    }
    const [student] = await tx.select({ id: students.id, studentNumber: students.studentNumber,
      externalReference: students.externalReference, firstName: students.firstName,
      middleName: students.middleName, lastName: students.lastName, preferredName: students.preferredName,
      dateOfBirth: students.dateOfBirth, status: students.status }).from(students).where(and(
      eq(students.id, request.studentId), eq(students.organizationId, actor.organizationId)));
    if (!student) throw new SchoolGdprError("Student was not found in your school.");
    const [school] = await tx.select({ name: organizations.name }).from(organizations)
      .where(eq(organizations.id, actor.organizationId));
    if (!school) throw new SchoolGdprError("School was not found.");
    const [placements, attendance, cards] = await Promise.all([
      tx.select({ academicYear: academicYears.name, className: classes.name,
        status: enrollments.status, startsOn: enrollments.startsOn, endsOn: enrollments.endsOn })
        .from(enrollments).leftJoin(academicYears, and(eq(academicYears.id, enrollments.academicYearId),
          eq(academicYears.organizationId, actor.organizationId)))
        .leftJoin(classes, and(eq(classes.id, enrollments.classId), eq(classes.organizationId, actor.organizationId)))
        .where(and(eq(enrollments.organizationId, actor.organizationId), eq(enrollments.studentId, student.id))),
      tx.select({ date: attendanceSessions.sessionDate, period: attendanceSessions.period,
        status: attendanceRecords.status, arrivalMinutesLate: attendanceRecords.arrivalMinutesLate,
        reason: attendanceRecords.reason })
        .from(attendanceRecords).innerJoin(attendanceSessions, eq(attendanceSessions.id, attendanceRecords.sessionId))
        .where(and(eq(attendanceRecords.organizationId, actor.organizationId),
          eq(attendanceSessions.organizationId, actor.organizationId), eq(attendanceRecords.studentId, student.id),
          inArray(attendanceSessions.status, ["submitted", "locked"]))),
      tx.select({ id: reportCards.id, termName: terms.name, version: reportCards.version,
        overallPercentage: reportCards.overallPercentage, gpa: reportCards.gpa,
        attendanceRate: reportCards.attendanceRate, publishedAt: reportCards.publishedAt })
        .from(reportCards).innerJoin(terms, and(eq(terms.id, reportCards.termId),
          eq(terms.organizationId, actor.organizationId)))
        .where(and(eq(reportCards.organizationId, actor.organizationId), eq(reportCards.studentId, student.id),
          eq(reportCards.status, "published"))),
    ]);
    const cardSubjects = cards.length ? await tx.select({ reportCardId: reportCardSubjectGrades.reportCardId,
      subjectName: subjects.name, scorePercentage: reportCardSubjectGrades.scorePercentage,
      letterGrade: reportCardSubjectGrades.letterGrade })
      .from(reportCardSubjectGrades).innerJoin(subjects, and(eq(subjects.id, reportCardSubjectGrades.subjectId),
        eq(subjects.organizationId, actor.organizationId)))
      .where(and(eq(reportCardSubjectGrades.organizationId, actor.organizationId),
        inArray(reportCardSubjectGrades.reportCardId, cards.map(card => card.id)))) : [];
    const generatedAt = new Date();
    const extract = { metadata: { requestId, generatedAt: generatedAt.toISOString(), schoolName: school.name,
      studentId: student.id, scope: "School record extract for administrator review",
      excluded: ["sensitive cases", "medical records", "confidential notes", "third-party contact details"] },
      student, placements, attendance,
      publishedReportCards: cards.map(card => ({ termName: card.termName, version: card.version,
        overallPercentage: card.overallPercentage, gpa: card.gpa, attendanceRate: card.attendanceRate,
        publishedAt: card.publishedAt, subjects: cardSubjects.filter(subject => subject.reportCardId === card.id)
          .map(({ subjectName, scorePercentage, letterGrade }) => ({ subjectName, scorePercentage, letterGrade })) })) };
    if (request.status !== "completed") await tx.update(gdprRequests).set({ status: "in_review", processedAt: generatedAt,
      processedBy: actor.userId, updatedAt: generatedAt }).where(and(eq(gdprRequests.id, requestId),
      eq(gdprRequests.organizationId, actor.organizationId)));
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: "gdpr.extract_generated", entityType: "gdpr_request", entityId: requestId,
      metadata: { studentId: student.id, sections: ["student", "placements", "attendance", "publishedReportCards"] } }, tx);
    return extract;
  });
}

export async function decideSchoolGdprRequest(actor: Actor, raw: GdprDecisionInput) {
  requireAdmin(actor);
  const input = gdprDecisionInput.parse(raw);
  return db.transaction(async tx => {
    const [request] = await tx.select().from(gdprRequests).where(and(
      eq(gdprRequests.id, input.requestId), eq(gdprRequests.organizationId, actor.organizationId))).for("update");
    if (!request) throw new SchoolGdprError("Request was not found in your school.");
    if (request.status === "completed" || request.status === "rejected") {
      throw new SchoolGdprError("This request has already been closed.");
    }
    if (input.status === "completed" && request.requestType === "export" && !request.processedAt) {
      throw new SchoolGdprError("Generate and review the extract before marking this request fulfilled.");
    }
    const now = new Date();
    await tx.update(gdprRequests).set({ status: input.status, processedAt: now,
      processedBy: actor.userId, updatedAt: now }).where(and(eq(gdprRequests.id, request.id),
      eq(gdprRequests.organizationId, actor.organizationId)));
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: input.status === "completed" ? "gdpr.request_fulfilled" : "gdpr.request_rejected",
      entityType: "gdpr_request", entityId: request.id,
      metadata: { studentId: request.studentId, requestType: request.requestType, note: input.note } }, tx);
    return { requestId: request.id, status: input.status };
  });
}
