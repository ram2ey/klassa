"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Archive, Bell, Buildings, CalendarBlank, CalendarCheck, CaretLeft, CaretRight,
  ChatTeardropText, CheckCircle, ClockCounterClockwise,
  DeviceMobile, DotsThree, DownloadSimple, Gavel, Gear, GraduationCap, House, List,
  LockKey, MagnifyingGlass, Plus, ShieldCheck, ShieldWarning, Student, Table, UploadSimple, UserCheck,
  UserPlus, UsersThree, WarningCircle, X, FileText, Megaphone,
} from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  getWorkspaceData, createClassAction, createGuardianAction, createStudentAction,
  createSubjectAction, inviteStaffAction, processCsvImportAction,
  updateStudentStatusAction,
} from "@/app/actions/roster-actions";
import {
  correctAttendanceRecordAction,
  exportAttendanceCsvAction,
  saveAttendanceRollCallAction,
  submitGuardianExcuseAction,
  type AttendanceSheetRecord,
  type DiscrepancyCorrectionRecord,
} from "@/app/actions/attendance-actions";
import {
  createAssessmentAction,
  correctGradeWithAuditAction,
  generateTermReportCardsAction,
  publishReportCardAction,
  saveGradebookScoreAction,
  toggleAssessmentPublicationAction,
  type AssessmentCategoryItem,
  type AssessmentItemData,
  type GradeCorrectionLogItem,
  type GradebookStudentRow,
  type GradingSchemeDefinition,
} from "@/app/actions/assessment-actions";
import {
  type AssessmentInput,
  type OfficialReportCardData,
  scoreToGrade,
  STANDARD_LETTER_SCALE,
  STANDARDS_BASED_SCALE,
} from "@/lib/assessments";
import { GradebookModule } from "@/components/assessments/gradebook-module";
import { ReportCardsModule } from "@/components/assessments/report-cards-module";
import { OfficialReportCardModal } from "@/components/assessments/official-report-card-modal";
import { CorrectGradeDialog } from "@/components/assessments/correct-grade-dialog";
import { AddAssessmentDialog } from "@/components/assessments/add-assessment-dialog";
import { CommunicationsModule } from "@/components/communications/communications-module";
import {
  type AnnouncementRecord,
  type CommunicationTemplateItem,
  type GuardianConsentRecord,
  type SmsDeliveryItem,
  type AnnouncementInput,
  type EmergencyBroadcastInput,
  type GuardianConsentInput,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_GUARDIAN_CONSENTS,
  DEFAULT_COMMUNICATION_TEMPLATES,
  INITIAL_SMS_DELIVERY_LOGS,
} from "@/lib/communications";
import {
  createAnnouncementAction,
  initiateEmergencyBroadcastAction,
  recordAnnouncementReadAction,
  updateGuardianConsentAction,
} from "@/app/actions/communication-actions";
import { SensitiveRecordsModule } from "@/components/sensitive/sensitive-records-module";
import {
  type SensitiveCaseRecord,
  type NeedToKnowAlertRecord,
  type CourtRestrictionRecord,
  type SensitiveAccessLogRecord,
  type KlassoRole,
  INITIAL_SENSITIVE_CASES,
  INITIAL_NEED_TO_KNOW_ALERTS,
  INITIAL_COURT_RESTRICTIONS,
  INITIAL_SENSITIVE_ACCESS_LOGS,
} from "@/lib/sensitive-records";
import { GdprCompliancePanel } from "@/components/settings/gdpr-compliance-panel";
import { MultiSchoolPanel } from "@/components/settings/multi-school-panel";
import { SecurityCompliancePanel } from "@/components/settings/security-compliance-panel";
import { OpenApiExplorerPanel } from "@/components/settings/openapi-explorer-panel";
import {
  type OrganizationRecord,
  type OnboardingChecklist,
  INITIAL_ORGANIZATIONS,
  INITIAL_ONBOARDING_CHECKLISTS,
} from "@/lib/tenant-admin";
import {
  type GdprRequestRecord,
  INITIAL_GDPR_REQUESTS,
} from "@/lib/gdpr";
import {
  type RestoreDrillRecord,
  INITIAL_RESTORE_DRILLS,
} from "@/lib/drills";
import { generateStudentCsvTemplate, validateStudentCsv, type CsvValidationResult } from "@/lib/csv";
import { type AttendanceStatus, calculateAttendanceMetrics } from "@/lib/attendance";
import { dispatchAbsenceAlert, getSmsDispatchHistory, type SmsDispatchResult } from "@/lib/sms";
import { addInAppNotification, getInAppNotifications, markAllNotificationsAsRead, type InAppNotification } from "@/lib/notifications";

export type NavModule = "Overview" | "Attendance" | "Gradebook" | "Report cards" | "Communications" | "Sensitive records" | "Students" | "Guardians" | "Classes" | "Imports" | "Audit log" | "Settings";
export type Persona = "admin" | "safeguarding" | "nurse" | "senco" | "teacher" | "guardian";

interface StudentRecord {
  id: string;
  firstName: string;
  lastName: string;
  initials: string;
  grade: string;
  className: string;
  guardians: number;
  status: "Active" | "Pending" | "Withdrawn";
  updated: string;
  dateOfBirth: string;
}

interface GuardianRecord {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  studentId: string;
  studentName: string;
  relationship: string;
  isPrimary: boolean;
  hasLegalResponsibility: boolean;
}

interface ClassRecord {
  id: string;
  name: string;
  grade: string;
  homeroomTeacher: string;
  studentCount: number;
}

interface SubjectRecord {
  id: string;
  code: string;
  name: string;
  department: string;
}

interface ImportJobRecord {
  id: string;
  sourceFilename: string;
  rowCount: number;
  validRowCount: number;
  invalidRowCount: number;
  status: string;
  createdAt: string;
}

interface StaffRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  twoFactorEnabled: boolean;
  status: string;
}

interface InvitationRecord {
  id: string;
  phoneNumber: string;
  role: string;
  token: string;
  expiresAt: string;
  status: string;
}

interface AuditRecordItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actorUserId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

const initialAuditLogs: AuditRecordItem[] = [
  { id: "aud-001", action: "student.updated", entityType: "student", entityId: "ST-2026-0142", actorUserId: "Olivia Parker", metadata: { target: "Amelia Warren", changes: "Guardian contact phone updated" }, createdAt: "12 min ago" },
  { id: "aud-002", action: "student.created", entityType: "student", entityId: "ST-2026-0126", actorUserId: "James Miller", metadata: { target: "Elias Martin", grade: "Grade 5" }, createdAt: "Yesterday, 15:34" },
  { id: "aud-003", action: "import.executed", entityType: "import_job", entityId: "imp-001", actorUserId: "Olivia Parker", metadata: { filename: "roster_fall_2026.csv", rowCount: 36 }, createdAt: "18 Sep, 11:06" },
  { id: "aud-004", action: "staff.invited", entityType: "invitation", entityId: "inv-001", actorUserId: "Olivia Parker", metadata: { email: "clara.counselor@northfield.edu", role: "office_staff" }, createdAt: "17 Sep, 16:45" },
];

const initialRollCallRecords: AttendanceSheetRecord[] = [
  { recordId: "rec-01", studentId: "ST-2026-0142", studentNumber: "ST-2026-0142", studentName: "Amelia Warren", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "David Warren", guardianPhone: "+354 555 0192" },
  { recordId: "rec-02", studentId: "ST-2026-0115", studentNumber: "ST-2026-0115", studentName: "Leo Williams", className: "7B", status: "late", arrivalMinutesLate: 15, reason: "School bus delay", remarks: "Bus #4 arrived 08:45", guardianName: "David Warren", guardianPhone: "+354 555 0192" },
  { recordId: "rec-03", studentId: "ST-2026-0119", studentNumber: "ST-2026-0119", studentName: "Sofia Larsen", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "Marta Larsen", guardianPhone: "+354 555 0177" },
  { recordId: "rec-04", studentId: "ST-2026-0138", studentNumber: "ST-2026-0138", studentName: "Noah Bennett", className: "7B", status: "excused", arrivalMinutesLate: 0, reason: "Dentist appointment", remarks: "Note verified", guardianName: "Karen Bennett", guardianPhone: "+354 555 0284" },
  { recordId: "rec-05", studentId: "ST-2026-0126", studentNumber: "ST-2026-0126", studentName: "Elias Martin", className: "7B", status: "absent", arrivalMinutesLate: 0, reason: "Unexcused absence", guardianName: "Robert Martin", guardianPhone: "+354 555 0371" },
];

const initialCorrections: DiscrepancyCorrectionRecord[] = [
  {
    id: "corr-001",
    recordId: "rec-04",
    studentId: "ST-2026-0138",
    studentName: "Noah Bennett",
    className: "7B",
    date: "2026-09-22",
    previousStatus: "absent",
    newStatus: "excused",
    reason: "Parent phoned office at 09:10 to confirm dentist appointment; certificate received.",
    correctedBy: "Olivia Parker (Office Staff)",
    correctedAt: "Today, 09:15",
  },
];

const initialAssessments: AssessmentItemData[] = [
  { id: "asm-mat-01", title: "Linear Equations & Functions Quiz", code: "MATH-Q1", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-quiz", categoryName: "Formative Quizzes", termId: "term-fall-2026", maxScore: 100, dateDue: "2026-09-15", status: "published", createdAt: "10 Sep 2026" },
  { id: "asm-mat-02", title: "Algebraic Problem Set #1", code: "MATH-HW1", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-hw", categoryName: "Homework & Lab Work", termId: "term-fall-2026", maxScore: 50, dateDue: "2026-09-18", status: "published", createdAt: "14 Sep 2026" },
  { id: "asm-mat-03", title: "Midterm Examination: Algebra & Logic", code: "MATH-MID", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-mid", categoryName: "Midterm Assessment", termId: "term-fall-2026", maxScore: 100, dateDue: "2026-09-21", status: "published", createdAt: "18 Sep 2026" },
  { id: "asm-mat-04", title: "Applied Geometry & Statistics Project", code: "MATH-PRJ", classId: "cls-7b", subjectId: "sub-mat", categoryId: "cat-proj", categoryName: "Final Project & Exam", termId: "term-fall-2026", maxScore: 100, dateDue: "2026-09-28", status: "draft", createdAt: "Yesterday" },
];

const initialAssessmentCategories: AssessmentCategoryItem[] = [
  { id: "cat-quiz", name: "Formative Quizzes", weight: 20 },
  { id: "cat-hw", name: "Homework & Lab Work", weight: 20 },
  { id: "cat-mid", name: "Midterm Assessment", weight: 30 },
  { id: "cat-proj", name: "Final Project & Exam", weight: 30 },
];

const initialSchemes: GradingSchemeDefinition[] = [
  { id: "sch-letter", name: "Standard Letter Grade (A+ through F, 4.0 Scale)", type: "letter", scale: STANDARD_LETTER_SCALE, isDefault: true },
  { id: "sch-standards", name: "Standards-Based Rubric (4-Level Proficiency)", type: "standards_based", scale: STANDARDS_BASED_SCALE, isDefault: false },
];

const initialGradeCorrections: GradeCorrectionLogItem[] = [
  {
    id: "gcorr-001",
    assessmentId: "asm-mat-03",
    assessmentTitle: "Midterm Examination: Algebra & Logic",
    studentId: "ST-2026-0142",
    studentName: "Amelia Warren",
    previousScore: 88,
    newScore: 92,
    previousGrade: "B+",
    newGrade: "A-",
    reason: "Correction on question 14: geometric proof verified during teacher department review.",
    correctedBy: "Elena Rostova (Teacher)",
    correctedAt: "21 Sep 2026, 16:40",
  },
];

const initialGradebookStudents: GradebookStudentRow[] = [
  {
    studentId: "ST-2026-0142",
    studentNumber: "ST-2026-0142",
    studentName: "Amelia Warren",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-01", score: 94, percentage: 94, letterGrade: "A", status: "published" },
      "asm-mat-02": { gradeId: "grd-02", score: 48, percentage: 96, letterGrade: "A", status: "published" },
      "asm-mat-03": { gradeId: "grd-03", score: 92, percentage: 92, letterGrade: "A-", status: "published" },
      "asm-mat-04": { gradeId: "grd-04", score: 95, percentage: 95, letterGrade: "A", status: "draft" },
    },
    computedPercentage: 93.7,
    computedLetter: "A",
    computedGpa: 4.0,
  },
  {
    studentId: "ST-2026-0115",
    studentNumber: "ST-2026-0115",
    studentName: "Leo Williams",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-05", score: 85, percentage: 85, letterGrade: "B", status: "published" },
      "asm-mat-02": { gradeId: "grd-06", score: 40, percentage: 80, letterGrade: "B-", status: "published" },
      "asm-mat-03": { gradeId: "grd-07", score: 88, percentage: 88, letterGrade: "B+", status: "published" },
    },
    computedPercentage: 84.9,
    computedLetter: "B",
    computedGpa: 3.0,
  },
  {
    studentId: "ST-2026-0119",
    studentNumber: "ST-2026-0119",
    studentName: "Sofia Larsen",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-08", score: 98, percentage: 98, letterGrade: "A+", status: "published" },
      "asm-mat-02": { gradeId: "grd-09", score: 50, percentage: 100, letterGrade: "A+", status: "published" },
      "asm-mat-03": { gradeId: "grd-10", score: 96, percentage: 96, letterGrade: "A", status: "published" },
    },
    computedPercentage: 97.7,
    computedLetter: "A+",
    computedGpa: 4.0,
  },
  {
    studentId: "ST-2026-0138",
    studentNumber: "ST-2026-0138",
    studentName: "Noah Bennett",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-11", score: 76, percentage: 76, letterGrade: "C", status: "published" },
      "asm-mat-02": { gradeId: "grd-12", score: 38, percentage: 76, letterGrade: "C", status: "published" },
      "asm-mat-03": { gradeId: "grd-13", score: 80, percentage: 80, letterGrade: "B-", status: "published" },
    },
    computedPercentage: 77.7,
    computedLetter: "C+",
    computedGpa: 2.3,
  },
  {
    studentId: "ST-2026-0126",
    studentNumber: "ST-2026-0126",
    studentName: "Elias Martin",
    className: "7B",
    scores: {
      "asm-mat-01": { gradeId: "grd-14", score: 72, percentage: 72, letterGrade: "C-", status: "published" },
      "asm-mat-02": { gradeId: "grd-15", score: 35, percentage: 70, letterGrade: "C-", status: "published" },
    },
    computedPercentage: 71.0,
    computedLetter: "C-",
    computedGpa: 1.7,
  },
];

