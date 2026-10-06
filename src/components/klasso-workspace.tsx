"use client";
import { getWorkspaceData, createStudentAction, updateStudentStatusAction, createGuardianAction, createClassAction, createSubjectAction, inviteStaffAction, processCsvImportAction } from "@/app/actions/roster-actions";
import { useState, useMemo, useTransition } from "react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { groupWorkspaceNavigation } from "@/components/workspace-navigation";
import { LayoutDashboard as DashboardIcon, Users as PeopleIcon, GraduationCap as ClassIcon, CalendarCheck as AttendanceIcon, BookOpen as GradebookIcon, FileText as ReportIcon, Megaphone as NoticeIcon, Archive as ImportIcon, Settings as SettingsIcon, ShieldCheck as AuditIcon } from "lucide-react";
import { type NavModule, type Persona, type StudentRecord, type GuardianRecord, type ClassRecord, type SubjectRecord, type ImportJobRecord, type StaffRecord, type InvitationRecord, type AuditRecordItem } from "@/components/demo/types";
import { initialAuditLogs, initialRollCallRecords, initialCorrections, initialAssessments, initialAssessmentCategories, initialSchemes, initialGradebookStudents, initialGradeCorrections, initialReportCards } from "@/components/demo/fixtures";
import { type InAppNotification, getInAppNotifications, addInAppNotification, markAllNotificationsAsRead } from "@/lib/notifications";
import { type AttendanceSheetRecord, type DiscrepancyCorrectionRecord, saveAttendanceRollCallAction, correctAttendanceRecordAction, submitGuardianExcuseAction, exportAttendanceCsvAction } from "@/app/actions/attendance-actions";
import { type AssessmentItemData, type AssessmentCategoryItem, type GradingSchemeDefinition, type GradebookStudentRow, type GradeCorrectionLogItem, saveGradebookScoreAction, correctGradeWithAuditAction, toggleAssessmentPublicationAction, createAssessmentAction, publishReportCardAction, generateTermReportCardsAction } from "@/app/actions/assessment-actions";
import { type OfficialReportCardData, scoreToGrade, type AssessmentInput } from "@/lib/assessments";
import { type AnnouncementRecord, INITIAL_ANNOUNCEMENTS, type CommunicationTemplateItem, DEFAULT_COMMUNICATION_TEMPLATES, type GuardianConsentRecord, INITIAL_GUARDIAN_CONSENTS, type SmsDeliveryItem, INITIAL_SMS_DELIVERY_LOGS, type AnnouncementInput, type GuardianConsentInput } from "@/lib/communications";
import { type NeedToKnowAlertRecord, INITIAL_NEED_TO_KNOW_ALERTS, type CourtRestrictionRecord, INITIAL_COURT_RESTRICTIONS, type KlassoRole } from "@/lib/sensitive-records";
import { type OrganizationRecord, INITIAL_ORGANIZATIONS, type OnboardingChecklist, INITIAL_ONBOARDING_CHECKLISTS } from "@/lib/tenant-admin";
import { type GdprRequestRecord, INITIAL_GDPR_REQUESTS } from "@/lib/gdpr";
import { type RestoreDrillRecord, INITIAL_RESTORE_DRILLS } from "@/lib/drills";
import { calculateAttendanceMetrics, type AttendanceStatus } from "@/lib/attendance";
import { type CsvValidationResult } from "@/lib/csv";
import { createAnnouncementAction, recordAnnouncementReadAction, updateGuardianConsentAction } from "@/app/actions/communication-actions";
import { cn } from "@/lib/utils";
import { MagnifyingGlass, Bell } from "@phosphor-icons/react";
import { GuardianPortalView } from "@/components/demo/guardian";
import { OverviewModule } from "@/components/demo/overview";
import { AttendanceManagerModule, CorrectAttendanceDialog, SubmitExcuseDialog } from "@/components/demo/attendance";
import { GradebookModule } from "@/components/assessments/gradebook-module";
import { ReportCardsModule } from "@/components/assessments/report-cards-module";
import { CommunicationsModule } from "@/components/communications/communications-module";
import { StudentDirectoryModule, GuardianDirectoryModule, AcademicSetupModule, ImportWorkspaceModule, AuditLogModule } from "@/components/demo/directories";
import { SettingsModule } from "@/components/demo/settings";
import { OfficialReportCardModal } from "@/components/assessments/official-report-card-modal";
import { CorrectGradeDialog } from "@/components/assessments/correct-grade-dialog";
import { AddAssessmentDialog } from "@/components/assessments/add-assessment-dialog";
import { AddStudentDialog, ImportCsvModal, AddGuardianDialog, AddClassDialog, AddSubjectDialog, InviteStaffDialog, StudentDetailDrawer } from "@/components/demo/dialogs";

