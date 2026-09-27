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

  it("validates reception, broadcast, and behaviour commands", () => {
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

    const sms = workflowCommandSchema.parse({
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "Campus lockdown in effect. All students secure indoors.",
      reason: "Verified security incident",
    });
    expect(sms).toMatchObject({ kind: "emergency_sms_broadcast", severity: "lockdown" });

    // Invalid message length (less than 5 chars)
    expect(workflowCommandSchema.safeParse({
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "Hi",
      reason: "Verified security incident",
    }).success).toBe(false);

    // Invalid message length (greater than 320 chars)
    expect(workflowCommandSchema.safeParse({
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "A".repeat(321),
      reason: "Verified security incident",
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
