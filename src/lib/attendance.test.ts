import { describe, expect, it } from "vitest";
import {
  attendanceCorrectionSchema,
  attendanceRecordInputSchema,
  calculateAttendanceMetrics,
  formatAttendanceCsvReport,
  isChronicAbsence,
} from "./attendance";

describe("Attendance Calculations & Business Rules", () => {
  it("accurately computes attendance rate according to institutional formulas", () => {
    const records = [
      { status: "present" as const },
      { status: "present" as const },
      { status: "late" as const },
      { status: "excused" as const },
      { status: "absent" as const }, // 1 absent out of 5
    ];

    const metrics = calculateAttendanceMetrics(records);
    expect(metrics.total).toBe(5);
    expect(metrics.present).toBe(2);
    expect(metrics.late).toBe(1);
    expect(metrics.excused).toBe(1);
    expect(metrics.absent).toBe(1);
    // (5 - 1) / 5 = 80.0%
    expect(metrics.attendanceRate).toBe(80);
  });

  it("identifies chronic absenteeism when absence rate exceeds 10%", () => {
    expect(isChronicAbsence(2, 20)).toBe(true); // 10% exactly
    expect(isChronicAbsence(5, 30)).toBe(true); // 16.7%
    expect(isChronicAbsence(1, 20)).toBe(false); // 5%
  });

  it("validates attendance record input schemas", () => {
    const valid = {
      studentId: "ST-001",
      status: "late",
      arrivalMinutesLate: 15,
      remarks: "Traffic delay",
    };
    expect(attendanceRecordInputSchema.safeParse(valid).success).toBe(true);

    const invalidStatus = {
      studentId: "ST-001",
      status: "unknown_status",
    };
    expect(attendanceRecordInputSchema.safeParse(invalidStatus).success).toBe(false);
  });

  it("enforces mandatory reason for attendance discrepancy corrections", () => {
    const validCorrection = {
      attendanceRecordId: "rec-123",
      studentId: "ST-001",
      previousStatus: "absent",
      newStatus: "excused",
      reason: "Parent submitted medical certificate",
      correctedBy: "James Miller",
    };
    expect(attendanceCorrectionSchema.safeParse(validCorrection).success).toBe(true);

    const invalidCorrection = {
      ...validCorrection,
      reason: "no", // too short, min 3 chars
    };
    expect(attendanceCorrectionSchema.safeParse(invalidCorrection).success).toBe(false);
  });

  it("generates a well-formatted CSV report", () => {
    const csv = formatAttendanceCsvReport("2026-09-22", [
      {
        studentNumber: "ST-001",
        studentName: 'Amelia "Amy" Warren',
        className: "7B",
        status: "present",
        arrivalMinutesLate: 0,
      },
      {
        studentNumber: "ST-002",
        studentName: "Elias Martin",
        className: "5A",
        status: "excused",
        arrivalMinutesLate: 0,
        reason: "Dentist visit",
      },
    ]);

    expect(csv).toContain("date,studentNumber,studentName,className,status,arrivalMinutesLate,reason");
    expect(csv).toContain('2026-09-22,ST-001,"Amelia ""Amy"" Warren",7B,present,0,');
    expect(csv).toContain('2026-09-22,ST-002,"Elias Martin",5A,excused,0,"Dentist visit"');
  });
});

