import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { academicYears, announcements, assessmentCategories, assessmentGrades, assessments,
  attendanceCorrections, attendanceRecords, attendanceSessions, classes, clinicVisits, enrollments, gradeCorrections,
  gradeLevels, guardians, organizations, receptionLogs, reportCards, reportCardSubjectGrades, sensitiveAccessLogs,
  sensitiveCaseNotes, sensitiveCases, needToKnowAlerts, courtRestrictions, smsDispatches, studentBehaviours, studentGuardians, students, subjects, terms, teacherClassAssignments } from "@/db/schema";
import { AuditActions, logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";
import { SchoolAdminError } from "@/lib/school-admin-policy";
import { canTeacherTakeAttendance, workflowCommandSchema, type WorkflowCommand } from "@/lib/school-workflow-policy";
import { calculateWeightedTermGrade, scoreToGrade } from "@/lib/assessments";
import { decryptNarrative, encryptNarrative } from "@/lib/narrative-crypto";
import { canUserAccessCaseArea, generateDisclosurePackage, type CourtRestrictionRecord, type DisclosurePackageResult, type SensitiveCaseRecord } from "@/lib/sensitive-records";
import { canSpecialistRunCommand, isSpecialistRole } from "@/lib/specialist-access";
import { normalizePhoneNumber } from "@/lib/sms";
import { isDemoMode } from "@/lib/runtime-config";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
function found<T>(row: T | undefined, label: string): T {
  if (!row) throw new SchoolAdminError(`${label} was not found in your school.`);
  return row;
}
function decimal(value: number) { return value.toFixed(2); }

export async function saveSchoolWorkflow(actor: Actor, raw: WorkflowCommand) {
  if (actor.role !== "school_admin" && actor.role !== "teacher" && actor.role !== "office_staff" && !isSpecialistRole(actor.role)) throw new SchoolAdminError("School staff access required.");
  const value = workflowCommandSchema.parse(raw);
  if (actor.role === "office_staff" && value.kind !== "attendance" && value.kind !== "reception_log" && value.kind !== "emergency_sms_broadcast") {
    throw new SchoolAdminError("Office staff can only correct recorded attendance, log reception desk movements, or send emergency broadcasts.");
  }
  if (isSpecialistRole(actor.role) && !canSpecialistRunCommand(actor.role, value.kind)) throw new SchoolAdminError("Your specialist role cannot change this school record.");
  const org = actor.organizationId;
  return db.transaction(async tx => {
    found((await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update"))[0], "School");
    if (actor.role === "teacher") {
      const permitted = ["attendance", "attendance_submit", "assessment", "assessment_publish", "grade_entry", "report_generate", "report_remarks", "announcement", "behaviour_log"];
      if (!permitted.includes(value.kind)) throw new SchoolAdminError("Teachers cannot change this school record.");
      let assignedClassId: string | null = null;
      let assignedSubjectId: string | null = null;
      let homeroomOnly = false;
      if (value.kind === "attendance" || value.kind === "attendance_submit") assignedClassId = value.classId;
      if (value.kind === "assessment") { assignedClassId = value.classId; assignedSubjectId = value.subjectId; }
      if (value.kind === "announcement") {
        if (value.targetType !== "class") throw new SchoolAdminError("Teachers can publish only to an assigned class.");
        assignedClassId = value.targetId;
      }
      if (value.kind === "assessment_publish" || value.kind === "grade_entry") {
        const row = found((await tx.select({ classId: assessments.classId, subjectId: assessments.subjectId }).from(assessments)
          .where(and(eq(assessments.id, value.assessmentId), eq(assessments.organizationId, org))))[0], "Assessment");
        assignedClassId = row.classId; assignedSubjectId = row.subjectId;
      }
      if (value.kind === "report_generate") {
        const term = found((await tx.select({ academicYearId: terms.academicYearId }).from(terms).where(and(eq(terms.id, value.termId), eq(terms.organizationId, org))))[0], "Term");
        const enrollment = found((await tx.select({ classId: enrollments.classId }).from(enrollments).where(and(eq(enrollments.organizationId, org),
          eq(enrollments.studentId, value.studentId), eq(enrollments.academicYearId, term.academicYearId))))[0], "Enrollment");
        assignedClassId = enrollment.classId; homeroomOnly = true;
      }
      if (value.kind === "report_remarks") {
        const card = found((await tx.select({ classId: reportCards.classId }).from(reportCards).where(and(eq(reportCards.id, value.reportCardId), eq(reportCards.organizationId, org))))[0], "Report card");
        assignedClassId = card.classId; homeroomOnly = true;
      }
      if (value.kind === "behaviour_log") {
        if (value.classId) {
          assignedClassId = value.classId;
        } else {
          const teacherClasses = await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.organizationId, org), eq(classes.homeroomTeacherId, actor.userId)));
          const teacherAssignments = await tx.select({ classId: teacherClassAssignments.classId }).from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.teacherId, actor.userId)));
          const allTeacherClassIds = [...new Set([...teacherClasses.map(c => c.id), ...teacherAssignments.map(a => a.classId)])];
          const enrollment = allTeacherClassIds.length ? (await tx.select({ classId: enrollments.classId }).from(enrollments).where(and(
            eq(enrollments.organizationId, org),
            eq(enrollments.studentId, value.studentId),
            inArray(enrollments.classId, allTeacherClassIds),
            eq(enrollments.status, "active")
          )))[0] : null;
          if (!enrollment) throw new SchoolAdminError("You can only log behaviour for students enrolled in your assigned classes.");
          assignedClassId = enrollment.classId;
        }
      }
      if (!assignedClassId) throw new SchoolAdminError("This record has no assigned class.");
      const assignments = await tx.select().from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org),
        eq(teacherClassAssignments.teacherId, actor.userId), eq(teacherClassAssignments.classId, assignedClassId)));
      const assignedClass = found((await tx.select({ homeroomTeacherId: classes.homeroomTeacherId }).from(classes).where(and(eq(classes.id, assignedClassId), eq(classes.organizationId, org))))[0], "Class");
      if ((value.kind === "attendance" || value.kind === "attendance_submit") &&
        !canTeacherTakeAttendance(value.period, assignedClass.homeroomTeacherId === actor.userId || assignments.some(row => row.isPrimaryHomeroom), assignments.some(row => row.subjectId !== null))) {
        throw new SchoolAdminError("You are not assigned to take attendance for this class and period.");
      }
      if (value.kind !== "attendance" && value.kind !== "attendance_submit" && assignedClass.homeroomTeacherId !== actor.userId && !assignments.some(row =>
        value.kind === "announcement" || value.kind === "behaviour_log" ? row.isPrimaryHomeroom || row.subjectId !== null :
        homeroomOnly ? row.isPrimaryHomeroom : row.isPrimaryHomeroom || (!!assignedSubjectId && row.subjectId === assignedSubjectId))) {
        throw new SchoolAdminError("You are not assigned to this class or subject.");
      }
      if (value.kind === "behaviour_log") {
        const studentEnrollment = (await tx.select({ id: enrollments.id }).from(enrollments).where(and(
          eq(enrollments.organizationId, org),
          eq(enrollments.studentId, value.studentId),
          eq(enrollments.classId, assignedClassId),
          eq(enrollments.status, "active")
        )))[0];
        if (!studentEnrollment) throw new SchoolAdminError("Student is not actively enrolled in this class.");
      }
    }
    let entityId = "";
    let noteText: string[] | undefined;
    let packageResult: DisclosurePackageResult | undefined;
    let broadcastRecipientCount = 0;
    switch (value.kind) {
      case "attendance":
      case "attendance_submit": {
        const classRow = found((await tx.select().from(classes).where(and(eq(classes.id, value.classId), eq(classes.organizationId, org))))[0], "Class");
        const year = found((await tx.select().from(academicYears).where(and(eq(academicYears.id, classRow.academicYearId), eq(academicYears.organizationId, org))))[0], "Academic year");
        if (value.sessionDate < year.startsOn || value.sessionDate > year.endsOn) throw new SchoolAdminError("Attendance date must be within the class academic year.");
        const [lockedTerm] = await tx.select({ id: terms.id, name: terms.name }).from(terms)
          .where(and(
            eq(terms.organizationId, org),
            eq(terms.academicYearId, year.id),
            eq(terms.isLocked, true),
            sql`${value.sessionDate} >= ${terms.startsOn} AND ${value.sessionDate} <= ${terms.endsOn}`
          ));
        if (lockedTerm) throw new SchoolAdminError(`Attendance for ${lockedTerm.name} is closed and locked.`);
        let [session] = await tx.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), eq(attendanceSessions.classId, value.classId), eq(attendanceSessions.sessionDate, value.sessionDate), eq(attendanceSessions.period, value.period)));
        if (actor.role === "office_staff" && (!session || session.status !== "submitted")) throw new SchoolAdminError("Only submitted roll calls can be corrected by the office.");
        if (!session && value.kind === "attendance_submit") throw new SchoolAdminError("Record attendance before submitting the roll call.");
        if (!session) [session] = await tx.insert(attendanceSessions).values({ organizationId: org, academicYearId: year.id, classId: classRow.id, sessionDate: value.sessionDate, period: value.period, recordedBy: actor.userId }).returning();
        if (session.status === "locked") throw new SchoolAdminError("This roll call is locked.");
        if (value.kind === "attendance_submit") {
          const roster = await tx.select().from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.classId, classRow.id), eq(enrollments.academicYearId, year.id), eq(enrollments.status, "active")));
          const marked = await tx.select({ studentId: attendanceRecords.studentId }).from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), eq(attendanceRecords.sessionId, session.id)));
          if (roster.some(item => !marked.some(row => row.studentId === item.studentId))) throw new SchoolAdminError("Mark every active student before submitting attendance.");
          await tx.update(attendanceSessions).set({ status: "submitted", submittedAt: new Date(), updatedAt: new Date() }).where(and(eq(attendanceSessions.id, session.id), eq(attendanceSessions.organizationId, org)));
          entityId = session.id;
          break;
        }
        found((await tx.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.classId, classRow.id), eq(enrollments.academicYearId, year.id), eq(enrollments.studentId, value.studentId), eq(enrollments.status, "active"))))[0], "Active enrollment");
        const [previous] = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), eq(attendanceRecords.sessionId, session.id), eq(attendanceRecords.studentId, value.studentId)));
        if (actor.role === "office_staff" && (!previous || value.correctionReason.length < 4)) throw new SchoolAdminError("Explain the attendance correction.");
        if (previous && session.status === "submitted" &&
          (previous.status !== value.status || (actor.role === "office_staff" && (previous.reason ?? "") !== value.reason))) {
          if (value.correctionReason.length < 4) throw new SchoolAdminError("Explain the correction to submitted attendance.");
          await tx.insert(attendanceCorrections).values({ organizationId: org, attendanceRecordId: previous.id, studentId: value.studentId,
            previousStatus: previous.status, newStatus: value.status, reason: value.correctionReason, correctedBy: actor.userId });
        }
        const fields = { status: value.status, reason: value.reason || null, arrivalMinutesLate: 0, updatedAt: new Date() };
        const [record] = previous
          ? await tx.update(attendanceRecords).set(fields).where(and(eq(attendanceRecords.id, previous.id), eq(attendanceRecords.organizationId, org))).returning()
          : await tx.insert(attendanceRecords).values({ ...fields, organizationId: org, sessionId: session.id, studentId: value.studentId }).returning();
        entityId = record.id;
        break;
      }
      case "category": {
        found((await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.id, value.academicYearId), eq(academicYears.organizationId, org))))[0], "Academic year");
        found((await tx.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, value.subjectId), eq(subjects.organizationId, org))))[0], "Subject");
        const [row] = await tx.insert(assessmentCategories).values({ organizationId: org, academicYearId: value.academicYearId,
          subjectId: value.subjectId, name: value.name, weight: value.weight }).returning();
        entityId = row.id;
        break;
      }
      case "assessment": {
        const classRow = found((await tx.select().from(classes).where(and(eq(classes.id, value.classId), eq(classes.organizationId, org))))[0], "Class");
        const term = found((await tx.select().from(terms).where(and(eq(terms.id, value.termId), eq(terms.organizationId, org))))[0], "Term");
        if (term.isLocked) throw new SchoolAdminError("Cannot add assessments to a closed and locked term.");
        const category = found((await tx.select().from(assessmentCategories).where(and(eq(assessmentCategories.id, value.categoryId), eq(assessmentCategories.organizationId, org))))[0], "Category");
        found((await tx.select({ id: subjects.id }).from(subjects).where(and(eq(subjects.id, value.subjectId), eq(subjects.organizationId, org))))[0], "Subject");
        if (term.academicYearId !== classRow.academicYearId || category.academicYearId !== classRow.academicYearId || category.subjectId !== value.subjectId) throw new SchoolAdminError("Class, term, subject and category must belong to the same school year.");
        if (value.dateDue < term.startsOn || value.dateDue > term.endsOn) throw new SchoolAdminError("Due date must be within the term.");
        const [row] = await tx.insert(assessments).values({ organizationId: org, academicYearId: classRow.academicYearId,
          termId: term.id, classId: classRow.id, subjectId: value.subjectId, categoryId: category.id,
          title: value.title, maxScore: value.maxScore, dateDue: value.dateDue, createdById: actor.userId }).returning();
        entityId = row.id;
        break;
      }
      case "assessment_publish": {
        const assessment = found((await tx.select().from(assessments).where(and(eq(assessments.id, value.assessmentId), eq(assessments.organizationId, org))))[0], "Assessment");
        const term = found((await tx.select({ isLocked: terms.isLocked, name: terms.name }).from(terms).where(and(eq(terms.id, assessment.termId), eq(terms.organizationId, org))))[0], "Term");
        if (term.isLocked) throw new SchoolAdminError(`The gradebook for ${term.name} is closed and locked.`);
        const roster = await tx.select({ studentId: enrollments.studentId }).from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.classId, assessment.classId), eq(enrollments.academicYearId, assessment.academicYearId), eq(enrollments.status, "active")));
        const grades = await tx.select({ studentId: assessmentGrades.studentId }).from(assessmentGrades).where(and(eq(assessmentGrades.organizationId, org), eq(assessmentGrades.assessmentId, assessment.id)));
        if (!roster.length || roster.some(item => !grades.some(grade => grade.studentId === item.studentId))) throw new SchoolAdminError("Enter a grade for every active student before publishing.");
        await tx.update(assessments).set({ status: "published", updatedAt: new Date() }).where(and(eq(assessments.id, assessment.id), eq(assessments.organizationId, org)));
        await tx.update(assessmentGrades).set({ status: "published", updatedAt: new Date() }).where(and(eq(assessmentGrades.organizationId, org), eq(assessmentGrades.assessmentId, assessment.id)));
        entityId = assessment.id;
        break;
      }
      case "grade_entry": {
        const assessment = found((await tx.select().from(assessments).where(and(eq(assessments.id, value.assessmentId), eq(assessments.organizationId, org))))[0], "Assessment");
        const term = found((await tx.select({ isLocked: terms.isLocked, name: terms.name }).from(terms).where(and(eq(terms.id, assessment.termId), eq(terms.organizationId, org))))[0], "Term");
        if (term.isLocked) throw new SchoolAdminError(`The gradebook for ${term.name} is closed and locked.`);
        found((await tx.select({ id: enrollments.id }).from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.classId, assessment.classId), eq(enrollments.academicYearId, assessment.academicYearId), eq(enrollments.studentId, value.studentId), eq(enrollments.status, "active"))))[0], "Active enrollment");
        if (value.score > assessment.maxScore) throw new SchoolAdminError("Score cannot exceed the assessment maximum.");
        const [previous] = await tx.select().from(assessmentGrades).where(and(eq(assessmentGrades.organizationId, org), eq(assessmentGrades.assessmentId, assessment.id), eq(assessmentGrades.studentId, value.studentId)));
        if (previous?.status === "published" && Number(previous.score) !== value.score && value.correctionReason.length < 4) throw new SchoolAdminError("Explain the correction to a published grade.");
        const percentage = value.score / assessment.maxScore * 100;
        const fields = { score: decimal(value.score), percentage: decimal(percentage), letterGrade: scoreToGrade(percentage).label,
          feedback: value.feedback || null, status: assessment.status === "published" ? "published" as const : "draft" as const,
          gradedBy: actor.userId, gradedAt: new Date(), updatedAt: new Date() };
        const [row] = previous
          ? await tx.update(assessmentGrades).set(fields).where(and(eq(assessmentGrades.id, previous.id), eq(assessmentGrades.organizationId, org))).returning()
          : await tx.insert(assessmentGrades).values({ ...fields, organizationId: org, assessmentId: assessment.id, studentId: value.studentId }).returning();
        if (previous?.status === "published" && Number(previous.score) !== value.score) await tx.insert(gradeCorrections).values({
          organizationId: org, assessmentGradeId: row.id, studentId: value.studentId, previousScore: previous.score,
          newScore: fields.score, previousGrade: previous.letterGrade, newGrade: fields.letterGrade,
          reason: value.correctionReason, correctedBy: actor.userId });
        entityId = row.id;
        break;
      }
      case "report_generate": {
        const term = found((await tx.select().from(terms).where(and(eq(terms.id, value.termId), eq(terms.organizationId, org))))[0], "Term");
        const enrollment = found((await tx.select().from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.studentId, value.studentId), eq(enrollments.academicYearId, term.academicYearId))))[0], "Student enrollment");
        if (!enrollment.classId) throw new SchoolAdminError("Assign the student to a class before generating a report card.");
        const previous = await tx.select().from(reportCards).where(and(eq(reportCards.organizationId, org), eq(reportCards.studentId, value.studentId), eq(reportCards.termId, term.id)));
        const published = await tx.select().from(assessments).where(and(eq(assessments.organizationId, org), eq(assessments.classId, enrollment.classId), eq(assessments.termId, term.id), eq(assessments.status, "published")));
        if (!published.length) throw new SchoolAdminError("Publish assessments before generating a report card.");
        const gradeRows = await tx.select().from(assessmentGrades).where(and(eq(assessmentGrades.organizationId, org), eq(assessmentGrades.studentId, value.studentId), eq(assessmentGrades.status, "published")));
        const categories = await tx.select().from(assessmentCategories).where(and(eq(assessmentCategories.organizationId, org), eq(assessmentCategories.academicYearId, term.academicYearId)));
        const subjectIds = [...new Set(published.map(item => item.subjectId))];
        const results = subjectIds.map(subjectId => {
          const items = published.filter(item => item.subjectId === subjectId && gradeRows.some(grade => grade.assessmentId === item.id));
          if (!items.length) return null;
          const calculation = calculateWeightedTermGrade(categories.filter(item => item.subjectId === subjectId).map(item => ({ id: item.id, weight: item.weight })),
            items.map(item => ({ id: item.id, categoryId: item.categoryId, maxScore: item.maxScore })),
            gradeRows.filter(grade => items.some(item => item.id === grade.assessmentId)).map(grade => ({ assessmentId: grade.assessmentId, score: Number(grade.score) })));
          return { subjectId, ...calculation };
        }).filter((row): row is NonNullable<typeof row> => row !== null);
        if (!results.length) throw new SchoolAdminError("Published grades are needed to generate a report card.");
        const percentage = results.reduce((sum, row) => sum + row.percentage, 0) / results.length;
        const gpa = results.reduce((sum, row) => sum + row.gpaPoint, 0) / results.length;
        const sessions = await tx.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), eq(attendanceSessions.classId, enrollment.classId), eq(attendanceSessions.academicYearId, term.academicYearId), eq(attendanceSessions.period, "morning_roll_call")));
        const recordRows = await tx.select().from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), eq(attendanceRecords.studentId, value.studentId)));
        const termRecords = recordRows.filter(record => sessions.some(session => session.id === record.sessionId && session.sessionDate >= term.startsOn && session.sessionDate <= term.endsOn && session.status !== "in_progress"));
        const present = termRecords.filter(row => row.status === "present").length;
        const absent = termRecords.filter(row => row.status === "absent").length;
        const late = termRecords.filter(row => row.status === "late").length;
        const attendanceRate = termRecords.length ? (present + late + termRecords.filter(row => row.status === "excused").length) / termRecords.length * 100 : null;
        const [card] = await tx.insert(reportCards).values({ organizationId: org, studentId: value.studentId, academicYearId: term.academicYearId,
          termId: term.id, classId: enrollment.classId, version: Math.max(0, ...previous.map(row => row.version)) + 1,
          overallPercentage: decimal(percentage), gpa: decimal(gpa), attendanceRate: attendanceRate === null ? null : attendanceRate.toFixed(1),
          daysPresent: present, daysAbsent: absent, daysLate: late }).returning();
        await tx.insert(reportCardSubjectGrades).values(results.map(row => ({ organizationId: org, reportCardId: card.id,
          subjectId: row.subjectId, scorePercentage: decimal(row.percentage), letterGrade: row.letterGrade })));
        entityId = card.id;
        break;
      }
      case "report_status": {
        const card = found((await tx.select().from(reportCards).where(and(eq(reportCards.id, value.reportCardId), eq(reportCards.organizationId, org))))[0], "Report card");
        if ((value.status === "approved" && card.status !== "draft") || (value.status === "published" && card.status !== "approved")) throw new SchoolAdminError("Approve the draft before publishing the report card.");
        await tx.update(reportCards).set({ status: value.status, approvedBy: value.status === "approved" ? actor.userId : card.approvedBy,
          publishedAt: value.status === "published" ? new Date() : null, updatedAt: new Date() }).where(and(eq(reportCards.id, card.id), eq(reportCards.organizationId, org)));
        entityId = card.id;
        break;
      }
      case "report_remarks": {
        const card = found((await tx.select().from(reportCards).where(and(eq(reportCards.id, value.reportCardId), eq(reportCards.organizationId, org))))[0], "Report card");
        if (card.status !== "draft") throw new SchoolAdminError("Teacher remarks can only be changed on a draft report card.");
        await tx.update(reportCards).set({ teacherRemarks: value.teacherRemarks || null, updatedAt: new Date() })
          .where(and(eq(reportCards.id, card.id), eq(reportCards.organizationId, org)));
        entityId = card.id;
        break;
      }
      case "announcement": {
        if (value.targetType === "school" && value.targetId !== "all") throw new SchoolAdminError("Choose the whole school target.");
        if (value.targetType === "grade") found((await tx.select({ id: gradeLevels.id }).from(gradeLevels).where(and(eq(gradeLevels.id, value.targetId), eq(gradeLevels.organizationId, org))))[0], "Grade");
        if (value.targetType === "class") found((await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, value.targetId), eq(classes.organizationId, org))))[0], "Class");
        const [row] = await tx.insert(announcements).values({ organizationId: org, title: value.title, content: value.content,
          targetType: value.targetType, targetId: value.targetId, priority: value.priority, channels: "in_app",
          status: value.status, publishedAt: value.status === "published" ? new Date() : null, authorId: actor.userId }).returning();
        entityId = row.id;
        break;
      }
      case "announcement_update": {
        const announcement = found((await tx.select().from(announcements).where(and(eq(announcements.id, value.announcementId), eq(announcements.organizationId, org))))[0], "Announcement");
        if (announcement.status !== "draft") throw new SchoolAdminError("Only drafts can be edited.");
        if (value.targetType === "school" && value.targetId !== "all") throw new SchoolAdminError("Choose the whole school target.");
        if (value.targetType === "grade") found((await tx.select({ id: gradeLevels.id }).from(gradeLevels).where(and(eq(gradeLevels.id, value.targetId), eq(gradeLevels.organizationId, org))))[0], "Grade");
        if (value.targetType === "class") found((await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, value.targetId), eq(classes.organizationId, org))))[0], "Class");
        await tx.update(announcements).set({ title: value.title, content: value.content, targetType: value.targetType,
          targetId: value.targetId, priority: value.priority, updatedAt: new Date() })
          .where(and(eq(announcements.id, announcement.id), eq(announcements.organizationId, org), eq(announcements.status, "draft")));
        entityId = announcement.id;
        break;
      }
      case "announcement_publish": {
        const announcement = found((await tx.select().from(announcements).where(and(eq(announcements.id, value.announcementId), eq(announcements.organizationId, org))))[0], "Announcement");
        if (announcement.status !== "draft") throw new SchoolAdminError("Only drafts can be published.");
        await tx.update(announcements).set({ status: "published", publishedAt: new Date(), updatedAt: new Date() }).where(and(eq(announcements.id, announcement.id), eq(announcements.organizationId, org)));
        entityId = announcement.id;
        break;
      }
      case "announcement_archive": {
        const announcement = found((await tx.select().from(announcements).where(and(eq(announcements.id, value.announcementId), eq(announcements.organizationId, org))))[0], "Announcement");
        if (announcement.status === "archived") throw new SchoolAdminError("This announcement is already archived.");
        await tx.update(announcements).set({ status: "archived", updatedAt: new Date() })
          .where(and(eq(announcements.id, announcement.id), eq(announcements.organizationId, org)));
        entityId = announcement.id;
        break;
      }
      case "sensitive_case": {
        if (!canUserAccessCaseArea(actor.role, value.area)) throw new SchoolAdminError("You cannot access this case area.");
        found((await tx.select({ id: students.id }).from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");
        const [row] = await tx.insert(sensitiveCases).values({ organizationId: org, studentId: value.studentId, caseNumber: value.caseNumber,
          area: value.area, confidentialityTier: value.confidentialityTier, title: value.title }).returning();
        entityId = row.id;
        break;
      }
      case "sensitive_note": {
        const caseRow = found((await tx.select().from(sensitiveCases).where(and(eq(sensitiveCases.id, value.caseId), eq(sensitiveCases.organizationId, org))))[0], "Case");
        if (!canUserAccessCaseArea(actor.role, caseRow.area)) throw new SchoolAdminError("You cannot access this case area.");
        const encrypted = encryptNarrative(value.note);
        const [row] = await tx.insert(sensitiveCaseNotes).values({ organizationId: org, caseId: caseRow.id, authorId: actor.userId,
          confidentialityTier: caseRow.confidentialityTier, encryptedCiphertext: encrypted.ciphertext, ivHex: encrypted.ivHex, authTagHex: encrypted.authTagHex }).returning();
        entityId = row.id;
        break;
      }
      case "sensitive_access": {
        const caseRow = found((await tx.select().from(sensitiveCases).where(and(eq(sensitiveCases.id, value.caseId), eq(sensitiveCases.organizationId, org))))[0], "Case");
        if (!canUserAccessCaseArea(actor.role, caseRow.area)) throw new SchoolAdminError("You cannot access this case area.");
        const notes = await tx.select().from(sensitiveCaseNotes).where(and(eq(sensitiveCaseNotes.organizationId, org), eq(sensitiveCaseNotes.caseId, caseRow.id), eq(sensitiveCaseNotes.isQuarantined, false)));
        await tx.insert(sensitiveAccessLogs).values({ organizationId: org, caseId: caseRow.id, userId: actor.userId,
          action: "view_decrypted", accessReason: value.accessReason });
        noteText = notes.map(note => decryptNarrative(note.encryptedCiphertext, note.ivHex, note.authTagHex));
        entityId = caseRow.id;
        break;
      }
      case "sensitive_case_status": {
        const caseRow = found((await tx.select().from(sensitiveCases).where(and(eq(sensitiveCases.id, value.caseId), eq(sensitiveCases.organizationId, org))))[0], "Case");
        if (!canUserAccessCaseArea(actor.role, caseRow.area)) throw new SchoolAdminError("You cannot access this case area.");
        await tx.update(sensitiveCases).set({ status: value.status, closedAt: value.status === "closed" ? new Date() : null,
          closedReason: value.status === "closed" ? value.reason : null, updatedAt: new Date() }).where(and(eq(sensitiveCases.id, caseRow.id), eq(sensitiveCases.organizationId, org)));
        entityId = caseRow.id;
        break;
      }
      case "need_to_know": {
        const caseRow = found((await tx.select().from(sensitiveCases).where(and(eq(sensitiveCases.id, value.caseId), eq(sensitiveCases.organizationId, org))))[0], "Case");
        if (!canUserAccessCaseArea(actor.role, caseRow.area)) throw new SchoolAdminError("You cannot access this case area.");
        if (caseRow.studentId !== value.studentId) throw new SchoolAdminError("The directive student must match the case student.");
        const [row] = await tx.insert(needToKnowAlerts).values({ organizationId: org, studentId: value.studentId, caseId: caseRow.id,
          category: value.category, severity: value.severity, directiveSummary: value.directiveSummary,
          actionRequired: value.actionRequired, authorSpecialistId: actor.userId }).returning();
        entityId = row.id;
        break;
      }
      case "need_to_know_resolve": {
        const alert = found((await tx.select().from(needToKnowAlerts).where(and(eq(needToKnowAlerts.id, value.alertId), eq(needToKnowAlerts.organizationId, org))))[0], "Directive");
        if (isSpecialistRole(actor.role)) {
          if (!alert.caseId) throw new SchoolAdminError("This directive has no case area for your role.");
          const caseRow = found((await tx.select({ area: sensitiveCases.area }).from(sensitiveCases).where(and(
            eq(sensitiveCases.id, alert.caseId), eq(sensitiveCases.organizationId, org))))[0], "Case");
          if (!canUserAccessCaseArea(actor.role, caseRow.area)) throw new SchoolAdminError("You cannot access this case area.");
        }
        await tx.update(needToKnowAlerts).set({ isActive: false, updatedAt: new Date() }).where(and(eq(needToKnowAlerts.id, alert.id), eq(needToKnowAlerts.organizationId, org)));
        entityId = alert.id;
        break;
      }
      case "court_restriction": {
        found((await tx.select({ id: students.id }).from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");
        if (value.expirationDate && value.expirationDate < value.effectiveDate) throw new SchoolAdminError("Expiration date must follow the effective date.");
        const [row] = await tx.insert(courtRestrictions).values({ organizationId: org, studentId: value.studentId,
          restrictedPersonName: value.restrictedPersonName, orderType: value.orderType, docketNumber: value.docketNumber,
          issuingCourt: value.issuingCourt, summary: value.summary, effectiveDate: value.effectiveDate,
          expirationDate: value.expirationDate || null, prohibitPickup: value.prohibitPickup,
          prohibitDisclosure: value.prohibitDisclosure, prohibitDirectContact: value.prohibitDirectContact }).returning();
        entityId = row.id;
        break;
      }
      case "court_restriction_status": {
        const restriction = found((await tx.select().from(courtRestrictions).where(and(eq(courtRestrictions.id, value.restrictionId), eq(courtRestrictions.organizationId, org))))[0], "Court restriction");
        await tx.update(courtRestrictions).set({ isEnforced: value.isEnforced, updatedAt: new Date() }).where(and(eq(courtRestrictions.id, restriction.id), eq(courtRestrictions.organizationId, org)));
        entityId = restriction.id;
        break;
      }
      case "statutory_disclosure": {
        if (actor.role !== "safeguarding_lead" && actor.role !== "school_admin") throw new SchoolAdminError("Only the Designated Safeguarding Lead or School Admin can compile a statutory disclosure package.");
        const student = found((await tx.select().from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");
        const school = found((await tx.select().from(organizations).where(eq(organizations.id, org)))[0], "School");
        const caseRows = await tx.select().from(sensitiveCases).where(and(eq(sensitiveCases.studentId, student.id), eq(sensitiveCases.organizationId, org)));
        const restrictionRows = await tx.select().from(courtRestrictions).where(and(eq(courtRestrictions.studentId, student.id), eq(courtRestrictions.organizationId, org), eq(courtRestrictions.isEnforced, true)));
        const studentFullName = `${student.firstName} ${student.lastName}`;
        const mappedCases: SensitiveCaseRecord[] = caseRows.map(row => ({
          id: row.id,
          organizationId: row.organizationId,
          studentId: row.studentId,
          studentName: studentFullName,
          studentGrade: "",
          caseNumber: row.caseNumber,
          area: row.area,
          confidentialityTier: row.confidentialityTier,
          title: row.title,
          status: row.status,
          leadSpecialistId: row.leadSpecialistId || "",
          leadSpecialistName: "",
          hasCourtOrder: row.hasCourtOrder,
          reviewDate: row.reviewDate,
          encryptedNotesCount: 0,
          latestNoteSummary: "",
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }));
        const mappedRestrictions: CourtRestrictionRecord[] = restrictionRows.map(row => ({
          id: row.id,
          organizationId: row.organizationId,
          studentId: row.studentId,
          studentName: studentFullName,
          restrictedGuardianId: null,
          restrictedPersonName: row.restrictedPersonName,
          orderType: row.orderType,
          docketNumber: row.docketNumber,
          issuingCourt: row.issuingCourt,
          summary: row.summary,
          prohibitPickup: row.prohibitPickup,
          prohibitDisclosure: row.prohibitDisclosure,
          prohibitDirectContact: row.prohibitDirectContact,
          effectiveDate: row.effectiveDate,
          expirationDate: row.expirationDate,
          isEnforced: row.isEnforced,
          createdAt: row.createdAt.toISOString(),
        }));
        packageResult = generateDisclosurePackage(
          { id: student.id, name: studentFullName, studentNumber: student.studentNumber },
          mappedCases,
          mappedRestrictions,
          actor.role,
          { schoolName: school.name, recipientAgency: value.recipientAgency }
        );
        entityId = student.id;
        break;
      }
      case "clinic_visit": {
        if (actor.role !== "health_nurse" && actor.role !== "school_admin") throw new SchoolAdminError("Only the school nurse or school admin can record clinic visits.");
        const student = found((await tx.select().from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");
        const todayStr = new Date().toISOString().slice(0, 10);
        const [row] = await tx.insert(clinicVisits).values({
          organizationId: org,
          studentId: student.id,
          attendedBy: actor.userId,
          category: value.category,
          symptoms: value.symptoms,
          treatment: value.treatment,
          outcome: value.outcome,
          guardianNotified: value.guardianNotified,
          guardianNotificationNotes: value.guardianNotificationNotes || null,
          visitDate: todayStr,
        }).returning();
        entityId = row.id;
        break;
      }
      case "reception_log": {
        if (actor.role !== "office_staff" && actor.role !== "school_admin") throw new SchoolAdminError("Only office staff or school administrators can record reception desk movements.");
        const student = found((await tx.select().from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");

        if (value.logType === "early_departure") {
          const activeCourtOrders = await tx.select().from(courtRestrictions)
            .where(and(
              eq(courtRestrictions.studentId, student.id),
              eq(courtRestrictions.organizationId, org),
              eq(courtRestrictions.isEnforced, true),
              eq(courtRestrictions.prohibitPickup, true)
            ));

          if (activeCourtOrders.length > 0 && value.actorPersonName) {
            const requestedCollector = value.actorPersonName.trim().toLowerCase();
            const violation = activeCourtOrders.find(order => {
              const restricted = order.restrictedPersonName.trim().toLowerCase();
              return requestedCollector.includes(restricted) || restricted.includes(requestedCollector);
            });
            if (violation) {
              throw new SchoolAdminError(`COURT RESTRICTION ALERT: ${violation.restrictedPersonName} is legally prohibited from picking up ${student.firstName} ${student.lastName} (Court order ref: ${violation.docketNumber}). Pickup cannot be authorized.`);
            }
          }
        }

        const [logRow] = await tx.insert(receptionLogs).values({
          organizationId: org,
          studentId: student.id,
          logType: value.logType,
          logDate: value.logDate,
          timeString: value.timeString,
          minutesLate: value.minutesLate,
          reason: value.reason,
          actorPersonName: value.actorPersonName || null,
          relationship: value.relationship || null,
          isExcused: value.isExcused,
          recordedBy: actor.userId,
          remarks: value.remarks || null,
        }).returning();

        if (value.logType === "late_arrival") {
          const currentYear = (await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true))))[0];
          if (currentYear) {
            const enrollment = (await tx.select({ classId: enrollments.classId }).from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.studentId, student.id), eq(enrollments.academicYearId, currentYear.id))))[0];
            if (enrollment?.classId) {
              const morningSession = (await tx.select({ id: attendanceSessions.id, status: attendanceSessions.status }).from(attendanceSessions).where(and(
                eq(attendanceSessions.organizationId, org),
                eq(attendanceSessions.classId, enrollment.classId),
                eq(attendanceSessions.sessionDate, value.logDate),
                eq(attendanceSessions.period, "morning_roll_call")
              )))[0];

              if (morningSession) {
                const existingRecord = (await tx.select({ id: attendanceRecords.id, status: attendanceRecords.status }).from(attendanceRecords).where(and(
                  eq(attendanceRecords.organizationId, org),
                  eq(attendanceRecords.sessionId, morningSession.id),
                  eq(attendanceRecords.studentId, student.id)
                )))[0];

                if (existingRecord) {
                  await tx.update(attendanceRecords).set({
                    status: "late",
                    arrivalMinutesLate: value.minutesLate || 1,
                    reason: value.reason,
                    remarks: value.remarks ? `Reception desk: ${value.remarks}` : "Checked in at reception desk",
                    updatedAt: new Date(),
                  }).where(and(eq(attendanceRecords.id, existingRecord.id), eq(attendanceRecords.organizationId, org)));

                  if (morningSession.status === "submitted" && existingRecord.status !== "late") {
                    await tx.insert(attendanceCorrections).values({
                      organizationId: org,
                      attendanceRecordId: existingRecord.id,
                      studentId: student.id,
                      previousStatus: existingRecord.status,
                      newStatus: "late",
                      reason: `Front desk late arrival sign-in at ${value.timeString}: ${value.reason}`,
                      correctedBy: actor.userId,
                    });
                  }
                } else {
                  await tx.insert(attendanceRecords).values({
                    organizationId: org,
                    sessionId: morningSession.id,
                    studentId: student.id,
                    status: "late",
                    arrivalMinutesLate: value.minutesLate || 1,
                    reason: value.reason,
                    remarks: value.remarks ? `Reception desk: ${value.remarks}` : "Checked in at reception desk",
                  });
                }
              }
            }
          }
        }

        entityId = logRow.id;
        break;
      }
      case "emergency_sms_broadcast": {
        let targetStudentIds: string[] = [];
        if (value.scope === "whole_school") {
          const studentRows = await tx.select({ id: students.id }).from(students)
            .where(and(eq(students.organizationId, org), eq(students.status, "active")));
          targetStudentIds = studentRows.map(s => s.id);
        } else if (value.scope === "grade") {
          const classRows = await tx.select({ id: classes.id }).from(classes)
            .where(and(eq(classes.organizationId, org), eq(classes.gradeLevelId, value.targetId)));
          const classIds = classRows.map(c => c.id);
          if (classIds.length > 0) {
            const enrollRows = await tx.select({ studentId: enrollments.studentId }).from(enrollments)
              .where(and(eq(enrollments.organizationId, org), inArray(enrollments.classId, classIds), eq(enrollments.status, "active")));
            targetStudentIds = Array.from(new Set(enrollRows.map(e => e.studentId)));
          }
        } else if (value.scope === "class") {
          const enrollRows = await tx.select({ studentId: enrollments.studentId }).from(enrollments)
            .where(and(eq(enrollments.organizationId, org), eq(enrollments.classId, value.targetId), eq(enrollments.status, "active")));
          targetStudentIds = Array.from(new Set(enrollRows.map(e => e.studentId)));
        }

        if (targetStudentIds.length === 0) {
          throw new SchoolAdminError("No active students found in the selected broadcast scope.");
        }

        const recipientRows = await tx.select({
          studentId: studentGuardians.studentId,
          guardianId: guardians.id,
          firstName: guardians.firstName,
          lastName: guardians.lastName,
          phone: guardians.phone,
        })
        .from(studentGuardians)
        .innerJoin(guardians, and(eq(studentGuardians.guardianId, guardians.id), eq(guardians.organizationId, org)))
        .where(and(eq(studentGuardians.organizationId, org), inArray(studentGuardians.studentId, targetStudentIds)));

        const validRecipients = recipientRows.filter(r => r.phone && r.phone.trim().length >= 4);
        if (validRecipients.length === 0) {
          throw new SchoolAdminError("No guardians with registered phone numbers were found for the selected recipients.");
        }

        const broadcastId = crypto.randomUUID();
        const sentAt = new Date();

        for (const r of validRecipients) {
          await tx.insert(smsDispatches).values({
            organizationId: org,
            recipientPhone: normalizePhoneNumber(r.phone!),
            recipientName: `${r.firstName} ${r.lastName}`.trim(),
            studentId: r.studentId,
            message: value.message,
            status: isDemoMode() ? "simulated" : "sent",
            providerRef: `SM_emg_${Math.random().toString(36).substring(2, 10)}`,
            sentAt,
          });
        }

        broadcastRecipientCount = validRecipients.length;
        entityId = broadcastId;
        break;
      }
      case "behaviour_log": {
        found((await tx.select({ id: students.id }).from(students).where(and(eq(students.id, value.studentId), eq(students.organizationId, org))))[0], "Student");
        if (value.classId) {
          found((await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.id, value.classId), eq(classes.organizationId, org))))[0], "Class");
        }
        const [behaviourRecord] = await tx.insert(studentBehaviours).values({
          organizationId: org,
          studentId: value.studentId,
          classId: value.classId || null,
          recordedBy: actor.userId,
          type: value.type,
          category: value.category,
          points: value.points,
          description: value.description || null,
          guardianVisible: value.guardianVisible,
          occurredAt: value.occurredAt,
        }).returning();
        entityId = behaviourRecord.id;
        break;
      }
    }
    if (value.kind === "statutory_disclosure" && packageResult) {
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.DISCLOSURE_PACKAGE_EXPORTED,
        entityType: "student", entityId, metadata: { dossierNumber: packageResult.dossierNumber, recipientAgency: value.recipientAgency, reason: value.reason, recordCount: packageResult.includedRecords.length, withheldSafeguardingCount: packageResult.withheldSafeguardingCount, checksum: packageResult.digitalIntegrityChecksum } }, tx);
    } else if (value.kind === "clinic_visit") {
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.CLINIC_VISIT_LOGGED,
        entityType: "clinic_visit", entityId, metadata: { category: value.category, outcome: value.outcome, guardianNotified: value.guardianNotified } }, tx);
    } else if (value.kind === "reception_log") {
      const action = value.logType === "late_arrival" ? AuditActions.LATE_ARRIVAL_LOGGED : AuditActions.EARLY_DEPARTURE_LOGGED;
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action,
        entityType: "reception_log", entityId, metadata: { logType: value.logType, studentId: value.studentId, timeString: value.timeString, minutesLate: value.minutesLate, reason: value.reason, actorPersonName: value.actorPersonName, isExcused: value.isExcused } }, tx);
    } else if (value.kind === "emergency_sms_broadcast") {
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.EMERGENCY_BROADCAST_CONFIRMED,
        entityType: "sms_broadcast", entityId, metadata: { scope: value.scope, targetId: value.targetId, severity: value.severity, recipientCount: broadcastRecipientCount, messageLength: value.message.length } }, tx);
    } else if (value.kind === "behaviour_log") {
      const action = value.type === "praise" ? AuditActions.BEHAVIOUR_PRAISE_LOGGED : AuditActions.BEHAVIOUR_INCIDENT_LOGGED;
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action,
        entityType: "student_behaviour", entityId, metadata: { studentId: value.studentId, classId: value.classId, type: value.type, category: value.category, points: value.points, guardianVisible: value.guardianVisible, occurredAt: value.occurredAt } }, tx);
    } else {
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: `${value.kind}.saved`,
        entityType: value.kind, entityId, metadata: "reason" in value ? { reason: value.reason } : {} }, tx);
    }
    return { entityId, notes: noteText, disclosurePackage: packageResult, recipientCount: broadcastRecipientCount };
  });
}
