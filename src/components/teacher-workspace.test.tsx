import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeacherWorkspace } from "./teacher-workspace";
import type { TeacherData } from "@/lib/teacher-data";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
vi.mock("@/components/account-sign-out", () => ({ AccountSignOut: () => null }));
vi.mock("@/app/actions/teacher-actions", () => ({ saveTeacherWorkflowAction: mocks.save }));

const classId = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const data = {
  actor: { name: "Teacher" }, school: { id: "school-a", name: "School A" }, currentYear: { name: "2026" },
  classes: [{ id: classId, name: "Class A" }], homeroomClassIds: [], assignments: [{ classId, subjectId: "subject-a" }],
  enrollments: [{ classId, studentId, status: "active" }], students: [{ id: studentId, firstName: "Ada", lastName: "Lee", status: "active", studentNumber: "A001" }],
  sessions: [], records: [], safety: { alerts: [], pickupWarnings: [] }, subjects: [], terms: [],
  assessments: [], grades: [], categories: [], reports: [], reportSubjects: [], gradeLevels: [],
} as unknown as TeacherData;

beforeEach(() => { mocks.save.mockReset().mockResolvedValue({ success: true }); mocks.refresh.mockClear(); mocks.push.mockClear(); });
afterEach(cleanup);

describe("teacher period attendance", () => {
  it("lets an assigned subject teacher record and submit a lesson period", async () => {
    render(<TeacherWorkspace data={data} notices={[]} section="attendance" date="2026-09-26" />);
    expect(screen.getByText("No classes are assigned for this attendance period.")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Session period"), { target: { value: "period_2" } });
    expect(screen.getByText("Ada Lee")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith(expect.objectContaining({ kind: "attendance",
      classId, studentId, sessionDate: "2026-09-26", period: "period_2" })));
    await waitFor(() => expect((screen.getByRole("button", { name: "Submit Period 2" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Submit Period 2" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "attendance_submit", classId,
      sessionDate: "2026-09-26", period: "period_2" }));
  });

  it("shows records from the selected period only", () => {
    const withSessions = { ...data, homeroomClassIds: [classId],
      sessions: [{ id: "morning", classId, period: "morning_roll_call", status: "submitted" },
        { id: "lesson", classId, period: "period_1", status: "in_progress" }],
      records: [{ sessionId: "morning", studentId, status: "absent" },
        { sessionId: "lesson", studentId, status: "late" }], } as unknown as TeacherData;
    render(<TeacherWorkspace data={withSessions} notices={[]} section="attendance" date="2026-09-26" />);
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("absent");
    fireEvent.change(screen.getByLabelText("Session period"), { target: { value: "period_1" } });
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("late");
  });
  it("shows guardian absence notes for the selected attendance date", () => {
    const withNote = { ...data, homeroomClassIds: [classId],
      absenceNotes: [{ id: "note-1", studentId, absenceDate: "2026-09-26",
        reasonCategory: "medical_appointment", status: "submitted" }] } as unknown as TeacherData;
    render(<TeacherWorkspace data={withNote} notices={[]} section="attendance" date="2026-09-26" />);
    expect(screen.getByText("Guardian absence notes for this date")).toBeTruthy();
    expect(screen.getByText("Ada Lee: Medical Appointment (Submitted)")).toBeTruthy();
  });
});

describe("teacher class information", () => {
  it("publishes a notice only to the selected assigned class", async () => {
    render(<TeacherWorkspace data={data} notices={[]} section="notices" date="2026-09-26" />);
    fireEvent.change(screen.getByLabelText("Class"), { target: { value: classId } });
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Class trip" } });
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Please bring a coat." } });
    fireEvent.click(screen.getByRole("button", { name: "Publish to class" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "announcement", title: "Class trip",
      content: "Please bring a coat.", targetType: "class", targetId: classId,
      priority: "normal", status: "published" }));
  });
  it("shows linked contact and published attendance history on a roster", () => {
    const enriched = { ...data, guardianContacts: [{ studentId, isPrimary: true,
      guardian: { firstName: "Morgan", lastName: "Lee", phone: "+441234567890", email: "morgan@example.test" } }],
      historyRecords: [{ studentId, status: "present" }, { studentId, status: "absent" }],
      publishedReports: [] } as unknown as TeacherData;
    render(<TeacherWorkspace data={enriched} notices={[]} section="classes" date="2026-09-26" />);
    fireEvent.click(screen.getByText("Contact and history"));
    expect(screen.getByText("Morgan Lee", { exact: false })).toBeTruthy();
    expect(screen.getByText("Recent morning attendance: 1/2 present")).toBeTruthy();
  });
});
