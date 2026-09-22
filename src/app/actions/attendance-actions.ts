"use server";

import { requireDemoAction } from "@/lib/action-access";

import { logAuditEvent } from "@/lib/audit";
import {
  type AttendanceCorrectionInput,
  type AttendanceRecordInput,
  type AttendanceStatus,
  calculateAttendanceMetrics,
  formatAttendanceCsvReport,
} from "@/lib/attendance";
import { dispatchAbsenceAlert } from "@/lib/sms";
import { addInAppNotification } from "@/lib/notifications";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

export interface AttendanceSheetRecord {
  recordId: string;
  studentId: string;
  studentNumber: string;
  studentName: string;
  className: string;
  status: AttendanceStatus;
  arrivalMinutesLate: number;
  reason?: string;
  remarks?: string;
  guardianName: string;
  guardianPhone: string;
}

export interface AttendanceSessionData {
  sessionId: string;
  classId: string;
  className: string;
  date: string;
  period: string;
  status: "in_progress" | "submitted" | "locked";
  recordedBy: string;
  submittedAt?: string;
  records: AttendanceSheetRecord[];
}

export interface DiscrepancyCorrectionRecord {
  id: string;
  recordId: string;
  studentId: string;
  studentName: string;
  className: string;
  date: string;
  previousStatus: AttendanceStatus;
  newStatus: AttendanceStatus;
  reason: string;
  correctedBy: string;
  correctedAt: string;
}

// In-memory operational store for Phase 2 attendance workflow
const localSessions: AttendanceSessionData[] = [
  {
    sessionId: "sess-7b-today",
    classId: "cls-7b",
    className: "7B",
    date: "2026-09-22",
    period: "Morning Roll Call",
    status: "submitted",
    recordedBy: "James Miller",
    submittedAt: "Today, 08:50",
    records: [
      { recordId: "rec-01", studentId: "ST-2026-0142", studentNumber: "ST-2026-0142", studentName: "Amelia Warren", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "David Warren", guardianPhone: "+354 555 0192" },
      { recordId: "rec-02", studentId: "ST-2026-0115", studentNumber: "ST-2026-0115", studentName: "Leo Williams", className: "7B", status: "late", arrivalMinutesLate: 12, reason: "School bus delay", remarks: "Bus #4 arrived late", guardianName: "Sarah Williams", guardianPhone: "+354 555 0188" },
      { recordId: "rec-03", studentId: "ST-2026-0150", studentNumber: "ST-2026-0150", studentName: "Liam Peterson", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "Jonathan Miller", guardianPhone: "+354 555 0199" },
    ],
  },
  {
    sessionId: "sess-6a-today",
    classId: "cls-6a",
    className: "6A",
    date: "2026-09-22",
    period: "Morning Roll Call",
    status: "submitted",
    recordedBy: "Mark Davies",
    submittedAt: "Today, 08:55",
    records: [
      { recordId: "rec-04", studentId: "ST-2026-0138", studentNumber: "ST-2026-0138", studentName: "Noah Bennett", className: "6A", status: "excused", arrivalMinutesLate: 0, reason: "Doctor appointment", remarks: "Excused note submitted", guardianName: "Karen Bennett", guardianPhone: "+354 555 0284" },
      { recordId: "rec-05", studentId: "ST-2026-0126", studentNumber: "ST-2026-0126", studentName: "Elias Martin", className: "6A", status: "absent", arrivalMinutesLate: 0, reason: "Unexcused", guardianName: "Robert Martin", guardianPhone: "+354 555 0371" },
    ],
  },
  {
    sessionId: "sess-7a-today",
    classId: "cls-7a",
    className: "7A",
    date: "2026-09-22",
    period: "Morning Roll Call",
    status: "in_progress",
    recordedBy: "Elena Rostova",
    records: [
      { recordId: "rec-06", studentId: "ST-2026-0119", studentNumber: "ST-2026-0119", studentName: "Sofia Larsen", className: "7A", status: "present", arrivalMinutesLate: 0, guardianName: "Marta Larsen", guardianPhone: "+354 555 0177" },
      { recordId: "rec-07", studentId: "ST-2026-0131", studentNumber: "ST-2026-0131", studentName: "Maya Thompson", className: "7A", status: "present", arrivalMinutesLate: 0, guardianName: "Paul Thompson", guardianPhone: "+354 555 0166" },
    ],
  },
];

