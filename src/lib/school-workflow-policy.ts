import { z } from "zod";

const id = z.uuid();
const date = z.iso.date();
const reason = z.string().trim().min(4).max(500);
export const attendancePeriods = ["morning_roll_call", "period_1", "period_2", "period_3", "period_4", "period_5", "period_6"] as const;
export type AttendancePeriod = (typeof attendancePeriods)[number];
const attendancePeriod = z.enum(attendancePeriods).default("morning_roll_call");

export function canTeacherTakeAttendance(period: AttendancePeriod, isHomeroom: boolean, hasSubjectAssignment: boolean) {
  return isHomeroom || (period !== "morning_roll_call" && hasSubjectAssignment);
}

export const workflowCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("attendance"), classId: id, sessionDate: date, period: attendancePeriod, studentId: id,
    status: z.enum(["present", "absent", "late", "excused"]), reason: z.string().trim().max(255).default(""),
    correctionReason: z.string().trim().max(500).default("") }),
  z.object({ kind: z.literal("attendance_submit"), classId: id, sessionDate: date, period: attendancePeriod }),
  z.object({ kind: z.literal("category"), academicYearId: id, subjectId: id, name: z.string().trim().min(2).max(100), weight: z.number().int().min(1).max(100) }),
  z.object({ kind: z.literal("assessment"), classId: id, termId: id, subjectId: id, categoryId: id,
    title: z.string().trim().min(2).max(150), maxScore: z.number().int().min(1).max(1000), dateDue: date }),
  z.object({ kind: z.literal("assessment_publish"), assessmentId: id }),
  z.object({ kind: z.literal("grade_entry"), assessmentId: id, studentId: id, score: z.number().min(0).max(1000),
    feedback: z.string().trim().max(1000).default(""), correctionReason: z.string().trim().max(500).default("") }),
  z.object({ kind: z.literal("report_generate"), studentId: id, termId: id }),
  z.object({ kind: z.literal("report_remarks"), reportCardId: id, teacherRemarks: z.string().trim().max(5000) }),
  z.object({ kind: z.literal("report_status"), reportCardId: id, status: z.enum(["approved", "published"]) }),
  z.object({ kind: z.literal("announcement"), title: z.string().trim().min(2).max(200), content: z.string().trim().min(2).max(10000),
    targetType: z.enum(["school", "grade", "class"]), targetId: z.string().max(80), priority: z.enum(["normal", "important"]),
    status: z.enum(["draft", "published"]) }),
  z.object({ kind: z.literal("announcement_update"), announcementId: id, title: z.string().trim().min(2).max(200),
    content: z.string().trim().min(2).max(10000), targetType: z.enum(["school", "grade", "class"]), targetId: z.string().max(80),
    priority: z.enum(["normal", "important"]) }),
  z.object({ kind: z.literal("announcement_publish"), announcementId: id }),
  z.object({ kind: z.literal("announcement_archive"), announcementId: id }),
  z.object({ kind: z.literal("sensitive_case"), studentId: id, caseNumber: z.string().trim().min(2).max(50),
    area: z.enum(["safeguarding", "health_medical", "special_needs", "disciplinary"]),
    confidentialityTier: z.enum(["standard_sensitive", "confidential", "strictly_confidential"]), title: z.string().trim().min(2).max(200) }),
  z.object({ kind: z.literal("sensitive_note"), caseId: id, note: z.string().trim().min(2).max(20000) }),
  z.object({ kind: z.literal("sensitive_access"), caseId: id, accessReason: reason }),
  z.object({ kind: z.literal("sensitive_case_status"), caseId: id, status: z.enum(["open", "under_review", "monitoring", "closed"]), reason }),
  z.object({ kind: z.literal("need_to_know"), studentId: id, caseId: id, category: z.string().trim().min(2).max(60),
    severity: z.enum(["routine", "urgent", "critical"]), directiveSummary: z.string().trim().min(4).max(255),
    actionRequired: z.string().trim().min(4).max(2000) }),
  z.object({ kind: z.literal("need_to_know_resolve"), alertId: id, reason }),
  z.object({ kind: z.literal("court_restriction"), studentId: id, restrictedPersonName: z.string().trim().min(2).max(180),
    orderType: z.enum(["restraining_order", "custody_restriction", "prohibited_contact", "non_disclosure"]),
    docketNumber: z.string().trim().min(2).max(100), issuingCourt: z.string().trim().min(2).max(180),
    summary: z.string().trim().min(4).max(5000), effectiveDate: date, expirationDate: z.union([date, z.literal("")]),
    prohibitPickup: z.boolean(), prohibitDisclosure: z.boolean(), prohibitDirectContact: z.boolean() }),
  z.object({ kind: z.literal("court_restriction_status"), restrictionId: id, isEnforced: z.boolean(), reason }),
  z.object({ kind: z.literal("statutory_disclosure"), studentId: id,
    recipientAgency: z.string().trim().min(2).max(180), reason: z.string().trim().min(4).max(500) }),
  z.object({ kind: z.literal("clinic_visit"), studentId: id, category: z.string().trim().min(2).max(60),
    symptoms: z.string().trim().min(2).max(1000), treatment: z.string().trim().min(2).max(1000),
    outcome: z.enum(["returned_to_class", "resting_in_clinic", "sent_home", "collected_by_guardian", "emergency_referral"]),
    guardianNotified: z.boolean().default(false), guardianNotificationNotes: z.string().trim().max(1000).optional().nullable() }),
  z.object({ kind: z.literal("reception_log"), studentId: id,
    logType: z.enum(["late_arrival", "early_departure"]),
    logDate: date, timeString: z.string().trim().min(2).max(10),
    minutesLate: z.number().int().min(0).max(480).default(0),
    reason: z.string().trim().min(2).max(255),
    actorPersonName: z.string().trim().max(180).default(""),
    relationship: z.string().trim().max(80).default(""),
    isExcused: z.boolean().default(false),
    remarks: z.string().trim().max(1000).optional().nullable() }),
  z.object({ kind: z.literal("emergency_sms_broadcast"),
    scope: z.enum(["whole_school", "grade", "class"]),
    targetId: z.string().default("all"),
    severity: z.enum(["urgent_alert", "lockdown", "school_closure", "weather_alert", "evacuation"]),
    message: z.string().trim().min(5).max(320) }),
  z.object({ kind: z.literal("behaviour_log"),
    studentId: id,
    classId: id.optional().nullable(),
    type: z.enum(["praise", "incident"]),
    category: z.string().trim().min(2).max(60),
    points: z.number().int().min(1).max(20).default(1),
    description: z.string().trim().max(1000).default(""),
    guardianVisible: z.boolean().default(true),
    occurredAt: date }),
]);

export const praiseCategories = [
  "academic_excellence",
  "outstanding_effort",
  "helping_others",
  "good_citizenship",
  "creativity",
  "teamwork",
  "resilience",
  "leadership",
] as const;
export type PraiseCategory = (typeof praiseCategories)[number];

export const incidentCategories = [
  "disruption",
  "incomplete_work",
  "tardiness_to_lesson",
  "uniform_violation",
  "defiance",
  "inappropriate_language",
  "technology_misuse",
  "property_damage",
] as const;
export type IncidentCategory = (typeof incidentCategories)[number];

export type WorkflowCommand = z.input<typeof workflowCommandSchema>;
