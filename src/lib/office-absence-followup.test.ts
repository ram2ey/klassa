import { describe, expect, it } from "vitest";
import { buildUnexplainedAbsenceCallList } from "./office-absence-followup";

describe("office absence call list", () => {
  const session = [{ id: "roll", classId: "class", sessionDate: "2026-09-01", period: "morning_roll_call", status: "submitted" }];
  const records = [{ sessionId: "roll", studentId: "pupil", status: "absent" }];
  const links = [
    { studentId: "pupil", guardianId: "primary", isPrimary: true, hasLegalResponsibility: true },
    { studentId: "pupil", guardianId: "backup", isPrimary: false, hasLegalResponsibility: true },
    { studentId: "pupil", guardianId: "other", isPrimary: true, hasLegalResponsibility: false },
  ];
  const guardians = ["primary", "backup", "other"].map(id => ({ id, firstName: id, lastName: "Contact", phone: id, email: `${id}@example.com` }));
  const restriction = { studentId: "pupil", restrictedGuardianId: "primary", isEnforced: true,
    prohibitDirectContact: true, prohibitDisclosure: false, effectiveDate: "2026-09-15", expirationDate: null };

  it("uses today's restrictions even when following up a historic absence", () => {
    const [result] = buildUnexplainedAbsenceCallList(session, records, [], links, guardians, [restriction], "2026-09-26");
    expect(result.phone).toBe("backup");
    expect(result.contactBlocked).toBe(false);
  });
  it("withholds phone, email and name if every legal contact is restricted", () => {
    const [result] = buildUnexplainedAbsenceCallList(session, records, [], links, guardians,
      [{ ...restriction, restrictedGuardianId: null, prohibitDirectContact: false, prohibitDisclosure: true }], "2026-09-26");
    expect(result).toMatchObject({ guardianName: null, phone: null, email: null, contactBlocked: true });
  });
  it.each([
    { ...restriction, isEnforced: false },
    { ...restriction, expirationDate: "2026-09-25" },
    { ...restriction, effectiveDate: "2026-09-27" },
  ])("does not block an inactive restriction", order => {
    expect(buildUnexplainedAbsenceCallList(session, records, [], links, guardians, [order], "2026-09-26")[0].phone).toBe("primary");
  });
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
      { studentId: "alice", guardianId: "primary", isPrimary: true, hasLegalResponsibility: true },
      { studentId: "alice", guardianId: "reachable", isPrimary: false, hasLegalResponsibility: true },
      { studentId: "cara", guardianId: "cara-guardian", isPrimary: true, hasLegalResponsibility: true },
    ];
    const guardians = [
      { id: "primary", firstName: "Pat", lastName: "Parent", phone: null, email: "pat@example.com" },
      { id: "reachable", firstName: "Robin", lastName: "Relative", phone: "+12345", email: null },
      { id: "cara-guardian", firstName: "Chris", lastName: "Carer", phone: null, email: "chris@example.com" },
    ];
    expect(buildUnexplainedAbsenceCallList(sessions, records, notes, links, guardians, [], "2026-09-26")).toEqual([
      { studentId: "alice", classId: "class-a", sessionDate: "2026-09-26", guardianName: "Robin Relative", phone: "+12345", email: null, contactBlocked: false },
      { studentId: "cara", classId: "class-b", sessionDate: "2026-09-26", guardianName: "Chris Carer", phone: null, email: "chris@example.com", contactBlocked: false },
    ]);
  });
});
