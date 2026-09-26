import { describe, expect, it } from "vitest";
import { buildUnexplainedAbsenceCallList } from "./office-absence-followup";

describe("office absence call list", () => {
  it("combines submitted morning roll calls across classes and excludes noted absences", () => {
    const sessions = [
      { id: "a", classId: "class-a", sessionDate: "2026-09-26", period: "morning_roll_call", status: "submitted" },
      { id: "b", classId: "class-b", sessionDate: "2026-09-26", period: "morning_roll_call", status: "locked" },
      { id: "draft", classId: "class-c", sessionDate: "2026-09-26", period: "morning_roll_call", status: "draft" },
      { id: "later", classId: "class-d", sessionDate: "2026-09-26", period: "afternoon", status: "submitted" },
    ];
    const records = [
      { sessionId: "a", studentId: "alice", status: "absent" },
      { sessionId: "a", studentId: "bob", status: "absent" },
      { sessionId: "b", studentId: "cara", status: "absent" },
      { sessionId: "draft", studentId: "dan", status: "absent" },
      { sessionId: "later", studentId: "erin", status: "absent" },
    ];
    const notes = [{ studentId: "bob", absenceDate: "2026-09-26" }];
    const links = [
      { studentId: "alice", guardianId: "primary", isPrimary: true },
      { studentId: "alice", guardianId: "reachable", isPrimary: false },
      { studentId: "cara", guardianId: "cara-guardian", isPrimary: true },
    ];
    const guardians = [
      { id: "primary", firstName: "Pat", lastName: "Parent", phone: null, email: "pat@example.com" },
      { id: "reachable", firstName: "Robin", lastName: "Relative", phone: "+12345", email: null },
      { id: "cara-guardian", firstName: "Chris", lastName: "Carer", phone: null, email: "chris@example.com" },
    ];
    expect(buildUnexplainedAbsenceCallList(sessions, records, notes, links, guardians)).toEqual([
      { studentId: "alice", classId: "class-a", sessionDate: "2026-09-26", guardianName: "Robin Relative", phone: "+12345", email: null },
      { studentId: "cara", classId: "class-b", sessionDate: "2026-09-26", guardianName: "Chris Carer", phone: null, email: "chris@example.com" },
    ]);
  });
});
