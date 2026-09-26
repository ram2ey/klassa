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
});