const localCorrections: DiscrepancyCorrectionRecord[] = [
  {
    id: "corr-001",
    recordId: "rec-04",
    studentId: "ST-2026-0138",
    studentName: "Noah Bennett",
    className: "6A",
    date: "2026-09-22",
    previousStatus: "absent",
    newStatus: "excused",
    reason: "Parent phoned office at 09:10 to report dentist appointment. Doctor certificate verified.",
    correctedBy: "Olivia Parker (Office Staff)",
    correctedAt: "Today, 09:15",
  },
];

export async function getAttendanceSheetAction(classId: string, date: string) {
  await requireDemoAction();
  let session = localSessions.find((s) => s.classId === classId && s.date === date);

  if (!session) {
    session = {
      sessionId: `sess-${classId}-${date}`,
      classId,
      className: classId.replace("cls-", "").toUpperCase(),
      date,
      period: "Morning Roll Call",
      status: "in_progress",
      recordedBy: "Elena Rostova",
      records: [
        { recordId: `rec-${Date.now()}-1`, studentId: "ST-2026-0142", studentNumber: "ST-2026-0142", studentName: "Amelia Warren", className: "7B", status: "present", arrivalMinutesLate: 0, guardianName: "David Warren", guardianPhone: "+354 555 0192" },
        { recordId: `rec-${Date.now()}-2`, studentId: "ST-2026-0138", studentNumber: "ST-2026-0138", studentName: "Noah Bennett", className: "6A", status: "present", arrivalMinutesLate: 0, guardianName: "Karen Bennett", guardianPhone: "+354 555 0284" },
        { recordId: `rec-${Date.now()}-3`, studentId: "ST-2026-0126", studentNumber: "ST-2026-0126", studentName: "Elias Martin", className: "5A", status: "present", arrivalMinutesLate: 0, guardianName: "Robert Martin", guardianPhone: "+354 555 0371" },
      ],
    };
    localSessions.push(session);
  }

  const metrics = calculateAttendanceMetrics(session.records);
  return { session, metrics };
}

export async function saveAttendanceRollCallAction(params: {
  sessionId: string;
  records: AttendanceRecordInput[];
  submit: boolean;
  recordedBy: string;
}) {
  await requireDemoAction();
  const session = localSessions.find((s) => s.sessionId === params.sessionId);
  if (!session) return { success: false, error: "Session not found" };

  params.records.forEach((r) => {
    const existing = session.records.find((rec) => rec.studentId === r.studentId);
    if (existing) {
      existing.status = r.status;
      existing.arrivalMinutesLate = r.arrivalMinutesLate;
      existing.reason = r.reason;
      existing.remarks = r.remarks;
    }
  });

  if (params.submit) {
    session.status = "submitted";
    session.submittedAt = "Just now";
    session.recordedBy = params.recordedBy;

    await logAuditEvent({
      organizationId: DEFAULT_ORG_ID,
      actorUserId: params.recordedBy,
      action: "attendance.session_submitted",
      entityType: "attendance_session",
      entityId: session.sessionId,
      metadata: { classId: session.classId, date: session.date, total: session.records.length },
    });

    // Generate alerts for unexcused absences
    const absentees = session.records.filter((r) => r.status === "absent");
    for (const absentStudent of absentees) {
      addInAppNotification({
        title: "Unexcused Absence Alert",
        message: `${absentStudent.studentName} (${session.className}) marked absent for morning roll call.`,
        type: "absence_alert",
        metadata: { studentId: absentStudent.studentId, class: session.className },
      });

      if (absentStudent.guardianPhone) {
        await dispatchAbsenceAlert({
          recipientPhone: absentStudent.guardianPhone,
          recipientName: absentStudent.guardianName,
          studentId: absentStudent.studentId,
          studentName: absentStudent.studentName,
          dateStr: session.date,
        });
      }
    }
  }

  return { success: true, session, metrics: calculateAttendanceMetrics(session.records) };
}

