import { z } from "zod";

export const AttendanceStatusEnum = z.enum(["present", "absent", "late", "excused"]);
export type AttendanceStatus = z.infer<typeof AttendanceStatusEnum>;

export const SessionStatusEnum = z.enum(["in_progress", "submitted", "locked"]);
export type SessionStatus = z.infer<typeof SessionStatusEnum>;

export const attendanceRecordInputSchema = z.object({
  studentId: z.string().min(1),
  status: AttendanceStatusEnum,
  arrivalMinutesLate: z.number().int().min(0).max(300).default(0),
  reason: z.string().trim().max(255).optional(),
  remarks: z.string().trim().max(500).optional(),
});

export type AttendanceRecordInput = z.infer<typeof attendanceRecordInputSchema>;

export const attendanceCorrectionSchema = z.object({
  attendanceRecordId: z.string().min(1),
  studentId: z.string().min(1),
  previousStatus: AttendanceStatusEnum,
  newStatus: AttendanceStatusEnum,
  reason: z.string().trim().min(3, "Correction reason must be at least 3 characters").max(500),
  correctedBy: z.string().min(1),
});

export type AttendanceCorrectionInput = z.infer<typeof attendanceCorrectionSchema>;

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number; // percentage rounded to 1 decimal place
}

/**
 * Calculates attendance metrics following standard institutional rules:
 * - (Present + Late + Excused) count toward Attendance Rate
 * - Unexcused Absences count against Attendance Rate
 */
export function calculateAttendanceMetrics(records: Array<{ status: AttendanceStatus }>): AttendanceSummary {
  if (records.length === 0) {
    return { total: 0, present: 0, absent: 0, late: 0, excused: 0, attendanceRate: 100 };
  }

  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  for (const r of records) {
    switch (r.status) {
      case "present":
        present++;
        break;
      case "absent":
        absent++;
        break;
      case "late":
        late++;
        break;
      case "excused":
        excused++;
        break;
    }
  }

  const total = records.length;
  // Standard formula: (Total - Unexcused Absent) / Total * 100
  const rate = Math.round(((total - absent) / total) * 1000) / 10;

  return {
    total,
    present,
    absent,
    late,
    excused,
    attendanceRate: rate,
  };
}

/**
 * Flags chronic absenteeism when absence rate is 10% or higher.
 */
export function isChronicAbsence(absentDays: number, totalSchoolDays: number): boolean {
  if (totalSchoolDays <= 0) return false;
  return (absentDays / totalSchoolDays) >= 0.10;
}

/**
 * Formats attendance records into an RFC 4180 CSV report.
 */
export function formatAttendanceCsvReport(
  dateStr: string,
  records: Array<{
    studentNumber: string;
    studentName: string;
    className: string;
    status: string;
    arrivalMinutesLate: number;
    reason?: string;
  }>,
): string {
  const headers = "date,studentNumber,studentName,className,status,arrivalMinutesLate,reason";
  const rows = records.map((r) => {
    const reasonEscaped = r.reason ? `"${r.reason.replace(/"/g, '""')}"` : "";
    return `${dateStr},${r.studentNumber},"${r.studentName.replace(/"/g, '""')}",${r.className},${r.status},${r.arrivalMinutesLate},${reasonEscaped}`;
  });

  return [headers, ...rows].join("\n") + "\n";
}

