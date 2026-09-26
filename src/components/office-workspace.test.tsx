import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { OfficeWorkspace } from "./office-workspace";
import type { OfficeData } from "@/lib/office-data";

const mocks = vi.hoisted(() => ({
  saveOffice: vi.fn(),
  correctAttendance: vi.fn(),
  recordReception: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }),
}));

vi.mock("@/components/account-sign-out", () => ({
  AccountSignOut: () => null,
}));

vi.mock("@/app/actions/office-actions", () => ({
  saveOfficeRecordAction: mocks.saveOffice,
  correctOfficeAttendanceAction: mocks.correctAttendance,
  recordReceptionDeskAction: mocks.recordReception,
  markGuardianAbsenceNoteReviewedAction: vi.fn(),
  reviewAndExcuseGuardianAbsenceAction: vi.fn(),
}));

const mockData: OfficeData = {
  actor: { organizationId: "org-1", userId: "user-1", name: "Alex Office", role: "office_staff" },
  school: { id: "org-1", name: "Highfield High", slug: "highfield" },
  years: [{ id: "year-1", organizationId: "org-1", name: "2026-2027", startsOn: "2026-09-01", endsOn: "2027-06-30", isCurrent: true, createdAt: new Date(), updatedAt: new Date() }],
  grades: [{ id: "grade-1", organizationId: "org-1", name: "Grade 10", position: 10, createdAt: new Date(), updatedAt: new Date() }],
  classes: [{ id: "class-1", organizationId: "org-1", academicYearId: "year-1", gradeLevelId: "grade-1", name: "10-A", homeroomTeacherId: null, createdAt: new Date(), updatedAt: new Date() }],
  students: [
    { id: "student-1", organizationId: "org-1", studentNumber: "STU-1", externalReference: null, firstName: "Leo", middleName: null, lastName: "Valdez", preferredName: null, dateOfBirth: "2010-03-15", status: "active", createdAt: new Date(), updatedAt: new Date() },
    { id: "student-2", organizationId: "org-1", studentNumber: "STU-2", externalReference: null, firstName: "Maya", middleName: null, lastName: "Lin", preferredName: null, dateOfBirth: "2010-07-22", status: "active", createdAt: new Date(), updatedAt: new Date() },
  ],
  guardians: [
    { id: "guardian-1", organizationId: "org-1", userId: null, firstName: "Esperanza", lastName: "Valdez", email: "esperanza@example.com", phone: "+447700900077", createdAt: new Date(), updatedAt: new Date() },
  ],
  links: [
    { id: "link-1", organizationId: "org-1", studentId: "student-1", guardianId: "guardian-1", relationship: "parent", isPrimary: true, hasLegalResponsibility: true, createdAt: new Date(), updatedAt: new Date() },
  ],
  enrollments: [
    { id: "enroll-1", organizationId: "org-1", academicYearId: "year-1", studentId: "student-1", classId: "class-1", status: "active", startsOn: "2026-09-01", endsOn: null, createdAt: new Date(), updatedAt: new Date() },
  ],
  sessions: [],
  records: [],
  restrictions: [
    {
      id: "restr-1",
      studentId: "student-2",
      prohibitPickup: true,
      prohibitDisclosure: true,
      effectiveDate: "2026-01-01",
      expirationDate: null,
      isEnforced: true,
      restrictedPersonName: "David Lin",
      docketNumber: "FAM-2026-99",
    },
  ],
  absenceNotes: [],
  unexplainedAbsences: [],
  medicalAlerts: [],
  receptionLogs: [
    {
      id: "log-1",
      organizationId: "org-1",
      studentId: "student-1",
      logType: "late_arrival",
      logDate: "2026-09-26",
      timeString: "09:20",
      minutesLate: 20,
      reason: "Bus delay",
      actorPersonName: "Unaccompanied",
      relationship: "self",
      isExcused: true,
      recordedBy: "user-1",
      remarks: "Traffic on Route 4",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ],
};

beforeEach(() => {
  mocks.saveOffice.mockReset().mockResolvedValue({ success: true, id: "saved-id" });
  mocks.correctAttendance.mockReset().mockResolvedValue({ success: true, entityId: "att-id" });
  mocks.recordReception.mockReset().mockResolvedValue({ success: true, entityId: "rec-id" });
  mocks.refresh.mockClear();
});

afterEach(cleanup);

describe("OfficeWorkspace reception desk component", () => {
  it("renders overview with reception desk logs count", () => {
    render(<OfficeWorkspace data={mockData} notices={[]} section="overview" date="2026-09-26" />);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeTruthy();
    expect(screen.getByText("Reception desk logs")).toBeTruthy();
    expect(screen.getAllByText("1").length).toBeGreaterThan(0);
  });

  it("submits a late arrival sign-in from the reception desk tab", async () => {
    render(<OfficeWorkspace data={mockData} notices={[]} section="reception" date="2026-09-26" />);
    expect(screen.getByRole("heading", { level: 1, name: "Reception desk" })).toBeTruthy();
    expect(screen.getByText("Late arrival check-in")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "student-1" } });
    fireEvent.change(screen.getByLabelText("Arrival time"), { target: { value: "09:30" } });
    fireEvent.change(screen.getByLabelText("Minutes late"), { target: { value: "30" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Medical / Dental appointment" } });
    fireEvent.change(screen.getByLabelText("Brought in by (or 'Unaccompanied')"), { target: { value: "Esperanza Valdez" } });
    fireEvent.change(screen.getByLabelText("Relationship to student"), { target: { value: "mother" } });

    fireEvent.click(screen.getByRole("button", { name: "Record late arrival" }));

    await waitFor(() => {
      expect(mocks.recordReception).toHaveBeenCalledWith({
        kind: "reception_log",
        studentId: "student-1",
        logType: "late_arrival",
        logDate: "2026-09-26",
        timeString: "09:30",
        minutesLate: 30,
        reason: "Medical / Dental appointment",
        actorPersonName: "Esperanza Valdez",
        relationship: "mother",
        isExcused: true,
        remarks: "",
      });
    });

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });

  it("switches to early departure, shows pickup restriction warning, and records departure", async () => {
    render(<OfficeWorkspace data={mockData} notices={[]} section="reception" date="2026-09-26" />);

    // Switch to Early departure
    fireEvent.click(screen.getByRole("button", { name: "Early departure sign-out" }));
    expect(screen.getByText(/leaving campus before the end of the school day/)).toBeTruthy();

    // Select student with court order
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "student-2" } });

    // Check warning badge displays restricted person
    expect(screen.getByText(/SAFEGUARDING ALERT: Court Order on File/)).toBeTruthy();
    expect(screen.getByText(/David Lin/)).toBeTruthy();
    expect(screen.getByText(/FAM-2026-99/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Departure time"), { target: { value: "13:15" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "Illness during school day" } });
    fireEvent.change(screen.getByLabelText("Collected by (adult's full name)"), { target: { value: "Aunt Sarah Lin" } });
    fireEvent.change(screen.getByLabelText("Relationship to student"), { target: { value: "aunt" } });

    fireEvent.click(screen.getByRole("button", { name: "Sign out student" }));

    await waitFor(() => {
      expect(mocks.recordReception).toHaveBeenCalledWith({
        kind: "reception_log",
        studentId: "student-2",
        logType: "early_departure",
        logDate: "2026-09-26",
        timeString: "13:15",
        minutesLate: 0,
        reason: "Illness during school day",
        actorPersonName: "Aunt Sarah Lin",
        relationship: "aunt",
        isExcused: false,
        remarks: "",
      });
    });
  });

  it("displays existing reception entries in the chronological register", () => {
    render(<OfficeWorkspace data={mockData} notices={[]} section="reception" date="2026-09-26" />);
    expect(screen.getByText("09:20")).toBeTruthy();
    expect(screen.getByText("Late (20m)")).toBeTruthy();
    expect(screen.getAllByText("Leo Valdez").length).toBeGreaterThan(0);
    expect(screen.getByText("Bus delay")).toBeTruthy();
    expect(screen.getByText("Traffic on Route 4")).toBeTruthy();
  });
});