export function KlassoWorkspace({ roster }: { roster: Awaited<ReturnType<typeof getWorkspaceData>> }) {
  const [invitationError, setInvitationError] = useState("");
  const [active, setActive] = useState<NavModule>("Overview");
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
  const [needToKnowAlerts] = useState<NeedToKnowAlertRecord[]>(INITIAL_NEED_TO_KNOW_ALERTS);
  const [courtRestrictions] = useState<CourtRestrictionRecord[]>(INITIAL_COURT_RESTRICTIONS);

  // Phase 6 Production Hardening & Multi-Tenant State
  const [organizations, setOrganizations] = useState<OrganizationRecord[]>(INITIAL_ORGANIZATIONS);
  const [onboardingChecklists, setOnboardingChecklists] = useState<Record<string, OnboardingChecklist>>(INITIAL_ONBOARDING_CHECKLISTS);
  const [currentOrganization, setCurrentOrganization] = useState<OrganizationRecord>(INITIAL_ORGANIZATIONS[0] ?? {
    id: "org-northfield",
    name: "Northfield Academy",
    slug: "northfield",
    domain: "northfield.edu.is",
    timezone: "Etc/GMT",
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
      case "teacher": return "teacher";
      case "guardian": return "guardian";
      default: return "school_admin";
    }
  }, [persona]);

  const currentSpecialistUser = useMemo(() => {
    switch (persona) {
      case "admin": return { id: "usr-admin-1", name: "Margaret Evans (Head of School)" };
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
    const matchesQuery = searchTarget.includes(query.trim().toLowerCase());
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
      setActive("Overview");
    } else if (newPersona === "teacher") {
      setActive("Overview");
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
          metadata: { phone: input.phone, announcements: input.optInSmsAnnouncements },
          createdAt: "Just now",
        },
        ...curr,
      ]);
    }
    return res;
  }

  const previewGroups = groupWorkspaceNavigation([
    { id: "overview", label: "Overview", icon: DashboardIcon, roles: ["admin", "teacher", "guardian"] },
    { id: "attendance", label: "Attendance", icon: AttendanceIcon, roles: ["admin", "teacher", "guardian"] },
    { id: "gradebook", label: "Gradebook", icon: GradebookIcon, roles: ["admin", "teacher"] },
    { id: "reports", label: "Report cards", icon: ReportIcon, roles: ["admin", "teacher"] },
    { id: "communications", label: "Communications", icon: NoticeIcon, roles: ["admin", "teacher", "guardian"] },
    { id: "students", label: "Students", icon: PeopleIcon, roles: ["admin", "teacher"] },
    { id: "guardians", label: "Guardians", icon: PeopleIcon, roles: ["admin"] },
    { id: "classes", label: "Classes", icon: ClassIcon, roles: ["admin", "teacher"] },
    { id: "imports", label: "Imports", icon: ImportIcon, roles: ["admin"] },
    { id: "settings", label: "Settings", icon: SettingsIcon, roles: ["admin"] },
    { id: "audit", label: "Audit log", icon: AuditIcon, roles: ["admin"] },
  ].filter(item => item.roles.includes(persona))).map(group => ({ ...group, items: group.items.map(item => ({ ...item, id: item.label, href: undefined })) }));

  return (
    <><WorkspaceShell schoolName={currentOrganization.name} academicYear="2026–27 Academic Year" actorName={persona === "admin" ? "Olivia Parker" : persona === "teacher" ? "Elena Rostova" : "David Warren"} roleLabel={persona === "admin" ? "School administrator · Demo" : persona === "teacher" ? "Teacher · Demo" : "Parent / Guardian · Demo"} navigationLabel="Primary navigation" groups={previewGroups} activeId={active} contentId="demo-content" onNavigate={id => setActive(id as NavModule)} accountActions={<p className="p-2 text-xs text-secondary">Synthetic demo account</p>} banner={<div role="status" className="bg-warning-subtle px-4 py-2 text-center text-xs text-warning">Local demo · Synthetic records only · Changes are temporary and shared within this preview · SMS and approvals are simulations</div>} toolbar={<>
          {/* Search */}
          <div className="relative hidden max-w-xs flex-1 md:block">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              aria-label="Search Klassa"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full border border-line bg-surface-subtle pl-9 pr-3 text-[13px] placeholder:text-muted focus:border-primary focus:bg-surface focus:outline-none"
              placeholder="Search students, records…"
            />
          </div>

          {/* Role/Persona Switcher Bar */}
          <div className="flex flex-wrap items-center gap-1 border border-line bg-surface-subtle p-1 text-xs">
            <span className="px-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">Persona:</span>
            <button
              onClick={() => handlePersonaSwitch("admin")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "admin" ? "bg-surface text-primary shadow-xs border border-line" : "text-secondary hover:text-ink")}
            >
              Admin
            </button>
            <button
              onClick={() => handlePersonaSwitch("teacher")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "teacher" ? "bg-surface text-primary shadow-xs border border-line" : "text-secondary hover:text-ink")}
            >
              Teacher
            </button>
            <button
              onClick={() => handlePersonaSwitch("guardian")}
              className={cn("px-2 py-0.5 font-semibold transition-colors", persona === "guardian" ? "bg-surface text-primary shadow-xs border border-line" : "text-secondary hover:text-ink")}
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
                className="relative flex h-9 w-9 items-center justify-center border border-line bg-surface text-secondary hover:bg-surface-subtle"
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center bg-primary text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover */}
              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 border border-line bg-surface shadow-2xl z-50 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between border-b border-line px-3 py-2.5 bg-surface-subtle">
                    <span className="text-xs font-bold uppercase tracking-wider text-ink">In-App Notification Center</span>
                    <button
                      onClick={() => {
                        markAllNotificationsAsRead();
                        setNotifications((curr) => curr.map((n) => ({ ...n, isRead: true })));
                      }}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Mark all as read
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-xs text-muted">No notifications.</p>
                    ) : (
                      notifications.map((n) => (
                        <div key={n.id} className={cn("p-3 text-xs space-y-0.5", !n.isRead && "bg-primary-subtle/40")}>
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-ink">{n.title}</span>
                            <span className="text-[10px] text-muted">{n.createdAt}</span>
                          </div>
                          <p className="text-secondary text-[11px]">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Profile Avatar */}
            <div className="flex h-9 items-center gap-2 border-l border-line pl-3">
              <span className="flex h-8 w-8 items-center justify-center bg-slate-900 text-xs font-bold text-white">
                {persona === "admin" ? "OP" : persona === "teacher" ? "ER" : "DW"}
              </span>
              <div className="hidden sm:block">
                <span className="block text-xs font-semibold">
                  {persona === "admin" ? "Olivia Parker" : persona === "teacher" ? "Elena Rostova" : "David Warren"}
                </span>
                <span className="block text-[10px] text-muted">
                  {persona === "admin" ? "School Administrator" : persona === "teacher" ? "Homeroom Teacher (7A/7B)" : "Parent / Guardian"}
                </span>
              </div>
            </div>
          </div>
</>}>

          {persona === "guardian" ? (
            <GuardianPortalView
              onSubmitExcuse={() => setModal("submitExcuse")}
              ameliaReportCards={reportCards.filter(rc => rc.studentId === "ST-2026-0142" && rc.status === "published")}
              onViewReportCard={(rc) => setSelectedReportCard(rc)}
              announcements={announcements}
              guardianConsent={(() => {
                const consent = guardianConsents.find(item => item.guardianId === "grd-001");
                return consent ? { phone: consent.phone, optInSmsAnnouncements: consent.optInSmsAnnouncements } : undefined;
              })()}
              onToggleSmsConsent={async optIn => {
                const consent = guardianConsents.find(item => item.guardianId === "grd-001");
                if (!consent) return false;
                const result = await handleUpdateGuardianConsent({ guardianId: consent.guardianId, phone: consent.phone, optInSmsAnnouncements: optIn });
                return result.success;
              }}
            />
          ) : (
            <>
              {active === "Overview" && (
                <OverviewModule
                  studentsCount={students.filter(student => student.status === "Active").length}
                  guardiansCount={guardians.length}
                  classesCount={classes.length}
                  staffCount={staff.length}
                  metrics={attendanceMetrics}
                  submitted={attendanceSessionStatus === "submitted"}
                  schoolName={currentOrganization.name}
                  persona={persona}
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
                  persona={persona === "teacher" ? "teacher" : "admin"}
                  onMarkAllPresent={handleMarkAllPresent}
                  onSetStatus={handleSetStudentAttendance}
                  onSubmitSession={handleSubmitAttendanceSession}
                  onOpenCorrectionModal={(rec) => {
                    setRecordToCorrect(rec);
                    setModal("correctRecord");
                  }}
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
                  onRecordRead={handleRecordAnnouncementRead}
                  onUpdateConsent={handleUpdateGuardianConsent}
                />
              )}

              {active === "Students" && (
                <StudentDirectoryModule
                  students={filteredStudents}
                  availableGrades={[...new Set(students.map(student => student.grade))]}
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
</WorkspaceShell>

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
    </>
  );
}
export type { NavModule, Persona } from "./demo/types";
