import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import { SchoolAdminWorkspace } from "./school-admin-workspace";

const mocks = vi.hoisted(() => ({ save: vi.fn(), provision: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/account-sign-out", () => ({ AccountSignOut: () => <button>Sign out</button> }));
vi.mock("@/app/actions/school-admin-actions", () => ({ saveSchoolRecordAction: mocks.save }));
vi.mock("@/app/actions/school-access-actions", () => ({ provisionStaffForCurrentSchoolAction: mocks.provision }));

const data: SchoolAdminData = {
  school: { id: "school-1", name: "Northfield School", slug: "northfield", timezone: "Etc/GMT" },
  actor: { organizationId: "school-1", userId: "admin-1", name: "School Admin", role: "school_admin" },
  students: [], guardians: [], links: [], staff: [], classes: [], assignments: [], grades: [], years: [], terms: [], subjects: [], enrollments: [], audit: [],
  attendanceSummary: [], publishedReports: [], activeAlerts: [], activeRestrictions: [],
};
const assignmentData = {
  ...data,
  years: [{ id: "year-1", name: "2026/27", isCurrent: true }],
  grades: [{ id: "grade-1", name: "Grade 9", position: 9 }],
  classes: [{ id: "class-1", name: "9A", academicYearId: "year-1", gradeLevelId: "grade-1", homeroomTeacherId: null }],
  subjects: [{ id: "subject-1", name: "Science", code: "SCI", department: null }],
  staff: [{ id: "member-1", userId: "teacher-1", name: "Avery Lee", role: "teacher", username: "avery" }],
  assignments: [{ id: "assignment-1", classId: "class-1", subjectId: "subject-1", teacherId: "teacher-1" }],
} as SchoolAdminData;

beforeEach(() => {
  mocks.save.mockReset().mockResolvedValue({ success: true, entityId: "saved-record" });
  mocks.provision.mockReset(); mocks.refresh.mockClear();
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute("open", ""); };
});
afterEach(cleanup);

describe("school administration workspace", () => {
  it.each([
    ["overview", "Overview"], ["students", "Students"], ["guardians", "Guardians"],
    ["staff", "Staff & access"], ["classes", "Classes & grades"], ["subjects", "Subjects"],
    ["academic", "Academic years"], ["audit", "Audit history"], ["settings", "School settings"],
  ])("opens the %s section with the actual school identity", (section, title) => {
    render(<SchoolAdminWorkspace data={data} section={section} />);
    expect(screen.getByRole("heading", { level: 1, name: title })).toBeTruthy();
    expect(screen.getAllByText("Northfield School").length).toBeGreaterThan(0);
    expect(screen.queryByText("Olivia Parker")).toBeNull();
  });
  it("prevents enrollment until school setup supplies a current class", () => {
    render(<SchoolAdminWorkspace data={data} section="students" />);
    fireEvent.click(screen.getByRole("button", { name: "Enroll student" }));
    expect((screen.getByRole("button", { name: "Continue" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText("Create the current academic year and a class before enrolling a student.")).toBeTruthy();
  });
  it("saves a guardian without requiring a phone number and refreshes live data", async () => {
    render(<SchoolAdminWorkspace data={data} section="guardians" />);
    fireEvent.click(screen.getByRole("button", { name: "Add guardian" }));
    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "Alex" } });
    fireEvent.change(screen.getByLabelText("Last name"), { target: { value: "Smith" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "guardian", firstName: "Alex", lastName: "Smith", email: "", phone: "" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("keeps the form and entered values when the server rejects a save", async () => {
    mocks.save.mockResolvedValue({ success: false, error: "Subject code is already in use." });
    render(<SchoolAdminWorkspace data={data} section="subjects" />);
    fireEvent.click(screen.getByRole("button", { name: "Add subject" }));
    fireEvent.change(screen.getByLabelText("Subject code"), { target: { value: "MATH" } });
    fireEvent.change(screen.getByLabelText("Subject name"), { target: { value: "Mathematics" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Subject code is already in use.");
    expect(screen.getByLabelText("Subject name")).toHaveProperty("value", "Mathematics");
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("shows subject assignments and submits the selected class, subject, and teacher", async () => {
    render(<SchoolAdminWorkspace data={{ ...assignmentData, assignments: [] }} section="classes" />);
    fireEvent.click(screen.getByRole("button", { name: "Assign subject teacher" }));
    expect(screen.getByRole("option", { name: "Avery Lee" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "teacher_subject_assignment",
      classId: "class-1", subjectId: "subject-1", teacherId: "teacher-1" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
  it("removes an existing subject assignment after confirmation", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(true);
    try {
      render(<SchoolAdminWorkspace data={assignmentData} section="classes" />);
      expect(screen.getByText("Science")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: /Remove Avery Lee/ }));
      await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "teacher_subject_assignment_remove", id: "assignment-1" }));
      await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
    } finally { confirm.mockRestore(); }
  });
  it("opens an existing assignment for editing", async () => {
    render(<SchoolAdminWorkspace data={assignmentData} section="classes" />);
    fireEvent.click(screen.getByRole("button", { name: /Edit Avery Lee/ }));
    expect(screen.getByLabelText("Class")).toHaveProperty("value", "class-1");
    expect(screen.getByLabelText("Subject")).toHaveProperty("value", "subject-1");
    expect(screen.getByLabelText("Teacher")).toHaveProperty("value", "teacher-1");
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "teacher_subject_assignment", id: "assignment-1",
      classId: "class-1", subjectId: "subject-1", teacherId: "teacher-1" }));
  });
});
