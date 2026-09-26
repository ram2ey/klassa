import { describe, expect, it } from "vitest";
import { canTeacherTakeAttendance, workflowCommandSchema } from "./school-workflow-policy";

const classId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";

describe("period attendance policy", () => {
  it("keeps existing attendance commands on morning roll call", () => {
    const command = workflowCommandSchema.parse({ kind: "attendance", classId, sessionDate: "2026-09-26",
      studentId, status: "present" });
    expect(command).toMatchObject({ period: "morning_roll_call", reason: "", correctionReason: "" });
  });

  it("accepts periods one through six for records and submission", () => {
    for (let number = 1; number <= 6; number++) {
      const period = `period_${number}`;
      expect(workflowCommandSchema.parse({ kind: "attendance", classId, sessionDate: "2026-09-26",
        studentId, status: "late", period })).toMatchObject({ period });
      expect(workflowCommandSchema.parse({ kind: "attendance_submit", classId, sessionDate: "2026-09-26",
        period })).toMatchObject({ period });
    }
    expect(workflowCommandSchema.safeParse({ kind: "attendance_submit", classId, sessionDate: "2026-09-26",
      period: "period_7" }).success).toBe(false);
  });

  it("limits morning roll call to homeroom and permits assigned teachers for lesson periods", () => {
    expect(canTeacherTakeAttendance("morning_roll_call", false, true)).toBe(false);
    expect(canTeacherTakeAttendance("period_1", false, true)).toBe(true);
    expect(canTeacherTakeAttendance("period_1", false, false)).toBe(false);
    expect(canTeacherTakeAttendance("morning_roll_call", true, false)).toBe(true);
  });

  it("validates reception log and specialist workflow commands", () => {
    const late = workflowCommandSchema.parse({
      kind: "reception_log",
      studentId,
      logType: "late_arrival",
      logDate: "2026-09-26",
      timeString: "09:30",
      minutesLate: 30,
      reason: "Bus delay",
    });
    expect(late).toMatchObject({ kind: "reception_log", minutesLate: 30, isExcused: false });

    const clinic = workflowCommandSchema.parse({
      kind: "clinic_visit",
      studentId,
      category: "illness",
      symptoms: "Fever and headache",
      treatment: "Temperature taken, rested with water",
      outcome: "resting_in_clinic",
      guardianNotified: true,
      guardianNotificationNotes: "Called mom",
    });
    expect(clinic).toMatchObject({ outcome: "resting_in_clinic", guardianNotified: true });

    const disclosure = workflowCommandSchema.parse({
      kind: "statutory_disclosure",
      studentId,
      recipientAgency: "Social Services",
      reason: "Section 47 child protection inquiry",
    });
    expect(disclosure).toMatchObject({ kind: "statutory_disclosure" });

    const sms = workflowCommandSchema.parse({
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "Campus lockdown in effect. All students secure indoors.",
    });
    expect(sms).toMatchObject({ kind: "emergency_sms_broadcast", severity: "lockdown" });

    // Invalid message length (less than 5 chars)
    expect(workflowCommandSchema.safeParse({
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "Hi",
    }).success).toBe(false);

    // Invalid message length (greater than 320 chars)
    expect(workflowCommandSchema.safeParse({
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "A".repeat(321),
    }).success).toBe(false);

    const praise = workflowCommandSchema.parse({
      kind: "behaviour_log",
      studentId,
      classId,
      type: "praise",
      category: "academic_excellence",
      points: 2,
      description: "Exceptional mathematical reasoning in group problem solving",
      guardianVisible: true,
      occurredAt: "2026-09-26",
    });
    expect(praise).toMatchObject({
      kind: "behaviour_log",
      type: "praise",
      category: "academic_excellence",
      points: 2,
      guardianVisible: true,
    });

    const incident = workflowCommandSchema.parse({
      kind: "behaviour_log",
      studentId,
      type: "incident",
      category: "disruption",
      occurredAt: "2026-09-26",
    });
    expect(incident).toMatchObject({
      kind: "behaviour_log",
      type: "incident",
      category: "disruption",
      points: 1, // default
      guardianVisible: true, // default
      description: "", // default
    });

    // Invalid: points > 20
    expect(workflowCommandSchema.safeParse({
      kind: "behaviour_log",
      studentId,
      type: "praise",
      category: "academic_excellence",
      points: 25,
      occurredAt: "2026-09-26",
    }).success).toBe(false);
  });
});

