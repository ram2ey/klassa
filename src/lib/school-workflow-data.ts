import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { attendanceSessions, attendanceRecords, assessmentCategories, assessments, assessmentGrades,
  reportCards, reportCardSubjectGrades, announcements, sensitiveCases, sensitiveCaseNotes, sensitiveAccessLogs,
  needToKnowAlerts, courtRestrictions } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

export async function getSchoolWorkflowData(section: string, sessionDate: string) {
  const actor = await requireStaff(["school_admin"]);
  const org = actor.organizationId;
  const empty = { sessions: [] as (typeof attendanceSessions.$inferSelect)[], records: [] as (typeof attendanceRecords.$inferSelect)[],
    categories: [] as (typeof assessmentCategories.$inferSelect)[], assessments: [] as (typeof assessments.$inferSelect)[],
    grades: [] as (typeof assessmentGrades.$inferSelect)[], reports: [] as (typeof reportCards.$inferSelect)[],
    reportSubjects: [] as (typeof reportCardSubjectGrades.$inferSelect)[], announcements: [] as (typeof announcements.$inferSelect)[],
    cases: [] as (typeof sensitiveCases.$inferSelect)[], notes: [] as Pick<typeof sensitiveCaseNotes.$inferSelect, "id" | "caseId" | "noteType" | "createdAt">[],
    accessLogs: [] as Pick<typeof sensitiveAccessLogs.$inferSelect, "id" | "caseId" | "action" | "accessReason" | "accessedAt">[],
    alerts: [] as (typeof needToKnowAlerts.$inferSelect)[], restrictions: [] as (typeof courtRestrictions.$inferSelect)[] };
  if (section === "attendance") {
    const sessions = await db.select().from(attendanceSessions).where(and(eq(attendanceSessions.organizationId, org), eq(attendanceSessions.sessionDate, sessionDate)));
    const records = sessions.length ? await db.select().from(attendanceRecords).where(and(eq(attendanceRecords.organizationId, org), inArray(attendanceRecords.sessionId, sessions.map(row => row.id)))) : [];
    return { ...empty, sessions, records };
  }
  if (section === "gradebook" || section === "reports") {
    const [categories, assessmentRows, grades, reports, reportSubjects] = await Promise.all([
      db.select().from(assessmentCategories).where(eq(assessmentCategories.organizationId, org)),
      db.select().from(assessments).where(eq(assessments.organizationId, org)).orderBy(desc(assessments.dateDue)),
      db.select().from(assessmentGrades).where(eq(assessmentGrades.organizationId, org)),
      db.select().from(reportCards).where(eq(reportCards.organizationId, org)).orderBy(desc(reportCards.createdAt)),
      db.select().from(reportCardSubjectGrades).where(eq(reportCardSubjectGrades.organizationId, org)),
    ]);
    return { ...empty, categories, assessments: assessmentRows, grades, reports, reportSubjects };
  }
  if (section === "communications") return { ...empty, announcements: await db.select().from(announcements).where(eq(announcements.organizationId, org)).orderBy(desc(announcements.createdAt)) };
  if (section === "sensitive") {
    const [cases, notes, accessLogs, alerts, restrictions] = await Promise.all([
      db.select().from(sensitiveCases).where(eq(sensitiveCases.organizationId, org)).orderBy(desc(sensitiveCases.createdAt)),
      db.select({ id: sensitiveCaseNotes.id, caseId: sensitiveCaseNotes.caseId, noteType: sensitiveCaseNotes.noteType, createdAt: sensitiveCaseNotes.createdAt })
        .from(sensitiveCaseNotes).where(eq(sensitiveCaseNotes.organizationId, org)).orderBy(desc(sensitiveCaseNotes.createdAt)),
      db.select({ id: sensitiveAccessLogs.id, caseId: sensitiveAccessLogs.caseId, action: sensitiveAccessLogs.action,
        accessReason: sensitiveAccessLogs.accessReason, accessedAt: sensitiveAccessLogs.accessedAt })
        .from(sensitiveAccessLogs).where(eq(sensitiveAccessLogs.organizationId, org)).orderBy(desc(sensitiveAccessLogs.accessedAt)).limit(100),
      db.select().from(needToKnowAlerts).where(eq(needToKnowAlerts.organizationId, org)).orderBy(desc(needToKnowAlerts.createdAt)),
      db.select().from(courtRestrictions).where(eq(courtRestrictions.organizationId, org)).orderBy(desc(courtRestrictions.createdAt)),
    ]);
    return { ...empty, cases, notes, accessLogs, alerts, restrictions };
  }
  return empty;
}

export type SchoolWorkflowData = Awaited<ReturnType<typeof getSchoolWorkflowData>>;