export async function correctAttendanceRecordAction(params: AttendanceCorrectionInput) {
  await requireDemoAction();
  let targetRecord: AttendanceSheetRecord | null = null;
  let targetSession: AttendanceSessionData | null = null;

  for (const s of localSessions) {
    const found = s.records.find((r) => r.recordId === params.attendanceRecordId || r.studentId === params.studentId);
    if (found) {
      targetRecord = found;
      targetSession = s;
      break;
    }
  }

  if (!targetRecord || !targetSession) {
    return { success: false, error: "Attendance record not found" };
  }

  const prev = targetRecord.status;
  targetRecord.status = params.newStatus;
  targetRecord.reason = params.reason;

  const correction: DiscrepancyCorrectionRecord = {
    id: `corr-${Date.now()}`,
    recordId: targetRecord.recordId,
    studentId: targetRecord.studentId,
    studentName: targetRecord.studentName,
    className: targetSession.className,
    date: targetSession.date,
    previousStatus: prev,
    newStatus: params.newStatus,
    reason: params.reason,
    correctedBy: params.correctedBy,
    correctedAt: "Just now",
  };

  localCorrections.unshift(correction);

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: params.correctedBy,
    action: "attendance.discrepancy_resolved",
    entityType: "attendance_record",
    entityId: targetRecord.recordId,
    metadata: {
      studentName: targetRecord.studentName,
      previousStatus: prev,
      newStatus: params.newStatus,
      reason: params.reason,
    },
  });

  addInAppNotification({
    title: "Attendance Discrepancy Resolved",
    message: `${targetRecord.studentName} updated from ${prev.toUpperCase()} to ${params.newStatus.toUpperCase()} by ${params.correctedBy}.`,
    type: "attendance_discrepancy",
    metadata: { studentId: targetRecord.studentId, correctionId: correction.id },
  });

  return { success: true, correction };
}

export async function getAttendanceCorrectionsAction() {
  await requireDemoAction();
  return [...localCorrections];
}

export async function getAllSessionsAction() {
  await requireDemoAction();
  return [...localSessions];
}

export async function getGuardianAttendanceDataAction(studentId: string) {
  await requireDemoAction();
  const records = [];
  for (const sess of localSessions) {
    const rec = sess.records.find((r) => r.studentId === studentId);
    if (rec) {
      records.push({
        date: sess.date,
        period: sess.period,
        status: rec.status,
        arrivalMinutesLate: rec.arrivalMinutesLate,
        reason: rec.reason,
      });
    }
  }

  const metrics = calculateAttendanceMetrics(records.map((r) => ({ status: r.status })));
  return { records, metrics };
}

export async function submitGuardianExcuseAction(params: {
  studentId: string;
  dateStr: string;
  reason: string;
  guardianName: string;
}) {
  await requireDemoAction();
  addInAppNotification({
    title: "Guardian Excuse Note Received",
    message: `${params.guardianName} submitted an absence note for ${params.dateStr}: "${params.reason}"`,
    type: "guardian_excuse",
    metadata: params,
  });

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: `guardian-${params.guardianName.toLowerCase().replace(/\s+/g, "-")}`,
    action: "guardian.excuse_submitted",
    entityType: "student",
    entityId: params.studentId,
    metadata: { date: params.dateStr, reason: params.reason, guardian: params.guardianName },
  });

  return { success: true };
}

export async function exportAttendanceCsvAction(dateStr: string) {
  await requireDemoAction();
  const allRecords: Array<{
    studentNumber: string;
    studentName: string;
    className: string;
    status: string;
    arrivalMinutesLate: number;
    reason?: string;
  }> = [];

  localSessions.forEach((s) => {
    s.records.forEach((r) => {
      allRecords.push({
        studentNumber: r.studentNumber,
        studentName: r.studentName,
        className: s.className,
        status: r.status,
        arrivalMinutesLate: r.arrivalMinutesLate,
        reason: r.reason,
      });
    });
  });

  return formatAttendanceCsvReport(dateStr, allRecords);
}