const initialReportCards: OfficialReportCardData[] = [
  {
    reportCardId: "rc-st-0142-t1",
    studentId: "ST-2026-0142",
    studentNumber: "ST-2026-0142",
    studentName: "Amelia Warren",
    gradeLevel: "Grade 7",
    className: "7B",
    academicYear: "2026–2027",
    termName: "Term 1 (Fall)",
    version: 1,
    status: "published",
    gpa: 3.85,
    overallPercentage: 93.8,
    attendance: {
      attendanceRate: 97.8,
      daysEnrolled: 45,
      daysPresent: 44,
      daysLate: 0,
      daysExcused: 1,
      daysAbsent: 0,
    },
    subjects: [
      { subjectCode: "MATH-01", subjectName: "Mathematics & Logic", department: "STEM", teacherName: "Elena Rostova", scorePercentage: 93.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Amelia demonstrates outstanding logical clarity and participates actively in problem-solving discussions." },
      { subjectCode: "SCI-01", subjectName: "Natural Sciences", department: "STEM", teacherName: "Mark Davies", scorePercentage: 95.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Exceptional lab inquiry skills and analytical writing. A pleasure to teach." },
      { subjectCode: "ENG-01", subjectName: "English Language Arts", department: "Humanities", teacherName: "Sarah Jenkins", scorePercentage: 91.5, letterGrade: "A-", gpaPoint: 3.7, standardsLevel: "3 - Meeting", teacherComments: "Insightful textual analysis in literature seminar. Keep developing essay thesis depth." },
      { subjectCode: "HIS-01", subjectName: "World History & Civics", department: "Humanities", teacherName: "Thomas Brown", scorePercentage: 94.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Thorough understanding of historical evidence and cause-and-effect civil analysis." },
      { subjectCode: "ART-01", subjectName: "Visual Arts & Design", department: "Creative Arts", teacherName: "Ingrid Holm", scorePercentage: 96.0, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Superb portfolio quality, demonstrating thoughtful craftsmanship and balance." },
      { subjectCode: "PE-01", subjectName: "Physical Education & Health", department: "Athletics", teacherName: "James Miller", scorePercentage: 93.5, letterGrade: "A", gpaPoint: 4.0, standardsLevel: "4 - Exceeding", teacherComments: "Positive leadership during team athletics and consistent commitment." },
    ],
    homeroomTeacherRemarks: "Amelia has had an exemplary term both academically and socially. She consistently supports her peers and exemplifies the school's core institutional values.",
    principalRemarks: "Distinguished Academic Honor Roll. Congratulations on an exceptional first term.",
    publishedAt: "22 Sep 2026",
  },
  {
    reportCardId: "rc-st-0115-t1",
    studentId: "ST-2026-0115",
    studentNumber: "ST-2026-0115",
    studentName: "Leo Williams",
    gradeLevel: "Grade 6",
    className: "7B",
    academicYear: "2026–2027",
    termName: "Term 1 (Fall)",
    version: 1,
    status: "draft",
    gpa: 3.20,
    overallPercentage: 84.5,
    attendance: {
      attendanceRate: 95.5,
      daysEnrolled: 45,
      daysPresent: 43,
      daysLate: 1,
      daysExcused: 0,
      daysAbsent: 1,
    },
    subjects: [
      { subjectCode: "MATH-01", subjectName: "Mathematics & Logic", department: "STEM", teacherName: "Elena Rostova", scorePercentage: 85.0, letterGrade: "B", gpaPoint: 3.0, teacherComments: "Solid engagement; focus on foundational algebra." },
      { subjectCode: "SCI-01", subjectName: "Natural Sciences", department: "STEM", teacherName: "Mark Davies", scorePercentage: 84.0, letterGrade: "B", gpaPoint: 3.0, teacherComments: "Good participation in laboratory demonstrations." },
    ],
    homeroomTeacherRemarks: "Leo is making steady progress and shows great sportsmanship.",
    principalRemarks: "Good academic standing.",
  },
];

export function KlassoWorkspace({ roster }: { roster: Awaited<ReturnType<typeof getWorkspaceData>> }) {
  const [collapsed, setCollapsed] = useState(false);
  const [invitationError, setInvitationError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [active, setActive] = useState<NavModule>("Attendance");
  const [persona, setPersona] = useState<Persona>("admin");
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  // Data state
  const [students, setStudents] = useState<StudentRecord[]>(roster.students);
  const [guardians, setGuardians] = useState<GuardianRecord[]>(roster.guardians);
  const [classes, setClasses] = useState<ClassRecord[]>(roster.classes);
  const [subjects, setSubjects] = useState<SubjectRecord[]>(roster.subjects);
  const [importJobs, setImportJobs] = useState<ImportJobRecord[]>(roster.importJobs);
  const [staff] = useState<StaffRecord[]>(roster.staff);
  const [invitations, setInvitations] = useState<InvitationRecord[]>(roster.invitations);
  const [auditLogs, setAuditLogs] = useState<AuditRecordItem[]>(initialAuditLogs);
  const [notifications, setNotifications] = useState<InAppNotification[]>(getInAppNotifications());

  // Phase 2 Attendance State
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceSheetRecord[]>(initialRollCallRecords);
  const [attendanceSessionStatus, setAttendanceSessionStatus] = useState<"in_progress" | "submitted">("submitted");
  const [selectedClassId, setSelectedClassId] = useState("cls-7b");
  const [corrections, setCorrections] = useState<DiscrepancyCorrectionRecord[]>(initialCorrections);
  const [smsLedger, setSmsLedger] = useState<SmsDispatchResult[]>(getSmsDispatchHistory());

  // Phase 3 Gradebook & Report Cards State
  const [gradebookClassId, setGradebookClassId] = useState("cls-7b");
  const [gradebookSubjectId, setGradebookSubjectId] = useState("sub-mat");
  const [assessments, setAssessments] = useState<AssessmentItemData[]>(initialAssessments);
  const [categories] = useState<AssessmentCategoryItem[]>(initialAssessmentCategories);
  const [schemes] = useState<GradingSchemeDefinition[]>(initialSchemes);
  const [gradebookStudents, setGradebookStudents] = useState<GradebookStudentRow[]>(initialGradebookStudents);
  const [gradeCorrections, setGradeCorrections] = useState<GradeCorrectionLogItem[]>(initialGradeCorrections);
  const [reportCards, setReportCards] = useState<OfficialReportCardData[]>(initialReportCards);
  const [selectedReportCard, setSelectedReportCard] = useState<OfficialReportCardData | null>(null);
  const [gradeToCorrect, setGradeToCorrect] = useState<{
    gradeId: string;
    assessmentId: string;
    assessmentTitle: string;
    studentId: string;
    studentName: string;
    currentScore: number;
    maxScore: number;
  } | null>(null);

  // Phase 4 Communications State
  const [announcements, setAnnouncements] = useState<AnnouncementRecord[]>(INITIAL_ANNOUNCEMENTS);
  const [commTemplates] = useState<CommunicationTemplateItem[]>(DEFAULT_COMMUNICATION_TEMPLATES);
  const [guardianConsents, setGuardianConsents] = useState<GuardianConsentRecord[]>(INITIAL_GUARDIAN_CONSENTS);
  const [commSmsLedger] = useState<SmsDeliveryItem[]>(INITIAL_SMS_DELIVERY_LOGS);

  // Phase 5 Sensitive Records State
  const [sensitiveCases, setSensitiveCases] = useState<SensitiveCaseRecord[]>(INITIAL_SENSITIVE_CASES);
  const [needToKnowAlerts, setNeedToKnowAlerts] = useState<NeedToKnowAlertRecord[]>(INITIAL_NEED_TO_KNOW_ALERTS);
  const [courtRestrictions, setCourtRestrictions] = useState<CourtRestrictionRecord[]>(INITIAL_COURT_RESTRICTIONS);
  const [sensitiveAccessLogs, setSensitiveAccessLogs] = useState<SensitiveAccessLogRecord[]>(INITIAL_SENSITIVE_ACCESS_LOGS);

  // Phase 6 Production Hardening & Multi-Tenant State
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>(INITIAL_ORGANIZATIONS);
  const [onboardingChecklists, setOnboardingChecklists] = useState<Record<string, OnboardingChecklist>>(INITIAL_ONBOARDING_CHECKLISTS);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationRecord>(INITIAL_ORGANIZATIONS[0] ?? {
    id: "org-northfield",
    name: "Northfield Academy",
    slug: "northfield",
    domain: "northfield.edu.is",
    timezone: "Atlantic/Reykjavik",
    gradingScheme: "letter",
    status: "active",
    studentCount: 412,
    staffCount: 28,
    mfaEnforced: true,
    createdAt: "2024-01-15T08:00:00.000Z",
  });
  const [gdprRequests, setGdprRequests] = useState<GdprRequestRecord[]>(INITIAL_GDPR_REQUESTS);
  const [restoreDrills] = useState<RestoreDrillRecord[]>(INITIAL_RESTORE_DRILLS);

  const currentKlassoRole: KlassoRole = useMemo(() => {
    switch (persona) {
      case "admin": return "school_admin";
      case "safeguarding": return "safeguarding_lead";
      case "nurse": return "health_nurse";
      case "senco": return "senco";
      case "teacher": return "teacher";
      case "guardian": return "guardian";
      default: return "school_admin";
    }
  }, [persona]);

  const currentSpecialistUser = useMemo(() => {
    switch (persona) {
      case "admin": return { id: "usr-admin-1", name: "Margaret Evans (Head of School)" };
      case "safeguarding": return { id: "usr-safe-01", name: "Rachel Vance (Safeguarding Lead)" };
      case "nurse": return { id: "usr-nurse-01", name: "Helena Thorne (School Nurse)" };
      case "senco": return { id: "usr-senco-01", name: "Dr. Arthur Bell (SENCO Lead)" };
      case "teacher": return { id: "usr-teacher-1", name: "Elena Rostova (Class Teacher)" };
      case "guardian": return { id: "usr-guardian-1", name: "David Warren (Parent)" };
      default: return { id: "usr-admin-1", name: "Admin Staff" };
    }
  }, [persona]);

  // Filters & Modals
  const [query, setQuery] = useState("");
  const [gradeFilter, setGradeFilter] = useState("All grades");
  const [statusFilter, setStatusFilter] = useState("All statuses");
  const [modal, setModal] = useState<"addStudent" | "importCsv" | "addGuardian" | "addClass" | "addSubject" | "inviteStaff" | "correctRecord" | "submitExcuse" | "correctGrade" | "addAssessment" | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<StudentRecord | null>(null);
  const [recordToCorrect, setRecordToCorrect] = useState<AttendanceSheetRecord | null>(null);

  const [, startTransition] = useTransition();

  const filteredStudents = useMemo(() => students.filter((student) => {
    const searchTarget = `${student.firstName} ${student.lastName} ${student.id} ${student.className}`.toLowerCase();
    const matchesQuery = searchTarget.includes(query.toLowerCase());
    const matchesGrade = gradeFilter === "All grades" || student.grade === gradeFilter;
    const matchesStatus = statusFilter === "All statuses" || student.status === statusFilter;
    return matchesQuery && matchesGrade && matchesStatus;
  }), [gradeFilter, query, statusFilter, students]);

  const unreadCount = useMemo(() => notifications.filter((n) => !n.isRead).length, [notifications]);
  const attendanceMetrics = useMemo(() => calculateAttendanceMetrics(attendanceRecords), [attendanceRecords]);
  const commLedgerSummary = useMemo(() => {
    const totalDispatches = commSmsLedger.length;
    const totalCost = commSmsLedger.reduce((sum, item) => sum + item.cost, 0);
    const totalSegments = commSmsLedger.reduce((sum, item) => sum + item.segments, 0);
    const deliveredCount = commSmsLedger.filter((i) => i.status === "delivered").length;
    return {
      totalDispatches,
      totalCost: Number(totalCost.toFixed(3)),
      totalSegments,
      deliveredCount,
    };
  }, [commSmsLedger]);

  // Actions
  function handlePersonaSwitch(newPersona: Persona) {
    setPersona(newPersona);
    if (newPersona === "guardian") {
      setActive("Attendance");
    } else if (newPersona === "teacher") {
      setActive("Attendance");
    } else if (newPersona === "safeguarding" || newPersona === "nurse" || newPersona === "senco") {
      setActive("Sensitive records");
    }
  }

  function handleMarkAllPresent() {
    setAttendanceRecords((curr) => curr.map((r) => ({ ...r, status: "present", arrivalMinutesLate: 0, reason: "" })));
  }

  function handleSetStudentAttendance(studentId: string, status: AttendanceStatus, arrivalLate?: number, reason?: string) {
    setAttendanceRecords((curr) => curr.map((r) => {
      if (r.studentId === studentId) {
        return {
          ...r,
          status,
          arrivalMinutesLate: status === "late" ? (arrivalLate ?? r.arrivalMinutesLate ?? 10) : 0,
          reason: reason !== undefined ? reason : r.reason,
        };
      }
      return r;
    }));
  }

  function handleSubmitAttendanceSession() {
    setAttendanceSessionStatus("submitted");
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";

    setAuditLogs((curr) => [{
      id: `aud-${Date.now()}`,
      action: "attendance.session_submitted",
      entityType: "attendance_session",
      entityId: `sess-${selectedClassId}-2026-09-22`,
      actorUserId: actorName,
      metadata: { class: "7B", attendanceRate: `${attendanceMetrics.attendanceRate}%`, absentees: attendanceMetrics.absent },
      createdAt: "Just now",
    }, ...curr]);

    // Generate alerts for absent students
    const absentees = attendanceRecords.filter((r) => r.status === "absent");
    absentees.forEach((absent) => {
      const notif = addInAppNotification({
        title: "Unexcused Absence Alert",
        message: `${absent.studentName} marked absent in Class 7B. Alert queued for ${absent.guardianName}.`,
        type: "absence_alert",
        metadata: { studentId: absent.studentId },
      });
      setNotifications((curr) => [notif, ...curr]);
    });

    startTransition(async () => {
      await saveAttendanceRollCallAction({
        sessionId: `sess-${selectedClassId}-2026-09-22`,
        records: attendanceRecords.map((r) => ({
          studentId: r.studentId,
          status: r.status,
          arrivalMinutesLate: r.arrivalMinutesLate,
          reason: r.reason,
        })),
        submit: true,
        recordedBy: actorName,
      });
    });
  }

  function handleDispatchAbsenceSms() {
    const unexcused = attendanceRecords.filter((r) => r.status === "absent");
    unexcused.forEach((student) => {
      startTransition(async () => {
        const result = await dispatchAbsenceAlert({
          recipientPhone: student.guardianPhone || "+354 555 0371",
          recipientName: student.guardianName || "Primary Guardian",
          studentId: student.studentId,
          studentName: student.studentName,
          dateStr: "2026-09-22",
        });
        setSmsLedger((curr) => [result, ...curr]);
      });
    });

    const notif = addInAppNotification({
      title: "Absence SMS Alerts Dispatched",
      message: `Dispatched SMS absence notices for ${unexcused.length} unexcused absent student(s).`,
      type: "absence_alert",
    });
    setNotifications((curr) => [notif, ...curr]);
  }

  function handleCorrectRecord(formData: FormData) {
    if (!recordToCorrect) return;
    const newStatus = String(formData.get("newStatus") || "excused") as AttendanceStatus;
    const reason = String(formData.get("reason") || "");
    const actor = "Olivia Parker (Office Staff)";

    const newCorrection: DiscrepancyCorrectionRecord = {
      id: `corr-${Date.now()}`,
      recordId: recordToCorrect.recordId,
      studentId: recordToCorrect.studentId,
      studentName: recordToCorrect.studentName,
      className: recordToCorrect.className,
      date: "2026-09-22",
      previousStatus: recordToCorrect.status,
      newStatus,
      reason,
      correctedBy: actor,
      correctedAt: "Just now",
    };

    setCorrections((curr) => [newCorrection, ...curr]);
    setAttendanceRecords((curr) => curr.map((r) => r.recordId === recordToCorrect.recordId ? { ...r, status: newStatus, reason } : r));

    setAuditLogs((curr) => [{
      id: `aud-${Date.now()}`,
      action: "attendance.discrepancy_resolved",
      entityType: "attendance_record",
      entityId: recordToCorrect.recordId,
      actorUserId: actor,
      metadata: { student: recordToCorrect.studentName, from: recordToCorrect.status, to: newStatus, reason },
      createdAt: "Just now",
    }, ...curr]);

    const notif = addInAppNotification({
      title: "Attendance Discrepancy Resolved",
      message: `${recordToCorrect.studentName} updated from ${recordToCorrect.status.toUpperCase()} to ${newStatus.toUpperCase()}.`,
      type: "attendance_discrepancy",
    });
    setNotifications((curr) => [notif, ...curr]);

    startTransition(async () => {
      await correctAttendanceRecordAction({
        attendanceRecordId: recordToCorrect.recordId,
        studentId: recordToCorrect.studentId,
        previousStatus: recordToCorrect.status,
        newStatus,
        reason,
        correctedBy: actor,
      });
    });

    setModal(null);
    setRecordToCorrect(null);
  }

  function handleGuardianSubmitExcuse(formData: FormData) {
    const reason = String(formData.get("reason") || "Doctor appointment");
    const dateStr = String(formData.get("dateStr") || "2026-09-22");

    const notif = addInAppNotification({
      title: "Guardian Excuse Note Received",
      message: `David Warren submitted excuse for Amelia Warren (${dateStr}): "${reason}"`,
      type: "guardian_excuse",
    });
    setNotifications((curr) => [notif, ...curr]);

    startTransition(async () => {
      await submitGuardianExcuseAction({
        studentId: "ST-2026-0142",
        dateStr,
        reason,
        guardianName: "David Warren",
      });
    });

    setModal(null);
  }

  function handleExportAttendanceReport() {
    startTransition(async () => {
      const csvData = await exportAttendanceCsvAction("2026-09-22");
      const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `klassa_attendance_report_2026-09-22.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  // Phase 1 existing handlers
  function handleAddStudent(formData: FormData) {
    const firstName = String(formData.get("firstName") || "New");
    const lastName = String(formData.get("lastName") || "Student");
    const gradeLevel = String(formData.get("gradeLevel") || "Grade 7");
    const className = String(formData.get("className") || "7A");
    const dateOfBirth = String(formData.get("dateOfBirth") || "2014-01-01");
    let nextStudentNumber = 1;
    while (students.some(student => student.id === `ST-${String(nextStudentNumber).padStart(6, "0")}`)) nextStudentNumber++;
    const studentNumber = `ST-${String(nextStudentNumber).padStart(6, "0")}`;

    const newRecord: StudentRecord = {
      id: studentNumber,
      firstName,
      lastName,
      initials: `${firstName[0]}${lastName[0]}`.toUpperCase(),
      grade: gradeLevel,
      className,
      guardians: 0,
      status: "Pending",
      updated: "Just now",
      dateOfBirth,
    };

    setStudents((curr) => [newRecord, ...curr]);
    startTransition(async () => {
      await createStudentAction({ firstName, lastName, dateOfBirth, gradeLevel, className });
    });
    setModal(null);
  }

  function handleToggleStatus(studentId: string) {
    setStudents((curr) => curr.map((s) => {
      if (s.id === studentId) {
        const nextStatus = s.status === "Active" ? "Pending" : "Active";
        return { ...s, status: nextStatus, updated: "Just now" };
      }
      return s;
    }));
    startTransition(async () => {
      const st = students.find((s) => s.id === studentId);
      await updateStudentStatusAction(studentId, st?.status === "Active" ? "Pending" : "Active");
    });
  }

  function handleAddGuardian(formData: FormData) {
    const firstName = String(formData.get("firstName") || "");
    const lastName = String(formData.get("lastName") || "");
    const email = String(formData.get("email") || "");
    const phone = String(formData.get("phone") || "");
    const studentId = String(formData.get("studentId") || "");
    const relationship = String(formData.get("relationship") || "Guardian");
    const isPrimary = formData.get("isPrimary") === "on";
    const hasLegalResponsibility = formData.get("hasLegalResponsibility") === "on";

    const student = students.find((s) => s.id === studentId);
    const newGuardian: GuardianRecord = {
      id: `gd-${Date.now().toString().slice(-4)}`,
      firstName,
      lastName,
      email,
      phone,
      studentId,
      studentName: student ? `${student.firstName} ${student.lastName}` : studentId,
      relationship,
      isPrimary,
      hasLegalResponsibility,
    };

    setGuardians((curr) => [newGuardian, ...curr]);
    startTransition(async () => {
      await createGuardianAction({ firstName, lastName, email, phone, studentId, relationship, isPrimary, hasLegalResponsibility });
    });
    setModal(null);
  }

  function handleAddClass(formData: FormData) {
    const name = String(formData.get("name") || "");
    const grade = String(formData.get("grade") || "Grade 7");
    const homeroomTeacher = String(formData.get("homeroomTeacher") || "Unassigned");
    const newClass: ClassRecord = { id: `cls-${name.toLowerCase().replace(/\s+/g, "-")}`, name, grade, homeroomTeacher, studentCount: 0 };
    setClasses((curr) => [...curr, newClass]);
    startTransition(async () => { await createClassAction(name, grade, homeroomTeacher); });
    setModal(null);
  }

  function handleAddSubject(formData: FormData) {
    const code = String(formData.get("code") || "").toUpperCase();
    const name = String(formData.get("name") || "");
    const department = String(formData.get("department") || "General");
    const newSubject: SubjectRecord = { id: `sub-${code.toLowerCase()}`, code, name, department };
    setSubjects((curr) => [...curr, newSubject]);
    startTransition(async () => { await createSubjectAction(code, name, department); });
    setModal(null);
  }

  function handleInviteStaff(formData: FormData) {
    const phoneNumber = String(formData.get("phoneNumber") || "");
    const role = String(formData.get("role") || "office_staff") as "school_admin" | "office_staff";
    setInvitationError("");
    startTransition(async () => {
      try {
        const result = await inviteStaffAction(phoneNumber, role);
        setInvitations(curr => [result.invitation, ...curr]);
        setModal(null);
      } catch { setInvitationError("Unable to create the demo invitation. Use an international mobile number including + and country code."); }
    });
  }

  function handleApplyImport(filename: string, csvContent: string, result: CsvValidationResult) {
    const usedNumbers = new Set(students.map(student => student.id));
    let nextStudentNumber = 1;
    const newStudents: StudentRecord[] = result.validRecords.map((r) => {
      while (usedNumbers.has(`ST-${String(nextStudentNumber).padStart(6, "0")}`)) nextStudentNumber++;
      const studentNumber = `ST-${String(nextStudentNumber++).padStart(6, "0")}`;
      usedNumbers.add(studentNumber);
      return {
        id: studentNumber,
        firstName: r.firstName,
        lastName: r.lastName,
        initials: `${r.firstName[0]}${r.lastName[0]}`.toUpperCase(),
        grade: r.gradeLevel,
        className: r.className,
        guardians: 0,
        status: "Active",
        updated: "Imported today",
        dateOfBirth: r.dateOfBirth,
      };
    });
    setStudents((curr) => [...newStudents, ...curr]);
    const newJob: ImportJobRecord = { id: `imp-${Date.now().toString().slice(-4)}`, sourceFilename: filename, rowCount: result.totalRows, validRowCount: result.validCount, invalidRowCount: result.invalidCount, status: result.isValid ? "completed" : "completed_with_errors", createdAt: "Just now" };
    setImportJobs((curr) => [newJob, ...curr]);
    startTransition(async () => { await processCsvImportAction(filename, csvContent); });
    setModal(null);
    setActive("Students");
  }

  async function handleScoreSave(
    assessmentId: string,
    studentId: string,
    score: number,
    status: "draft" | "published",
  ) {
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";
    const assessment = assessments.find((a) => a.id === assessmentId);
    const maxScore = assessment?.maxScore ?? 100;
    const pct = Math.round((score / maxScore) * 1000) / 10;
    const gradeInfo = scoreToGrade(pct);

    setGradebookStudents((curr) =>
      curr.map((st) => {
        if (st.studentId === studentId) {
          const updatedScores = {
            ...st.scores,
            [assessmentId]: {
              gradeId: st.scores[assessmentId]?.gradeId ?? `grd-${Date.now()}`,
              score,
              percentage: pct,
              letterGrade: gradeInfo.label,
              status,
            },
          };
          return {
            ...st,
            scores: updatedScores,
          };
        }
        return st;
      }),
    );

    startTransition(async () => {
      await saveGradebookScoreAction({
        assessmentId,
        studentId,
        score,
        status,
        actorName,
      });
    });
  }

  async function handleCorrectGradeSubmit(newScore: number, reason: string) {
    if (!gradeToCorrect) return;
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";
    const res = await correctGradeWithAuditAction({
      gradeId: gradeToCorrect.gradeId,
      assessmentId: gradeToCorrect.assessmentId,
      studentId: gradeToCorrect.studentId,
      studentName: gradeToCorrect.studentName,
      previousScore: gradeToCorrect.currentScore,
      newScore,
      reason,
      actorName,
    });

    if (res.success && res.correction) {
      setGradeCorrections((curr) => [res.correction!, ...curr]);
      const assessment = assessments.find((a) => a.id === gradeToCorrect.assessmentId);
      const maxScore = assessment?.maxScore ?? 100;
      const pct = Math.round((newScore / maxScore) * 100);
      const gradeInfo = scoreToGrade(pct);

      setGradebookStudents((curr) =>
        curr.map((st) => {
          if (st.studentId === gradeToCorrect.studentId) {
            return {
              ...st,
              scores: {
                ...st.scores,
                [gradeToCorrect.assessmentId]: {
                  ...st.scores[gradeToCorrect.assessmentId],
                  score: newScore,
                  percentage: pct,
                  letterGrade: gradeInfo.label,
                },
              },
            };
          }
          return st;
        }),
      );

      setAuditLogs((curr) => [
        {
          id: `aud-${Date.now()}`,
          action: "grade.corrected",
          entityType: "assessment_grade",
          entityId: gradeToCorrect.gradeId,
          actorUserId: actorName,
          metadata: {
            student: gradeToCorrect.studentName,
            assessment: gradeToCorrect.assessmentTitle,
            reason,
            newScore,
          },
          createdAt: "Just now",
        },
        ...curr,
      ]);
    }
  }

  async function handleTogglePublishAssessment(assessmentId: string, publish: boolean) {
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";
    setAssessments((curr) =>
      curr.map((a) => (a.id === assessmentId ? { ...a, status: publish ? "published" : "draft" } : a)),
    );
    setGradebookStudents((curr) =>
      curr.map((st) => {
        if (st.scores[assessmentId]) {
          return {
            ...st,
            scores: {
              ...st.scores,
              [assessmentId]: {
                ...st.scores[assessmentId],
                status: publish ? "published" : "draft",
              },
            },
          };
        }
        return st;
      }),
    );

    startTransition(async () => {
      await toggleAssessmentPublicationAction(assessmentId, publish, actorName);
    });
  }

  async function handleCreateAssessment(input: AssessmentInput) {
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";
    const res = await createAssessmentAction(input, actorName);
    if (res.success && res.assessment) {
      setAssessments((curr) => [...curr, res.assessment!]);
      setAuditLogs((curr) => [
        {
          id: `aud-${Date.now()}`,
          action: "assessment.created",
          entityType: "assessment",
          entityId: res.assessment!.id,
          actorUserId: actorName,
          metadata: { title: input.title, code: input.code },
          createdAt: "Just now",
        },
        ...curr,
      ]);
    }
  }

  async function handlePublishReportCard(reportCardId: string) {
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";
    const res = await publishReportCardAction(reportCardId, actorName);
    if (res.success && res.reportCard) {
      setReportCards((curr) =>
        curr.map((rc) => (rc.reportCardId === reportCardId ? res.reportCard! : rc)),
      );
      setAuditLogs((curr) => [
        {
          id: `aud-${Date.now()}`,
          action: "report_card.published",
          entityType: "report_card",
          entityId: reportCardId,
          actorUserId: actorName,
          metadata: { student: res.reportCard!.studentName, term: res.reportCard!.termName },
          createdAt: "Just now",
        },
        ...curr,
      ]);
    }
  }

  async function handleGenerateBatchReportCards(termId: string, classId: string) {
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Olivia Parker (Admin)";
    const res = await generateTermReportCardsAction(termId, classId, actorName);
    if (res.success && res.reportCards) {
      setReportCards(res.reportCards);
    }
  }

  async function handleCreateAnnouncement(input: AnnouncementInput) {
    const actorName = persona === "teacher" ? "Elena Rostova (Teacher)" : "Sarah Jenkins (Registrar)";
    const res = await createAnnouncementAction(input, actorName);
    if (res.success && res.announcement) {
      setAnnouncements((curr) => [res.announcement!, ...curr]);
      setAuditLogs((curr) => [
        {
          id: `aud-${Date.now()}`,
          action: "announcement.created",
          entityType: "announcement",
          entityId: res.announcement!.id,
          actorUserId: actorName,
          metadata: { title: input.title, channels: input.channels, priority: input.priority },
          createdAt: "Just now",
        },
        ...curr,
      ]);
      const notif = addInAppNotification({
        title: `Official Circular: ${input.title}`,
        message: input.content.slice(0, 100),
        type: "announcement",
      });
      setNotifications((curr) => [notif, ...curr]);
    }
    return res;
  }

  async function handleInitiateEmergencyBroadcast(input: EmergencyBroadcastInput) {
    const actorName = "Sarah Jenkins (Registrar)";
    const res = await initiateEmergencyBroadcastAction(input, actorName);
    if (res.success && res.emergencyAnnouncement) {
      setAnnouncements((curr) => [res.emergencyAnnouncement!, ...curr]);
      setAuditLogs((curr) => [
        {
          id: `aud-${Date.now()}`,
          action: "emergency_broadcast.confirmed",
          entityType: "emergency_broadcast",
          entityId: res.emergencyAnnouncement!.id,
          actorUserId: "Dr. Arthur Vance (Headmaster)",
          metadata: { title: input.title, firstApproverId: input.firstApproverId, secondApproverId: input.secondApproverId },
          createdAt: "Just now",
        },
        ...curr,
      ]);
      const notif = addInAppNotification({
        title: `CRITICAL SAFETY ALERT: ${input.title}`,
        message: input.content.slice(0, 120),
        type: "emergency",
      });
      setNotifications((curr) => [notif, ...curr]);
    }
    return res;
  }

  async function handleRecordAnnouncementRead(announcementId: string, userId: string) {
    setAnnouncements((curr) =>
      curr.map((a) => (a.id === announcementId ? { ...a, readCount: Math.min(a.targetRecipientCount, a.readCount + 1) } : a)),
    );
    startTransition(async () => {
      await recordAnnouncementReadAction(announcementId, userId);
    });
  }

  async function handleUpdateGuardianConsent(input: GuardianConsentInput) {
    const actorName = "David Warren (Guardian)";
    const res = await updateGuardianConsentAction(input, actorName);
    if (res.success && res.consent) {
      setGuardianConsents((curr) =>
        curr.map((c) => (c.guardianId === input.guardianId ? res.consent! : c)),
      );
      setAuditLogs((curr) => [
        {
          id: `aud-${Date.now()}`,
          action: "guardian_consent.updated",
          entityType: "guardian_consent",
          entityId: input.guardianId,
          actorUserId: actorName,
          metadata: { phone: input.phone, announcements: input.optInSmsAnnouncements, attendance: input.optInSmsAttendance },
          createdAt: "Just now",
        },
        ...curr,
      ]);
    }
    return res;
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans">
      <div role="status" className="sticky top-0 z-50 bg-amber-100 px-4 py-2 text-center text-xs text-amber-950">Local demo ? Synthetic records only ? Changes are temporary and shared within this preview ? SMS and approvals are simulations</div>
      {mobileOpen && (
        <button
          aria-label="Close navigation"
          className="fixed inset-0 z-30 bg-slate-950/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar Navigation */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex border-r border-slate-800 bg-slate-950 text-slate-300 transition-[width,transform] duration-150 select-none",
          collapsed ? "w-16" : "w-60",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className={cn("flex h-16 items-center border-b border-slate-800", collapsed ? "justify-center px-2" : "px-5")}>
            <div className="min-w-0">
              <div className="text-[19px] font-bold tracking-[0.14em] text-white flex items-center gap-2">
                <span>{collapsed ? "K" : "KLASSA"}</span>
                {!collapsed && <span className="text-[10px] bg-blue-900/80 text-blue-300 px-1.5 py-0.5 border border-blue-700 tracking-wider">PHASE 6: PRODUCTION HARDENING</span>}
              </div>
              {!collapsed && <div className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-slate-500">School administration</div>}
            </div>
          </div>

          {!collapsed && (
            <div className="border-b border-slate-800 p-3">
              <div className="flex w-full items-center gap-3 border border-slate-700 bg-slate-900 px-3 py-2 text-left">
                <span className="flex h-8 w-8 items-center justify-center border border-blue-800 bg-blue-950 text-blue-300">
                  <Buildings size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-semibold text-white">{currentOrganization.name}</span>
                  <span className="block text-[10px] text-slate-500">2026–27 Academic Year</span>
                </span>
              </div>
            </div>
          )}

          <nav aria-label="Primary navigation" className="flex-1 space-y-1 p-2">
            {!collapsed && <p className="px-2 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">Workspace</p>}
            {[
              { label: "Overview" as const, icon: House, roles: ["admin", "safeguarding", "nurse", "senco", "teacher", "guardian"] },
              { label: "Attendance" as const, icon: CalendarCheck, roles: ["admin", "safeguarding", "nurse", "senco", "teacher", "guardian"] },
              { label: "Gradebook" as const, icon: Table, roles: ["admin", "safeguarding", "nurse", "senco", "teacher"] },
              { label: "Report cards" as const, icon: FileText, roles: ["admin", "safeguarding", "nurse", "senco", "teacher"] },
              { label: "Communications" as const, icon: Megaphone, roles: ["admin", "safeguarding", "nurse", "senco", "teacher", "guardian"] },
              { label: "Sensitive records" as const, icon: LockKey, roles: ["admin", "safeguarding", "nurse", "senco", "teacher"] },
              { label: "Students" as const, icon: Student, roles: ["admin", "safeguarding", "nurse", "senco", "teacher"] },
              { label: "Guardians" as const, icon: UsersThree, roles: ["admin", "safeguarding"] },
              { label: "Classes" as const, icon: GraduationCap, roles: ["admin", "safeguarding", "nurse", "senco", "teacher"] },
              { label: "Imports" as const, icon: Archive, roles: ["admin"] },
            ].filter((item) => item.roles.includes(persona)).map((item) => {
              const Icon = item.icon;
              const selected = active === item.label;
              return (
                <button
                  key={item.label}
                  title={collapsed ? item.label : undefined}
                  onClick={() => { setActive(item.label); setMobileOpen(false); }}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 border-l-2 px-3 text-[13px] font-medium transition-colors",
                    selected ? "border-blue-500 bg-blue-950/70 text-white font-semibold" : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Icon size={19} weight={selected ? "fill" : "regular"} />
                  {!collapsed && <span>{item.label}</span>}
                </button>
              );
            })}
          </nav>

          <div className="border-t border-slate-800 p-2 space-y-1">
            {!collapsed && <p className="px-2 pb-1 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-500">System</p>}
            {(persona === "admin" || persona === "safeguarding") && (
              <>
                <button
                  title={collapsed ? "Settings" : undefined}
                  onClick={() => { setActive("Settings"); setMobileOpen(false); }}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 border-l-2 px-3 text-[13px] font-medium transition-colors",
                    active === "Settings" ? "border-blue-500 bg-blue-950/70 text-white font-semibold" : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <Gear size={19} weight={active === "Settings" ? "fill" : "regular"} />
                  {!collapsed && <span>Settings</span>}
                </button>
                <button
                  title={collapsed ? "Audit log" : undefined}
                  onClick={() => { setActive("Audit log"); setMobileOpen(false); }}
                  className={cn(
                    "flex h-10 w-full items-center gap-3 border-l-2 px-3 text-[13px] font-medium transition-colors",
                    active === "Audit log" ? "border-blue-500 bg-blue-950/70 text-white font-semibold" : "border-transparent text-slate-400 hover:bg-slate-900 hover:text-white",
                    collapsed && "justify-center px-0",
                  )}
                >
                  <ShieldCheck size={19} weight={active === "Audit log" ? "fill" : "regular"} />
                  {!collapsed && <span>Audit log</span>}
                </button>
              </>
            )}
          </div>
        </div>

        <button
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-20 hidden h-6 w-6 items-center justify-center border border-slate-300 bg-white text-slate-600 shadow-sm hover:text-slate-950 lg:flex"
        >
          {collapsed ? <CaretRight size={13} /> : <CaretLeft size={13} />}
        </button>
      </aside>

      {/* Main Content Area */}
      <div className={cn("transition-[padding] duration-150", collapsed ? "lg:pl-16" : "lg:pl-60")}>
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white px-4 lg:px-6">
          <button
            className="flex h-10 w-10 items-center justify-center border border-slate-300 lg:hidden"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <List size={20} />
          </button>

          {/* Search */}
          <div className="relative hidden max-w-xs flex-1 md:block">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              aria-label="Search Klassa"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full border border-slate-300 bg-slate-50 pl-9 pr-3 text-[13px] placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
              placeholder="Search students, records…"
            />
          </div>

          {/* Role/Persona Switcher Bar */}
          <div className="flex flex-wrap items-center gap-1 border border-slate-200 bg-slate-100 p-1 text-xs">
            <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">Persona:</span>
            <button
              onClick={() => handlePersonaSwitch("admin")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "admin" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-950")}
            >
              Admin
            </button>
            <button
              onClick={() => handlePersonaSwitch("safeguarding")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "safeguarding" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-950")}
            >
              Safeguarding
            </button>
            <button
              onClick={() => handlePersonaSwitch("nurse")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "nurse" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-950")}
            >
              Nurse
            </button>
            <button
              onClick={() => handlePersonaSwitch("senco")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "senco" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-950")}
            >
              SENCO
            </button>
            <button
              onClick={() => handlePersonaSwitch("teacher")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "teacher" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-950")}
            >
              Teacher
            </button>
            <button
              onClick={() => handlePersonaSwitch("guardian")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "guardian" ? "bg-white text-blue-700 shadow-xs border border-slate-200" : "text-slate-600 hover:text-slate-950")}
            >
              Guardian
            </button>
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* Notification Bell */}
            <div className="relative">
              <button
                aria-label="Notifications"
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative flex h-9 w-9 items-center justify-center border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-blue-700 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 border border-slate-300 bg-white shadow-2xl z-50 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2.5 bg-slate-50">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">In-App Notification Center</span>
                    <button
                      onClick={() => {
                        markAllNotificationsAsRead();
                        setNotifications((curr) => curr.map((n) => ({ ...n, isRead: true })));
                      }}
                      className="text-[11px] font-semibold text-blue-700 hover:underline"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-slate-500">No notifications.</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={cn("p-3 text-xs space-y-0.5", !n.isRead && "bg-blue-50/40")}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-900">{n.title}</span>
                            <span className="text-[10px] text-slate-400">{n.createdAt}</span>
                          </div>
                          <p className="text-slate-600 text-[11px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div className="flex h-9 items-center gap-2 border-l border-slate-200 pl-3">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-xs font-bold text-white">
                {persona === "admin" ? "OP" : persona === "teacher" ? "ER" : "DW"}
              </span>
              <div className="hidden sm:block">
                <span className="block text-xs font-semibold">
                  {persona === "admin" ? "Olivia Parker" : persona === "teacher" ? "Elena Rostova" : "David Warren"}
                </span>
                <span className="block text-[10px] text-slate-500">
                  {persona === "admin" ? "School Administrator" : persona === "teacher" ? "Homeroom Teacher (7A/7B)" : "Parent / Guardian"}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Workspace View */}
        <main className="p-4 lg:p-6">
          {persona === "guardian" ? (
            <GuardianPortalView
              onSubmitExcuse={() => setModal("submitExcuse")}
              reportCards={reportCards}
              onViewReportCard={(rc) => setSelectedReportCard(rc)}
              announcements={announcements}
              consents={guardianConsents}
              onUpdateConsent={handleUpdateGuardianConsent}
            />
          ) : (
            <>
              {active === "Overview" && (
                <OverviewModule
                  studentsCount={students.length}
                  guardiansCount={guardians.length}
                  classesCount={classes.length}
                  attendanceRate={attendanceMetrics.attendanceRate}
                  recentAudit={auditLogs.slice(0, 5)}
                  onNavigate={(mod) => setActive(mod)}
                  onAddStudent={() => setModal("addStudent")}
                  onImportCsv={() => setModal("importCsv")}
                  onInviteStaff={() => setModal("inviteStaff")}
                />
              )}

              {active === "Attendance" && (
                <AttendanceManagerModule
                  records={attendanceRecords}
                  metrics={attendanceMetrics}
                  sessionStatus={attendanceSessionStatus}
                  selectedClassId={selectedClassId}
                  setSelectedClassId={setSelectedClassId}
                  classes={classes}
                  corrections={corrections}
                  smsLedger={smsLedger}
                  persona={persona === "teacher" ? "teacher" : "admin"}
                  onMarkAllPresent={handleMarkAllPresent}
                  onSetStatus={handleSetStudentAttendance}
                  onSubmitSession={handleSubmitAttendanceSession}
                  onOpenCorrectionModal={(rec) => {
                    setRecordToCorrect(rec);
                    setModal("correctRecord");
                  }}
                  onDispatchSms={handleDispatchAbsenceSms}
                  onExportCsv={handleExportAttendanceReport}
                />
              )}

              {active === "Gradebook" && (
                <GradebookModule
                  classId={gradebookClassId}
                  setClassId={setGradebookClassId}
                  subjectId={gradebookSubjectId}
                  setSubjectId={setGradebookSubjectId}
                  classes={classes}
                  subjects={subjects}
                  assessments={assessments.filter((a) => a.classId === gradebookClassId && a.subjectId === gradebookSubjectId)}
                  categories={categories}
                  schemes={schemes}
                  students={gradebookStudents}
                  corrections={gradeCorrections}
                  persona={persona === "teacher" ? "teacher" : "admin"}
                  onScoreSave={handleScoreSave}
                  onOpenCorrectionModal={(info) => {
                    setGradeToCorrect(info);
                    setModal("correctGrade");
                  }}
                  onTogglePublishAssessment={handleTogglePublishAssessment}
                  onAddAssessment={() => setModal("addAssessment")}
                />
              )}

              {active === "Report cards" && (
                <ReportCardsModule
                  reportCards={reportCards}
                  classes={classes}
                  selectedClassId={gradebookClassId}
                  setSelectedClassId={setGradebookClassId}
                  onViewReportCard={(rc) => setSelectedReportCard(rc)}
                  onPublishReportCard={handlePublishReportCard}
                  onGenerateBatch={handleGenerateBatchReportCards}
                />
              )}

              {active === "Communications" && (
                <CommunicationsModule
                  announcements={announcements}
                  templates={commTemplates}
                  consents={guardianConsents}
                  smsLedger={commSmsLedger}
                  ledgerSummary={commLedgerSummary}
                  onCreateAnnouncement={handleCreateAnnouncement}
                  onInitiateEmergencyBroadcast={handleInitiateEmergencyBroadcast}
                  onRecordRead={handleRecordAnnouncementRead}
                  onUpdateConsent={handleUpdateGuardianConsent}
                />
              )}

              {active === "Sensitive records" && (
                <SensitiveRecordsModule
                  currentUserRole={currentKlassoRole}
                  currentUserId={currentSpecialistUser.id}
                  currentUserName={currentSpecialistUser.name}
                  cases={sensitiveCases}
                  alerts={needToKnowAlerts}
                  courtOrders={courtRestrictions}
                  accessLogs={sensitiveAccessLogs}
                  onCaseCreated={(newCase) => {
                    setSensitiveCases((prev) => [newCase, ...prev]);
                  }}
                  onAlertCreated={(newAlert) => {
                    setNeedToKnowAlerts((prev) => [newAlert, ...prev]);
                  }}
                  onOrderRegistered={(newOrder) => {
                    setCourtRestrictions((prev) => [newOrder, ...prev]);
                  }}
                  onAccessAudited={(newLog) => {
                    setSensitiveAccessLogs((prev) => [newLog, ...prev]);
                  }}
                />
              )}

              {active === "Students" && (
                <StudentDirectoryModule
                  students={filteredStudents}
                  total={students.length}
                  query={query}
                  setQuery={setQuery}
                  gradeFilter={gradeFilter}
                  setGradeFilter={setGradeFilter}
                  statusFilter={statusFilter}
                  setStatusFilter={setStatusFilter}
                  needToKnowAlerts={needToKnowAlerts}
                  courtRestrictions={courtRestrictions}
                  onAdd={() => setModal("addStudent")}
                  onImport={() => setModal("importCsv")}
                  onSelectStudent={(st) => setSelectedStudent(st)}
                />
              )}

              {active === "Guardians" && (
                <GuardianDirectoryModule
                  guardians={guardians}
                  onAddGuardian={() => setModal("addGuardian")}
                />
              )}

              {active === "Classes" && (
                <AcademicSetupModule
                  classes={classes}
                  subjects={subjects}
                  onAddClass={() => setModal("addClass")}
                  onAddSubject={() => setModal("addSubject")}
                />
              )}

              {active === "Imports" && (
                <ImportWorkspaceModule
                  importJobs={importJobs}
                  onOpenImportModal={() => setModal("importCsv")}
                />
              )}

              {active === "Audit log" && (
                <AuditLogModule auditLogs={auditLogs} />
              )}

              {active === "Settings" && (
                <SettingsModule
                  staff={staff}
                  invitations={invitations}
                  onInviteStaff={() => setModal("inviteStaff")}
                  currentOrganization={currentOrganization}
                  organizations={organizations}
                  onboardingChecklists={onboardingChecklists}
                  gdprRequests={gdprRequests}
                  restoreDrills={restoreDrills}
                  students={students}
                  currentUserRole={currentKlassoRole}
                  currentUserId={currentSpecialistUser.id}
                  currentUserName={currentSpecialistUser.name}
                  onSwitchSchool={(org) => setCurrentOrganization(org)}
                  onSchoolProvisioned={(org, ch) => {
                    setOrganizations((prev) => [...prev, org]);
                    setOnboardingChecklists((prev) => ({ ...prev, [org.id]: ch }));
                  }}
                  onRequestCreated={(req) => setGdprRequests((prev) => [req, ...prev])}
                  onStudentAnonymized={(stId, updated) => {
                    setStudents((prev) =>
                      prev.map((s) => (s.id === stId ? { ...s, ...updated } : s))
                    );
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>

      {/* Modals & Dialogs */}
      {selectedReportCard && (
        <OfficialReportCardModal
          reportCard={selectedReportCard}
          onClose={() => setSelectedReportCard(null)}
        />
      )}

      {modal === "correctGrade" && gradeToCorrect && (
        <CorrectGradeDialog
          gradeInfo={gradeToCorrect}
          onClose={() => { setModal(null); setGradeToCorrect(null); }}
          onSubmit={handleCorrectGradeSubmit}
        />
      )}

      {modal === "addAssessment" && (
        <AddAssessmentDialog
          categories={categories}
          classId={gradebookClassId}
          subjectId={gradebookSubjectId}
          onClose={() => setModal(null)}
          onSubmit={handleCreateAssessment}
        />
      )}

      {modal === "correctRecord" && recordToCorrect && (
        <CorrectAttendanceDialog
          record={recordToCorrect}
          onClose={() => { setModal(null); setRecordToCorrect(null); }}
          onSubmit={handleCorrectRecord}
        />
      )}

      {modal === "submitExcuse" && (
        <SubmitExcuseDialog
          onClose={() => setModal(null)}
          onSubmit={handleGuardianSubmitExcuse}
        />
      )}

      {modal === "addStudent" && (
        <AddStudentDialog onClose={() => setModal(null)} onSubmit={handleAddStudent} />
      )}

      {modal === "importCsv" && (
        <ImportCsvModal
          onClose={() => setModal(null)}
          onApplyImport={handleApplyImport}
        />
      )}

      {modal === "addGuardian" && (
        <AddGuardianDialog
          students={students}
          onClose={() => setModal(null)}
          onSubmit={handleAddGuardian}
        />
      )}

      {modal === "addClass" && (
        <AddClassDialog onClose={() => setModal(null)} onSubmit={handleAddClass} />
      )}

      {modal === "addSubject" && (
        <AddSubjectDialog onClose={() => setModal(null)} onSubmit={handleAddSubject} />
      )}

      {modal === "inviteStaff" && (
        <InviteStaffDialog onClose={() => setModal(null)} onSubmit={handleInviteStaff} error={invitationError} />
      )}

      {selectedStudent && (
        <StudentDetailDrawer
          student={selectedStudent}
          guardians={guardians.filter((g) => g.studentId === selectedStudent.id)}
          alerts={needToKnowAlerts.filter((a) => a.isActive && (a.studentId === selectedStudent.id || a.studentName.toLowerCase() === `${selectedStudent.firstName} ${selectedStudent.lastName}`.toLowerCase()))}
          courtOrders={courtRestrictions.filter((c) => c.isEnforced && (c.studentId === selectedStudent.id || c.studentName.toLowerCase() === `${selectedStudent.firstName} ${selectedStudent.lastName}`.toLowerCase()))}
          onClose={() => setSelectedStudent(null)}
          onToggleStatus={() => handleToggleStatus(selectedStudent.id)}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODULE: Phase 2 Attendance Manager
// -------------------------------------------------------------

function AttendanceManagerModule({
  records, metrics, sessionStatus, selectedClassId, setSelectedClassId,
  classes, corrections, smsLedger, persona,
  onMarkAllPresent, onSetStatus, onSubmitSession, onOpenCorrectionModal,
  onDispatchSms, onExportCsv,
}: {
  records: AttendanceSheetRecord[];
  metrics: ReturnType<typeof calculateAttendanceMetrics>;
  sessionStatus: "in_progress" | "submitted";
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  classes: ClassRecord[];
  corrections: DiscrepancyCorrectionRecord[];
  smsLedger: SmsDispatchResult[];
  persona: Persona;
  onMarkAllPresent: () => void;
  onSetStatus: (studentId: string, status: AttendanceStatus, lateMin?: number, reason?: string) => void;
  onSubmitSession: () => void;
  onOpenCorrectionModal: (rec: AttendanceSheetRecord) => void;
  onDispatchSms: () => void;
  onExportCsv: () => void;
}) {
  const [tab, setTab] = useState<"rollCall" | "discrepancies" | "sms" | "reports">("rollCall");

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Administration</span>
            <CaretRight size={11} />
            <span className="text-slate-700">Attendance & Guardian Operations</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Operational Attendance</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Rapid teacher roll-call entry, audit-tracked discrepancy corrections, and automated absence alerts.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onExportCsv}>
            <DownloadSimple size={16} />Export CSV Report
          </Button>
          {persona !== "guardian" && (
            <Button onClick={onDispatchSms}>
              <DeviceMobile size={16} />Send Absence SMS Alerts
            </Button>
          )}
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Daily Attendance Rate" value={`${metrics.attendanceRate}%`} detail="Target >= 95%" />
        <MetricCard label="Present" value={String(metrics.present)} detail="On time" />
        <MetricCard label="Late / Tardy" value={String(metrics.late)} detail="Average delay: 15 min" />
        <MetricCard label="Excused Absences" value={String(metrics.excused)} detail="Documented notes" />
        <MetricCard label="Unexcused Absences" value={String(metrics.absent)} detail="SMS notices triggered" last />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab("rollCall")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "rollCall" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Daily Roll Call ({records.length})
        </button>
        <button
          onClick={() => setTab("discrepancies")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "discrepancies" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Discrepancy Corrections ({corrections.length})
        </button>
        <button
          onClick={() => setTab("sms")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "sms" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Absence Alerts & SMS Ledger ({smsLedger.length})
        </button>
        <button
          onClick={() => setTab("reports")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "reports" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Attendance Analytics & Chronic Watch
        </button>
      </div>

      {/* Sub-View: Roll Call */}
      {tab === "rollCall" && (
        <section className="border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <span>Class:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="h-8 border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>Class {c.name} ({c.grade})</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CalendarBlank size={15} />
                <span>Tuesday, 22 Sep 2026</span>
              </div>

              <Badge tone={sessionStatus === "submitted" ? "green" : "amber"}>
                {sessionStatus === "submitted" ? "Session Submitted" : "In Progress"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onMarkAllPresent}>
                <UserCheck size={14} />Mark All Present
              </Button>
              <Button size="sm" onClick={onSubmitSession}>
                <CheckCircle size={14} weight="bold" />Submit Morning Roll Call
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 font-bold">Student Name</th>
                  <th className="px-4 font-bold">Student ID</th>
                  <th className="px-4 font-bold">Attendance Status</th>
                  <th className="px-4 font-bold">Arrival / Excuse Detail</th>
                  <th className="px-4 font-bold">Primary Guardian</th>
                  <th className="w-16 px-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.studentId} className="h-14 border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                    <td className="px-4">
                      <span className="font-semibold text-xs text-slate-900">{r.studentName}</span>
                    </td>
                    <td className="px-4 font-mono text-xs text-slate-600">{r.studentNumber}</td>
                    <td className="px-4">
                      {/* Segmented Status Selector */}
                      <div className="inline-flex border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "present")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "present" ? "bg-green-700 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "absent")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "absent" ? "bg-red-700 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "late")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "late" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "excused")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "excused" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          E
                        </button>
                      </div>
                    </td>
                    <td className="px-4 text-xs">
                      {r.status === "late" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Late:</span>
                          <input
                            type="number"
                            defaultValue={r.arrivalMinutesLate || 10}
                            onChange={(e) => onSetStatus(r.studentId, "late", Number(e.target.value))}
                            className="h-7 w-16 border border-slate-300 px-2 font-mono"
                          />
                          <span className="text-slate-500 text-[11px]">min</span>
                        </div>
                      )}
                      {(r.status === "excused" || r.status === "absent") && (
                        <input
                          placeholder="Reason / note…"
                          defaultValue={r.reason || ""}
                          onBlur={(e) => onSetStatus(r.studentId, r.status, undefined, e.target.value)}
                          className="h-7 w-full max-w-xs border border-slate-300 px-2 text-xs"
                        />
                      )}
                      {r.status === "present" && <span className="text-slate-400 italic">On time</span>}
                    </td>
                    <td className="px-4 text-xs text-slate-600">
                      <span>{r.guardianName}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{r.guardianPhone}</span>
                    </td>
                    <td className="px-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenCorrectionModal(r)}
                        title="Correct record with audit note"
                      >
                        Correct
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sub-View: Discrepancy Corrections */}
      {tab === "discrepancies" && (
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Audit-Tracked Discrepancy Log</h2>
              <p className="mt-0.5 text-xs text-slate-500">Immutable correction record with mandatory justification reasons.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 font-bold">Date</th>
                  <th className="px-4 font-bold">Student</th>
                  <th className="px-4 font-bold">Class</th>
                  <th className="px-4 font-bold">State Transition</th>
                  <th className="px-4 font-bold">Audit Justification</th>
                  <th className="px-4 font-bold">Corrected By</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((corr) => (
                  <tr key={corr.id} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 font-mono text-xs text-slate-500">{corr.date}</td>
                    <td className="px-4 font-semibold text-xs text-slate-900">{corr.studentName}</td>
                    <td className="px-4 text-xs font-bold text-blue-700">{corr.className}</td>
                    <td className="px-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="line-through text-red-600 uppercase font-bold">{corr.previousStatus}</span>
                        <span>→</span>
                        <span className="text-green-700 uppercase font-bold">{corr.newStatus}</span>
                      </div>
                    </td>
                    <td className="px-4 text-xs text-slate-700 max-w-sm">
                      <span className="italic font-medium">&ldquo;{corr.reason}&rdquo;</span>
                    </td>
                    <td className="px-4 text-xs text-slate-600">
                      <div>{corr.correctedBy}</div>
                      <span className="text-[10px] text-slate-400">{corr.correctedAt}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sub-View: SMS Alerts Ledger */}
      {tab === "sms" && (
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
            <div>
              <div className="flex items-center gap-2">
                <DeviceMobile size={18} className="text-blue-700" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Live SMS Dispatch Ledger</h2>
              </div>
              <p className="mt-0.5 text-xs text-slate-500">Automated carrier dispatch targeting primary guardians with legal custody.</p>
            </div>
            <Badge tone="blue">Provider: Mock Active (Twilio / AWS SNS Ready)</Badge>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 font-bold">Recipient</th>
                  <th className="px-4 font-bold">Phone Number</th>
                  <th className="px-4 font-bold">Affected Student</th>
                  <th className="px-4 font-bold">Message Content</th>
                  <th className="px-4 font-bold">Carrier Ref</th>
                  <th className="px-4 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {smsLedger.map((sms) => (
                  <tr key={sms.id} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 font-semibold text-xs text-slate-900">{sms.recipientName}</td>
                    <td className="px-4 font-mono text-xs text-slate-600">{sms.recipientPhone}</td>
                    <td className="px-4 text-xs text-slate-800">{sms.studentName}</td>
                    <td className="px-4 text-[11px] text-slate-600 max-w-xs truncate">{sms.message}</td>
                    <td className="px-4 font-mono text-[10px] text-slate-400">{sms.providerRef}</td>
                    <td className="px-4"><Badge tone="green">{sms.status}</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sub-View: Reports & Chronic Absenteeism */}
      {tab === "reports" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Class Attendance Distribution</h2>
            <div className="space-y-3 text-xs">
              <ClassRateBar name="Class 7B" rate={96.4} count="27 / 28 present" />
              <ClassRateBar name="Class 7A" rate={95.0} count="25 / 27 present" />
              <ClassRateBar name="Class 6B" rate={94.2} count="24 / 25 present" />
              <ClassRateBar name="Class 8C" rate={93.8} count="27 / 29 present" />
              <ClassRateBar name="Class 6A" rate={88.0} count="23 / 26 present (High Absences)" alert />
              <ClassRateBar name="Class 5A" rate={92.5} count="22 / 24 present" />
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <WarningCircle size={18} className="text-amber-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Chronic Absenteeism Watchlist</h2>
            </div>
            <p className="text-xs text-slate-500">Students with attendance rate below 90% (&gt;= 10% absent days).</p>
            <div className="space-y-2">
              <div className="border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Elias Martin (ST-2026-0126)</span>
                  <Badge tone="amber">87.5% Rate</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Class 5A · 3 unexcused absences in past 20 days. Primary guardian notified.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function ClassRateBar({ name, rate, count, alert }: { name: string; rate: number; count: string; alert?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-slate-800">{name}</span>
        <span className={cn("font-mono font-bold", alert ? "text-amber-700" : "text-slate-700")}>{rate}% ({count})</span>
      </div>
      <div className="h-2 w-full bg-slate-100">
        <div className={cn("h-full", alert ? "bg-amber-600" : "bg-blue-700")} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

// -------------------------------------------------------------
// GUARDIAN PORTAL VIEW
// -------------------------------------------------------------

function GuardianPortalView({
  onSubmitExcuse,
  reportCards,
  onViewReportCard,
  announcements,
  consents,
  onUpdateConsent,
}: {
  onSubmitExcuse: () => void;
  reportCards: OfficialReportCardData[];
  onViewReportCard: (rc: OfficialReportCardData) => void;
  announcements: AnnouncementRecord[];
  consents: GuardianConsentRecord[];
  onUpdateConsent: (input: GuardianConsentInput) => Promise<{ success: boolean; error?: string }>;
}) {
  const [tab, setTab] = useState<"attendance" | "academics" | "notices">("attendance");
  const [consentFeedback, setConsentFeedback] = useState<string | null>(null);
  const [isUpdatingConsent, startConsentTransition] = useTransition();

  const ameliaReportCards = reportCards.filter((rc) => rc.studentId === "ST-2026-0142" && rc.status === "published");
  const davidConsent = consents.find((c) => c.guardianId === "grd-001") ?? consents[0];

  function handleToggleConsentField(field: "announcements" | "attendance" | "emergency") {
    if (!davidConsent) return;
    startConsentTransition(async () => {
      const res = await onUpdateConsent({
        guardianId: davidConsent.guardianId,
        phone: davidConsent.phone,
        optInSmsAnnouncements: field === "announcements" ? !davidConsent.optInSmsAnnouncements : davidConsent.optInSmsAnnouncements,
        optInSmsAttendance: field === "attendance" ? !davidConsent.optInSmsAttendance : davidConsent.optInSmsAttendance,
        optInSmsEmergency: field === "emergency" ? !davidConsent.optInSmsEmergency : davidConsent.optInSmsEmergency,
        optOutReason: davidConsent.optOutReason ?? undefined,
      });
      if (res.success) {
        setConsentFeedback("Communication preferences updated.");
        setTimeout(() => setConsentFeedback(null), 3000);
      }
    });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
        <div>
          <span className="text-xs font-semibold text-blue-700 uppercase tracking-wider">Guardian Self-Service Portal</span>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">David Warren · Student Records</h1>
          <p className="mt-0.5 text-xs text-slate-500">Verified Parent with Legal Custody & Emergency Contact</p>
        </div>
        {tab === "attendance" && (
          <Button onClick={onSubmitExcuse}>
            <ChatTeardropText size={16} />Submit Absence Excuse Note
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs">
        <button
          onClick={() => setTab("attendance")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "attendance" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950",
          )}
        >
          <CalendarCheck size={16} />
          Daily Attendance & Excuses
        </button>
        <button
          onClick={() => setTab("academics")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "academics" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950",
          )}
        >
          <FileText size={16} />
          Academic Performance & Report Cards
        </button>
        <button
          onClick={() => setTab("notices")}
          className={cn(
            "flex items-center gap-2 border-b-2 px-3 py-2 font-semibold transition-colors",
            tab === "notices" ? "border-blue-600 text-blue-700" : "border-transparent text-slate-600 hover:text-slate-950",
          )}
        >
          <Megaphone size={16} />
          School Notices & Consents
        </button>
      </div>

      {tab === "attendance" && (
        <div className="border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center bg-blue-950 text-sm font-bold text-blue-300">
                AW
              </span>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Amelia Warren</h2>
                <p className="text-xs text-slate-500">Student ID: ST-2026-0142 · Grade 7 (Class 7B)</p>
              </div>
            </div>
            <Badge tone="green">Present Today (08:42 AM)</Badge>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-slate-100 pt-4">
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Attendance Rate</span><p className="text-xl font-bold text-slate-900">97.8%</p></div>
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Days Enrolled</span><p className="text-xl font-bold text-slate-900">45</p></div>
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Excused Days</span><p className="text-xl font-bold text-slate-900">1</p></div>
            <div><span className="text-[10px] font-bold uppercase text-slate-400">Unexcused</span><p className="text-xl font-bold text-green-700">0</p></div>
          </div>

          {/* History */}
          <div className="border-t border-slate-100 pt-4 space-y-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">Recent Attendance History</h3>
            <div className="divide-y divide-slate-100 text-xs">
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Tuesday, 22 Sep 2026</span><span className="block text-[11px] text-slate-500">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Monday, 21 Sep 2026</span><span className="block text-[11px] text-slate-500">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Friday, 18 Sep 2026</span><span className="block text-[11px] text-slate-500">Morning Roll Call</span></div>
                <Badge tone="green">Present</Badge>
              </div>
              <div className="py-2 flex items-center justify-between">
                <div><span className="font-semibold text-slate-800">Thursday, 17 Sep 2026</span><span className="block text-[11px] text-slate-500">Medical Examination</span></div>
                <Badge tone="blue">Excused (Doctor Note)</Badge>
              </div>
            </div>
          </div>
        </div>
      )}

      {tab === "academics" && (
        <div className="space-y-6">
          {/* Overview Banner */}
          <div className="border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center bg-blue-950 text-sm font-bold text-blue-300">
                  AW
                </span>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Amelia Warren · Academic Standing</h2>
                  <p className="text-xs text-slate-500">Term 1 (Fall 2026) · Grade 7 (Class 7B)</p>
                </div>
              </div>
              <Badge tone="green">Distinguished Honor Roll</Badge>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 border-t border-slate-100 pt-4">
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Cumulative Term GPA</span>
                <p className="text-2xl font-black text-slate-950">3.85 <span className="text-xs font-normal text-slate-500">/ 4.00</span></p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Overall Weighted Mark</span>
                <p className="text-2xl font-black text-blue-700">93.8%</p>
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-slate-400">Published Evaluations</span>
                <p className="text-2xl font-black text-slate-900">6 Subjects</p>
              </div>
            </div>
          </div>

          {/* Official Report Cards */}
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Official Published Report Cards
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Authorized transcripts signed by faculty and the head of school.
                </p>
              </div>
              <Badge tone="blue">Registrar Approved</Badge>
            </div>

            <div className="divide-y divide-slate-100 p-4 space-y-3">
              {ameliaReportCards.map((rc) => (
                <div key={rc.reportCardId} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border border-slate-200 bg-slate-50 p-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm">{rc.termName} Official Report Card</span>
                      <span className="font-mono text-xs text-blue-700 font-bold bg-blue-50 px-1.5 py-0.2 border border-blue-200">v{rc.version}.0</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Term GPA: <strong>{rc.gpa.toFixed(2)}</strong> · Overall Mark: <strong>{rc.overallPercentage.toFixed(1)}%</strong> · Attendance: <strong>{rc.attendance.attendanceRate}%</strong>
                    </p>
                    <span className="text-[10px] text-slate-400">Published on {rc.publishedAt} · Office of Academic Records</span>
                  </div>
                  <Button onClick={() => onViewReportCard(rc)} className="gap-1.5">
                    <FileText size={15} />
                    View & Print Official Report Card
                  </Button>
                </div>
              ))}
            </div>
          </section>

          {/* Published Subject Breakdown */}
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Course Performance & Faculty Feedback
              </h2>
            </div>
            <div className="divide-y divide-slate-100">
              {ameliaReportCards[0]?.subjects.map((sub) => (
                <div key={sub.subjectCode} className="p-4 space-y-2 hover:bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-bold text-slate-900 text-sm">{sub.subjectName}</span>
                      <span className="text-xs text-slate-500 ml-2 font-mono">({sub.subjectCode}) · Faculty: {sub.teacherName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-sm">{sub.scorePercentage.toFixed(1)}%</span>
                      <span className="px-2 py-0.5 border border-slate-300 bg-slate-100 font-bold text-slate-900 text-xs">
                        Grade {sub.letterGrade}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 border-l-2 border-blue-600">
                    &ldquo;{sub.teacherComments}&rdquo;
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {tab === "notices" && (
        <div className="space-y-6">
          {consentFeedback && (
            <div className="border border-emerald-300 bg-emerald-50 p-3 text-xs text-emerald-900 animate-in fade-in">
              {consentFeedback}
            </div>
          )}

          {/* Official Notices */}
          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between bg-slate-50">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  School Circulars & Safety Broadcasts
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Official notices issued to guardians of Northfield Academy.
                </p>
              </div>
              <Badge tone="blue">Verified Guardian Recipient</Badge>
            </div>

            <div className="divide-y divide-slate-100">
              {announcements
                .filter((a) => a.status === "published")
                .map((ann) => (
                  <div
                    key={ann.id}
                    className={cn(
                      "p-4 space-y-2",
                      ann.priority === "emergency" ? "bg-red-50/40 border-l-4 border-red-600" : "hover:bg-slate-50/50",
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {ann.priority === "emergency" ? (
                          <span className="border border-red-300 bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-900 uppercase tracking-wider">
                            CRITICAL EMERGENCY
                          </span>
                        ) : ann.priority === "urgent" ? (
                          <span className="border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase">
                            URGENT
                          </span>
                        ) : (
                          <span className="border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-700 uppercase">
                            CIRCULAR
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-slate-500">
                          {ann.channels === "both" ? "PORTAL + SMS" : ann.channels === "sms" ? "SMS ONLY" : "PORTAL ONLY"}
                        </span>
                      </div>
                      <span className="font-mono text-[11px] text-slate-500">
                        {new Date(ann.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900">{ann.title}</h3>
                    <p className="text-xs text-slate-700 leading-relaxed">{ann.content}</p>

                    <div className="text-[11px] text-slate-400">
                      Dispatched by: <strong className="text-slate-600">{ann.authorName ?? "Northfield Academy"}</strong>
                    </div>
                  </div>
                ))}
            </div>
          </section>

          {/* SMS Consent Preferences */}
          {davidConsent && (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 bg-slate-50">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                  Mobile SMS Communications & TCPA Consent Preferences
                </h2>
                <p className="mt-0.5 text-xs text-slate-500">
                  Manage which categories of school communications are dispatched to your registered mobile phone.
                </p>
              </div>

              <div className="p-4 space-y-4 text-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <span className="font-semibold text-slate-900">Registered Destination Mobile</span>
                    <p className="text-[11px] text-slate-500">Primary phone on file with the registrar office.</p>
                  </div>
                  <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-1 border border-slate-200">
                    {davidConsent.phone}
                  </span>
                </div>

                <div className="divide-y divide-slate-100">
                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">General School Announcements & Circulars</span>
                      <p className="text-[11px] text-slate-500">Receive SMS for term schedules, events, and school notices.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isUpdatingConsent}
                      onClick={() => handleToggleConsentField("announcements")}
                      className={cn(
                        "h-7 rounded-none text-xs font-bold",
                        davidConsent.optInSmsAnnouncements
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {davidConsent.optInSmsAnnouncements ? "OPTED IN" : "OPTED OUT"}
                    </Button>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Attendance & Period Absence Alerts</span>
                      <p className="text-[11px] text-slate-500">Instant SMS alert if Amelia is marked absent during morning roll call.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isUpdatingConsent}
                      onClick={() => handleToggleConsentField("attendance")}
                      className={cn(
                        "h-7 rounded-none text-xs font-bold",
                        davidConsent.optInSmsAttendance
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-slate-300 bg-slate-100 text-slate-600 hover:bg-slate-200",
                      )}
                    >
                      {davidConsent.optInSmsAttendance ? "OPTED IN" : "OPTED OUT"}
                    </Button>
                  </div>

                  <div className="py-3 flex items-center justify-between">
                    <div>
                      <span className="font-semibold text-slate-900">Emergency & Campus Safety Alerts</span>
                      <p className="text-[11px] text-slate-500">High-priority SMS alerts for weather closures, crisis protocols, and evacuations.</p>
                    </div>
                    <Button
                      size="sm"
                      variant="secondary"
                      disabled={isUpdatingConsent}
                      onClick={() => handleToggleConsentField("emergency")}
                      className={cn(
                        "h-7 rounded-none text-xs font-bold",
                        davidConsent.optInSmsEmergency
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                          : "border-red-300 bg-red-50 text-red-800 hover:bg-red-100",
                      )}
                    >
                      {davidConsent.optInSmsEmergency ? "OPTED IN" : "BLOCKED"}
                    </Button>
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODALS
// -------------------------------------------------------------

function CorrectAttendanceDialog({
  record, onClose, onSubmit,
}: {
  record: AttendanceSheetRecord;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogFrame title="Correct Attendance Record" description="Office staff discrepancy correction with mandatory audit justification." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-4 text-xs">
          <div className="border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between font-bold">
              <span>{record.studentName} ({record.studentNumber})</span>
              <span className="uppercase text-slate-500">Current: {record.status}</span>
            </div>
            <span className="text-slate-500 mt-1 block">Class {record.className} · Session Date: 2026-09-22</span>
          </div>

          <label className="block">
            <span className="mb-1 block font-semibold">New Corrected Status</span>
            <select name="newStatus" className="h-9 w-full border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none">
              <option value="excused">Excused (Medical, Family, or School Authorized)</option>
              <option value="present">Present (Verified in Class / Late Arrival)</option>
              <option value="late">Late (Tardy Arrival)</option>
              <option value="absent">Absent (Unexcused)</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block font-semibold">Mandatory Audit Justification Reason</span>
            <textarea
              required
              name="reason"
              minLength={3}
              rows={3}
              autoFocus
              className="w-full border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Parent phoned office at 09:15 to report medical appointment; doctor note verified."
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Commit Correction</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function SubmitExcuseDialog({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogFrame title="Submit Absence Excuse Note" description="Directly inform the school office of an upcoming or past absence." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-4 text-xs">
          <label className="block">
            <span className="mb-1 block font-semibold">Absence Date</span>
            <input required type="date" name="dateStr" defaultValue="2026-09-22" className="h-9 w-full border border-slate-300 px-3 focus:border-blue-600 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Reason for Absence</span>
            <textarea
              required
              name="reason"
              rows={3}
              autoFocus
              className="w-full border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Dental appointment scheduled at 10:00 AM."
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Submit Note to Office</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

// -------------------------------------------------------------
// EXISTING PHASE 1 MODULES (RE-EXPORTED FOR CONSISTENCY)
// -------------------------------------------------------------

function OverviewModule({
  studentsCount, guardiansCount, classesCount, attendanceRate, recentAudit, onNavigate, onAddStudent, onImportCsv, onInviteStaff,
}: {
  studentsCount: number;
  guardiansCount: number;
  classesCount: number;
  attendanceRate: number;
  recentAudit: AuditRecordItem[];
  onNavigate: (mod: NavModule) => void;
  onAddStudent: () => void;
  onImportCsv: () => void;
  onInviteStaff: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Institutional Overview</h1>
          <p className="mt-1 text-[13px] text-slate-500">Northfield Academy administrative system of record & operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onImportCsv}><UploadSimple size={16} />Import Roster</Button>
          <Button onClick={onAddStudent}><Plus size={16} weight="bold" />Add Student</Button>
        </div>
      </div>

      <div className="grid border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Students" value={String(studentsCount)} detail="Enrolled in school" />
        <MetricCard label="Today's Attendance Rate" value={`${attendanceRate}%`} detail="Phase 2 Operational" />
        <MetricCard label="Linked Guardians" value={String(guardiansCount)} detail="Verified contacts" />
        <MetricCard label="Active Classes" value={String(classesCount)} detail="Assigned homerooms" last />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Phase 2 Operational Checklist</h2>
            <div className="mt-4 space-y-3">
              <CheckItem title="Teacher Roll Call & Class Assignments" desc="Rapid morning entry, segmented P/A/L/E, minutes late counter" done />
              <CheckItem title="Audit-Tracked Discrepancy Corrections" desc="Mandatory justification reason, before/after transition logs" done />
              <CheckItem title="Automated Absence Alerts & SMS" desc="Targeted carrier dispatches to primary guardians with custody" done />
              <CheckItem title="Guardian Portal & Excuse Workflow" desc="Direct guardian attendance status and note submission" done />
              <CheckItem title="In-App Notification Center" desc="Real-time unread alert badge and event notifications" done />
              <CheckItem title="Attendance Analytics & Reports" desc="Daily rates, chronic absence detection, and CSV exports" done />
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Administrative Shortcuts</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onNavigate("Attendance")}
                className="flex flex-col items-start p-3 border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <CalendarCheck size={22} className="text-blue-700" />
                <span className="mt-2 font-semibold text-xs text-slate-900">Daily Attendance</span>
                <span className="text-[11px] text-slate-500">Roll call & corrections</span>
              </button>
              <button
                onClick={() => onNavigate("Students")}
                className="flex flex-col items-start p-3 border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <Student size={22} className="text-blue-700" />
                <span className="mt-2 font-semibold text-xs text-slate-900">Student Directory</span>
                <span className="text-[11px] text-slate-500">Official student profiles</span>
              </button>
              <button
                onClick={onInviteStaff}
                className="flex flex-col items-start p-3 border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <UserPlus size={22} className="text-blue-700" />
                <span className="mt-2 font-semibold text-xs text-slate-900">Invite Staff</span>
                <span className="text-[11px] text-slate-500">Issue secure staff tokens</span>
              </button>
            </div>
          </section>
        </div>

        <section className="border border-slate-200 bg-white flex flex-col">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-2">
              <ClockCounterClockwise size={17} className="text-blue-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Recent System Audits</h2>
            </div>
            <button onClick={() => onNavigate("Audit log")} className="text-xs font-semibold text-blue-700 hover:underline">
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100 p-2 flex-1">
            {recentAudit.map((item) => (
              <div key={item.id} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{item.action}</span>
                  <span className="text-[11px] text-slate-400">{item.createdAt}</span>
                </div>
                <div className="mt-1 text-slate-600">
                  <span className="text-slate-500">By {item.actorUserId} · </span>
                  <span className="font-mono text-[11px]">{item.entityId}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function StudentDirectoryModule({
  students, total, query, setQuery, gradeFilter, setGradeFilter, statusFilter, setStatusFilter,
  needToKnowAlerts = [], courtRestrictions = [],
  onAdd, onImport, onSelectStudent,
}: {
  students: StudentRecord[];
  total: number;
  query: string;
  setQuery: (val: string) => void;
  gradeFilter: string;
  setGradeFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  needToKnowAlerts?: NeedToKnowAlertRecord[];
  courtRestrictions?: CourtRestrictionRecord[];
  onAdd: () => void;
  onImport: () => void;
  onSelectStudent: (st: StudentRecord) => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="mt-1 text-[13px] text-slate-500">Official student records, guardians, and enrollments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onImport}><UploadSimple size={16} />Import CSV</Button>
          <Button onClick={onAdd}><Plus size={16} weight="bold" />Add Student</Button>
        </div>
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full border border-slate-300 pl-9 pr-3 text-[13px] focus:border-blue-600 focus:outline-none"
              placeholder="Search name, ID…"
            />
          </div>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="h-9 border border-slate-300 bg-white px-3 text-[13px]">
            <option>All grades</option>
            <option>Grade 5</option>
            <option>Grade 6</option>
            <option>Grade 7</option>
            <option>Grade 8</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 border border-slate-300 bg-white px-3 text-[13px]">
            <option>All statuses</option>
            <option>Active</option>
            <option>Pending</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 font-bold">Student</th>
                <th className="px-3 font-bold">ID</th>
                <th className="px-3 font-bold">DOB</th>
                <th className="px-3 font-bold">Placement</th>
                <th className="px-3 font-bold">Guardians</th>
                <th className="px-3 font-bold">Status</th>
                <th className="w-12 px-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const hasCourt = courtRestrictions.some((c) => c.isEnforced && (c.studentId === st.id || c.studentName.toLowerCase() === `${st.firstName} ${st.lastName}`.toLowerCase()));
                const activeAlert = needToKnowAlerts.find((a) => a.isActive && (a.studentId === st.id || a.studentName.toLowerCase() === `${st.firstName} ${st.lastName}`.toLowerCase()));

                return (
                  <tr key={st.id} onClick={() => onSelectStudent(st)} className="h-14 cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center bg-slate-100 text-[11px] font-bold text-slate-700">{st.initials}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900">{st.firstName} {st.lastName}</span>
                            {hasCourt && (
                              <span className="flex items-center gap-0.5 rounded-xs border border-rose-300 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-800">
                                <Gavel size={10} weight="bold" />
                                COURT ORDER
                              </span>
                            )}
                            {activeAlert && (
                              <span className="flex items-center gap-0.5 rounded-xs border border-amber-300 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                                <ShieldWarning size={10} weight="bold" />
                                {activeAlert.category.toUpperCase()} ALERT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  <td className="px-3 font-mono text-xs text-slate-600">{st.id}</td>
                  <td className="px-3 text-xs font-mono text-slate-600">{st.dateOfBirth}</td>
                  <td className="px-3 text-xs">{st.grade} ({st.className})</td>
                  <td className="px-3 text-xs text-slate-600">{st.guardians} linked</td>
                  <td className="px-3"><Badge tone={st.status === "Active" ? "green" : "amber"}>{st.status}</Badge></td>
                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onSelectStudent(st)} className="p-1 hover:bg-slate-100 text-slate-500">
                      <DotsThree size={18} weight="bold" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          Showing {students.length} of {total} records
        </div>
      </section>
    </div>
  );
}

function GuardianDirectoryModule({
  guardians, onAddGuardian,
}: {
  guardians: GuardianRecord[];
  onAddGuardian: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guardian Directory</h1>
          <p className="mt-1 text-[13px] text-slate-500">Verified student contacts and communications channels.</p>
        </div>
        <Button onClick={onAddGuardian}><Plus size={16} weight="bold" />Link Guardian</Button>
      </div>

      <section className="border border-slate-200 bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="px-4 font-bold">Guardian Name</th>
              <th className="px-4 font-bold">Linked Student</th>
              <th className="px-4 font-bold">Relationship</th>
              <th className="px-4 font-bold">Email</th>
              <th className="px-4 font-bold">Phone</th>
              <th className="px-4 font-bold">Custody / Legal</th>
            </tr>
          </thead>
          <tbody>
            {guardians.map((g) => (
              <tr key={g.id} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 font-semibold text-xs text-slate-900">{g.firstName} {g.lastName}</td>
                <td className="px-4 text-xs font-semibold text-slate-800">{g.studentName}</td>
                <td className="px-4 text-xs text-slate-700">{g.relationship}</td>
                <td className="px-4 text-xs font-mono text-slate-600">{g.email}</td>
                <td className="px-4 text-xs font-mono text-slate-600">{g.phone}</td>
                <td className="px-4"><Badge tone={g.hasLegalResponsibility ? "blue" : "slate"}>{g.hasLegalResponsibility ? "Legal Responsibility" : "Emergency Only"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AcademicSetupModule({
  classes, subjects, onAddClass, onAddSubject,
}: {
  classes: ClassRecord[];
  subjects: SubjectRecord[];
  onAddClass: () => void;
  onAddSubject: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes & Academic Setup</h1>
          <p className="mt-1 text-[13px] text-slate-500">Classes, grade levels, and curriculum catalog.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onAddClass}><Plus size={16} />Add Class</Button>
          <Button onClick={onAddSubject}><Plus size={16} />Add Subject</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => (
          <div key={cls.id} className="border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">Class {cls.name}</span>
              <Badge tone="blue">{cls.grade}</Badge>
            </div>
            <div className="mt-2 text-xs text-slate-600">Homeroom: <span className="font-semibold text-slate-800">{cls.homeroomTeacher}</span></div>
          </div>
        ))}
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">Subject Curriculum Catalog</div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Subject Name</th>
              <th className="px-4 py-2">Department</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj) => (
              <tr key={subj.id} className="h-10 border-b border-slate-100 text-xs hover:bg-slate-50/50">
                <td className="px-4 font-mono font-bold text-slate-800">{subj.code}</td>
                <td className="px-4 font-medium text-slate-900">{subj.name}</td>
                <td className="px-4 text-slate-600">{subj.department}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function ImportWorkspaceModule({
  importJobs, onOpenImportModal,
}: {
  importJobs: ImportJobRecord[];
  onOpenImportModal: () => void;
}) {
  function handleDownloadTemplate() {
    const template = generateStudentCsvTemplate();
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "klassa_student_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">CSV Ingestion Engine</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownloadTemplate}><DownloadSimple size={16} />Template</Button>
          <Button onClick={onOpenImportModal}><UploadSimple size={16} />New Import</Button>
        </div>
      </div>
      <section className="border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
              <th className="px-4 font-bold">File</th>
              <th className="px-4 font-bold">Rows</th>
              <th className="px-4 font-bold">Valid</th>
              <th className="px-4 font-bold">Status</th>
              <th className="px-4 font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {importJobs.map((j) => (
              <tr key={j.id} className="h-12 border-b border-slate-100">
                <td className="px-4 font-mono text-xs font-semibold">{j.sourceFilename}</td>
                <td className="px-4 font-mono text-xs">{j.rowCount}</td>
                <td className="px-4 font-mono text-xs text-green-700 font-bold">{j.validRowCount}</td>
                <td className="px-4"><Badge tone={j.status === "completed" ? "green" : "amber"}>{j.status}</Badge></td>
                <td className="px-4 text-xs text-slate-500">{j.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function AuditLogModule({ auditLogs }: { auditLogs: AuditRecordItem[] }) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
      <section className="border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
              <th className="px-4 font-bold">Timestamp</th>
              <th className="px-4 font-bold">Action</th>
              <th className="px-4 font-bold">Entity</th>
              <th className="px-4 font-bold">Actor</th>
              <th className="px-4 font-bold">Payload</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id} className="h-12 border-b border-slate-100">
                <td className="px-4 font-mono text-xs text-slate-500">{log.createdAt}</td>
                <td className="px-4"><Badge tone="blue">{log.action}</Badge></td>
                <td className="px-4 text-xs font-mono">{log.entityId}</td>
                <td className="px-4 text-xs">{log.actorUserId}</td>
                <td className="px-4 text-[11px] font-mono text-slate-600 truncate max-w-xs">{JSON.stringify(log.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function SettingsModule({
  staff,
  invitations,
  onInviteStaff,
  currentOrganization,
  organizations,
  onboardingChecklists,
  gdprRequests,
  restoreDrills,
  students,
  currentUserRole,
  currentUserId,
  currentUserName,
  onSwitchSchool,
  onSchoolProvisioned,
  onRequestCreated,
  onStudentAnonymized,
}: {
  staff: StaffRecord[];
  invitations: InvitationRecord[];
  onInviteStaff: () => void;
  currentOrganization: OrganizationRecord;
  organizations: OrganizationRecord[];
  onboardingChecklists: Record<string, OnboardingChecklist>;
  gdprRequests: GdprRequestRecord[];
  restoreDrills: RestoreDrillRecord[];
  students: StudentRecord[];
  currentUserRole: string;
  currentUserId: string;
  currentUserName: string;
  onSwitchSchool: (org: OrganizationRecord) => void;
  onSchoolProvisioned: (org: OrganizationRecord, checklist: OnboardingChecklist) => void;
  onRequestCreated: (req: GdprRequestRecord) => void;
  onStudentAnonymized: (stId: string, updated: { firstName: string; lastName: string; dateOfBirth: string; status: "Active" | "Pending" | "Withdrawn" }) => void;
}) {
  const [settingsTab, setSettingsTab] = useState<"staff" | "gdpr" | "tenants" | "security" | "openapi">("staff");

  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Settings & Policies</h1>
          <p className="text-xs text-slate-600">Enterprise security, multi-institution administration, and statutory regulatory compliance.</p>
        </div>
        {settingsTab === "staff" && (
          <Button onClick={onInviteStaff}><UserPlus size={16} />Invite Staff</Button>
        )}
      </div>

      {/* Sub-tab Navigation */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: "staff" as const, label: "Staff & Access Control", icon: UsersThree },
          { key: "gdpr" as const, label: "GDPR Privacy & Data Rights", icon: ShieldCheck },
          { key: "tenants" as const, label: "Multi-School Institutions", icon: Buildings },
          { key: "security" as const, label: "Security & ASVS Level 2", icon: LockKey },
          { key: "openapi" as const, label: "OpenAPI 3.1 & Developer Reference", icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = settingsTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setSettingsTab(tab.key)}
              className={cn(
                "flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer",
                isActive
                  ? "border-blue-600 text-blue-900 bg-blue-50/40"
                  : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
              )}
            >
              <Icon size={16} weight={isActive ? "bold" : "regular"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {settingsTab === "staff" && (
        <div className="space-y-6">
          <div className="border border-blue-200 bg-blue-50 p-4 flex items-center gap-3">
            <ShieldCheck size={24} className="text-blue-700 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-blue-950">Mandatory Staff MFA Active</h2>
              <p className="text-xs text-blue-800">All administrative and faculty accounts require TOTP two-factor authentication.</p>
            </div>
          </div>

          <section className="border border-slate-200 bg-white">
            <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">Staff Accounts</div>
            <table className="w-full border-collapse text-left">
              <tbody>
                {staff.map((usr) => (
                  <tr key={usr.id} className="h-12 border-b border-slate-100">
                    <td className="px-4 text-xs font-semibold">{usr.name}</td>
                    <td className="px-4 text-xs font-mono text-slate-600">{usr.email}</td>
                    <td className="px-4 text-xs">{usr.role}</td>
                    <td className="px-4"><Badge tone="green">TOTP Verified</Badge></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {invitations.length > 0 && (
            <section className="border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">Pending Staff Invitations</div>
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
                    <th className="px-4 py-2">Mobile number</th>
                    <th className="px-4 py-2">Role</th>
                    <th className="px-4 py-2">Delivery</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="h-10 border-b border-slate-100 text-xs">
                      <td className="px-4 font-medium text-slate-800">{inv.phoneNumber}</td>
                      <td className="px-4"><Badge tone="blue">{inv.role}</Badge></td>
                      <td className="px-4 font-mono text-slate-500">Not sent (demo)</td>
                      <td className="px-4"><Badge tone="amber">Simulated</Badge></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}
        </div>
      )}

      {settingsTab === "gdpr" && (
        <GdprCompliancePanel
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          requests={gdprRequests}
          students={students}
          onRequestCreated={onRequestCreated}
          onStudentAnonymized={onStudentAnonymized}
        />
      )}

      {settingsTab === "tenants" && (
        <MultiSchoolPanel
          currentOrganization={currentOrganization}
          organizations={organizations}
          checklists={onboardingChecklists}
          onSwitchSchool={onSwitchSchool}
          onSchoolProvisioned={onSchoolProvisioned}
        />
      )}

      {settingsTab === "security" && (
        <SecurityCompliancePanel
          initialDrills={restoreDrills}
          currentUserId={currentUserId}
          currentUserName={currentUserName}
        />
      )}

      {settingsTab === "openapi" && (
        <OpenApiExplorerPanel />
      )}
    </div>
  );
}

// -------------------------------------------------------------
// MODALS
// -------------------------------------------------------------

function DialogFrame({
  title, description, onClose, children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="w-full max-w-lg border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1 hover:bg-slate-100 text-slate-500"><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

function AddStudentDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Student" description="Create an official student record." onClose={onClose}>
      <form action={onSubmit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 text-xs">
          <label><span className="block mb-1 font-semibold">First Name</span><input required name="firstName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Last Name</span><input required name="lastName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <p className="self-end text-xs text-slate-500">A student number is assigned automatically.</p>
          <label><span className="block mb-1 font-semibold">DOB</span><input required type="date" name="dateOfBirth" defaultValue="2014-06-15" className="h-9 w-full border border-slate-300 px-3" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function AddGuardianDialog({
  students, onClose, onSubmit,
}: {
  students: StudentRecord[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogFrame title="Link Guardian" description="Register contact information for student." onClose={onClose}>
      <form action={onSubmit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 text-xs">
          <label><span className="block mb-1 font-semibold">First Name</span><input required name="firstName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Last Name</span><input required name="lastName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Email</span><input required type="email" name="email" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Phone</span><input required type="tel" name="phone" className="h-9 w-full border border-slate-300 px-3" placeholder="+354 555 0199" /></label>
          <label className="sm:col-span-2">
            <span className="block mb-1 font-semibold">Link to Student</span>
            <select name="studentId" className="h-9 w-full border border-slate-300 bg-white px-3">
              {students.map((s) => (<option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.id})</option>))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function AddClassDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Class" description="Create class section." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-3 text-xs">
          <label><span className="block mb-1 font-semibold">Class Name</span><input required name="name" className="h-9 w-full border border-slate-300 px-3" placeholder="e.g. 7C" /></label>
          <label><span className="block mb-1 font-semibold">Grade</span><select name="grade" className="h-9 w-full border border-slate-300 bg-white px-3"><option>Grade 5</option><option>Grade 6</option><option>Grade 7</option><option>Grade 8</option></select></label>
          <label><span className="block mb-1 font-semibold">Homeroom Teacher</span><input required name="homeroomTeacher" className="h-9 w-full border border-slate-300 px-3" placeholder="Teacher Name" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function AddSubjectDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Subject" description="Configure course subject." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-3 text-xs">
          <label><span className="block mb-1 font-semibold">Code</span><input required name="code" className="h-9 w-full border border-slate-300 px-3 uppercase" placeholder="BIO-01" /></label>
          <label><span className="block mb-1 font-semibold">Title</span><input required name="name" className="h-9 w-full border border-slate-300 px-3" placeholder="Biology" /></label>
          <label><span className="block mb-1 font-semibold">Department</span><input required name="department" className="h-9 w-full border border-slate-300 px-3" placeholder="STEM" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function InviteStaffDialog({ onClose, onSubmit, error }: { onClose: () => void; onSubmit: (formData: FormData) => void; error: string }) {
  return (
    <DialogFrame title="Invite Staff by SMS" description="Local simulation. No SMS will be sent. Real invitations are managed by the platform superuser." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-3 text-xs">
          <label><span className="block mb-1 font-semibold">Mobile number</span><input required type="tel" name="phoneNumber" className="h-9 w-full border border-slate-300 px-3" placeholder="+354 555 1234" /></label>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <label><span className="block mb-1 font-semibold">Role</span><select name="role" className="h-9 w-full border border-slate-300 bg-white px-3"><option value="office_staff">Office Staff</option><option value="school_admin">School Admin</option></select></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Send</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

function ImportCsvModal({
  onClose, onApplyImport,
}: {
  onClose: () => void;
  onApplyImport: (filename: string, csvContent: string, result: CsvValidationResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [validationResult, setValidationResult] = useState<CsvValidationResult | null>(null);

  function handleFileChange(selectedFile: File) {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      setCsvContent(text);
      const result = validateStudentCsv(text);
      setValidationResult(result);
    };
    reader.readAsText(selectedFile);
  }

  return (
    <DialogFrame title="Import Student Roster" description="Upload a UTF-8 CSV with pre-import validation." onClose={onClose}>
      <div className="p-4 space-y-3 text-xs">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-400 bg-slate-50 p-4 text-center hover:bg-blue-50/30">
          <UploadSimple size={24} className="text-blue-700" />
          <span className="mt-2 font-semibold">{file ? file.name : "Select CSV file"}</span>
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }} />
        </label>

        {validationResult && (
          <div className="border border-slate-200 p-3 bg-slate-50 text-xs">
            <span className="font-bold text-slate-800">{file?.name}</span>
            <div className="mt-1 flex gap-3 text-slate-600">
              <span>Total: <strong>{validationResult.totalRows}</strong></span>
              <span className="text-green-700">Valid: <strong>{validationResult.validCount}</strong></span>
              {validationResult.invalidCount > 0 && <span className="text-red-600">Errors: <strong>{validationResult.invalidCount}</strong></span>}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!validationResult || validationResult.validCount === 0} onClick={() => { if (validationResult && file) onApplyImport(file.name, csvContent, validationResult); }}>Commit Import</Button>
      </div>
    </DialogFrame>
  );
}

function StudentDetailDrawer({
  student, guardians, alerts = [], courtOrders = [], onClose, onToggleStatus,
}: {
  student: StudentRecord;
  guardians: GuardianRecord[];
  alerts?: NeedToKnowAlertRecord[];
  courtOrders?: CourtRestrictionRecord[];
  onClose: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white border-l border-slate-300 shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center bg-slate-900 text-sm font-bold text-white">{student.initials}</span>
            <div><h2 className="text-base font-bold text-slate-900">{student.firstName} {student.lastName}</h2><span className="font-mono text-xs text-slate-500">{student.id}</span></div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {courtOrders.length > 0 && (
            <div className="rounded-xs border border-rose-300 bg-rose-50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-950 text-xs">
                <Gavel size={15} weight="bold" className="text-rose-700" />
                <span>STATUTORY COURT ORDER ENFORCED</span>
              </div>
              {courtOrders.map((co) => (
                <div key={co.id} className="text-rose-900 text-[11px] leading-relaxed">
                  <p><strong>Restricted Individual:</strong> {co.restrictedPersonName}</p>
                  <p className="mt-0.5">{co.summary}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-rose-700">Docket: {co.docketNumber} • {co.issuingCourt}</p>
                </div>
              ))}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="rounded-xs border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                <ShieldWarning size={15} weight="bold" className="text-amber-700" />
                <span>Classroom Need-to-Know Directives ({alerts.length})</span>
              </div>
              {alerts.map((al) => (
                <div key={al.id} className="border-t border-amber-200/70 pt-1.5 text-[11px] text-amber-950">
                  <div className="flex items-center justify-between font-bold">
                    <span>{al.directiveSummary}</span>
                    <span className="uppercase text-[9px] font-bold text-amber-800">{al.severity}</span>
                  </div>
                  <p className="mt-0.5 text-amber-900 leading-relaxed">{al.actionRequired}</p>
                  <span className="text-[10px] text-amber-700">Authorized by {al.authorSpecialistName}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <Badge tone={student.status === "Active" ? "green" : "amber"}>{student.status}</Badge>
            <Button variant="secondary" size="sm" onClick={onToggleStatus}>Switch to {student.status === "Active" ? "Pending" : "Active"}</Button>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Placement</span>
            <p className="mt-1 font-semibold">{student.grade} - Class {student.className}</p>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Guardians ({guardians.length})</span>
            {guardians.map((g) => (
              <div key={g.id} className="mt-2 border border-slate-200 p-2 bg-slate-50">
                <span className="font-semibold">{g.firstName} {g.lastName}</span> ({g.relationship})
                <p className="font-mono text-slate-500">{g.email} · {g.phone}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, last }: { label: string; value: string; detail: string; last?: boolean }) {
  return (
    <div className={cn("px-4 py-3", !last && "border-b border-slate-200 sm:border-b-0 sm:border-r")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="tabular-nums text-xl font-bold text-slate-900">{value}</span>
        <span className="text-[11px] text-slate-500">{detail}</span>
      </div>
    </div>
  );
}

function CheckItem({ title, desc, done }: { title: string; desc: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <CheckCircle size={16} weight={done ? "fill" : "regular"} className={cn("mt-0.5 shrink-0", done ? "text-green-700" : "text-slate-300")} />
      <div>
        <span className={cn("font-semibold", done ? "text-slate-800" : "text-slate-400")}>{title}</span>
        <p className="text-[11px] text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
