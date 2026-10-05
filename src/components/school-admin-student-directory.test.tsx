import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import { SchoolAdminStudentDirectory } from "./school-admin-student-directory";

const mocks = vi.hoisted(() => ({ bulk: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/app/actions/school-admin-actions", () => ({ bulkUpdateSchoolStudentsAction: mocks.bulk }));
afterEach(cleanup);
beforeEach(() => { mocks.bulk.mockReset().mockResolvedValue({ success: true, updatedCount: 2 }); mocks.refresh.mockClear(); });
const data = {
  students: [
    { id: "one", firstName: "Ada", lastName: "Lee", studentNumber: "ST-001", dateOfBirth: "2012-01-01", status: "active" },
    { id: "two", firstName: "Ben", lastName: "Osei", studentNumber: "ST-002", dateOfBirth: "2012-02-01", status: "pending" },
  ],
  classes: [{ id: "current-class", name: "7A", academicYearId: "current", gradeLevelId: "grade" }, { id: "old-class", name: "6A", academicYearId: "previous", gradeLevelId: "grade" }],
  grades: [{ id: "grade", name: "Grade 7" }], years: [{ id: "current", name: "2026–27" }],
  enrollments: [{ studentId: "one", academicYearId: "current", classId: "current-class", status: "withdrawn" }],
  links: [], guardians: [], activeAlerts: [], activeRestrictions: [], attendanceSummary: [], publishedReports: [], subjects: [], terms: [],
} as unknown as SchoolAdminData;

describe("administrator directory integration", () => {
  it("does not display a withdrawn enrollment as a current class", () => {
    render(<SchoolAdminStudentDirectory data={data} query="" currentYearId="current" onEnroll={vi.fn()} onEdit={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Student quick filters" }).textContent).toContain("No class2");
    expect(screen.getAllByText("Not assigned", { selector: "td" })).toHaveLength(2);
    expect(screen.getByLabelText("Class").textContent).not.toContain("6A");
  });

  it("updates the selected IDs through the existing action and keeps success feedback after clearing selection", async () => {
    render(<SchoolAdminStudentDirectory data={data} query="" currentYearId="current" onEnroll={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Select all visible students"));
    fireEvent.change(screen.getByLabelText("Set selected students’ status"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Update 2" }));
    await waitFor(() => expect(mocks.bulk).toHaveBeenCalledWith({ studentIds: ["one", "two"], status: "active" }));
    await waitFor(() => expect(screen.getByText("Updated 2 student records.")).toBeTruthy());
    expect(screen.queryByRole("button", { name: "Clear selection" })).toBeNull();
    expect(mocks.refresh).toHaveBeenCalledOnce();
  });

  it("keeps failed updates selected and displays the server error", async () => {
    mocks.bulk.mockResolvedValue({ success: false, error: "Class placement changed. Refresh and try again." });
    render(<SchoolAdminStudentDirectory data={data} query="" currentYearId="current" onEnroll={vi.fn()} onEdit={vi.fn()} />);
    fireEvent.click(screen.getByLabelText("Select Ada Lee"));
    fireEvent.change(screen.getByLabelText("Set selected students’ status"), { target: { value: "pending" } });
    fireEvent.click(screen.getByRole("button", { name: "Update 1" }));
    await waitFor(() => expect(screen.getByText("Class placement changed. Refresh and try again.")).toBeTruthy());
    expect((screen.getByLabelText("Select Ada Lee") as HTMLInputElement).checked).toBe(true);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
});
