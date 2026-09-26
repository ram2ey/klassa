import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TeacherBehaviourPanel } from "./teacher-behaviour-panel";
import type { TeacherData } from "@/lib/teacher-data";
import type { studentBehaviours } from "@/db/schema";

const classId = "00000000-0000-4000-8000-000000000001";
const studentId1 = "00000000-0000-4000-8000-000000000002";
const studentId2 = "00000000-0000-4000-8000-000000000003";

const mockClasses: TeacherData["classes"] = [
  {
    id: classId,
    organizationId: "org-1",
    name: "Year 5 Willow",
    academicYearId: "year-1",
    gradeLevelId: "grade-5",
    homeroomTeacherId: "teacher-1",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockStudents: TeacherData["students"] = [
  { id: studentId1, firstName: "Ada", lastName: "Lovelace", preferredName: null, studentNumber: "ST-001", status: "active" },
  { id: studentId2, firstName: "Charles", lastName: "Babbage", preferredName: null, studentNumber: "ST-002", status: "active" },
];

const mockEnrollments: TeacherData["enrollments"] = [
  { id: "en-1", organizationId: "org-1", academicYearId: "year-1", classId, studentId: studentId1, status: "active", startsOn: "2026-09-01", endsOn: null, createdAt: new Date(), updatedAt: new Date() },
  { id: "en-2", organizationId: "org-1", academicYearId: "year-1", classId, studentId: studentId2, status: "active", startsOn: "2026-09-01", endsOn: null, createdAt: new Date(), updatedAt: new Date() },
];

const mockBehaviours: (typeof studentBehaviours.$inferSelect)[] = [
  {
    id: "beh-1",
    organizationId: "org-1",
    studentId: studentId1,
    classId,
    recordedBy: "teacher-1",
    type: "praise",
    category: "academic_excellence",
    points: 3,
    description: "Brilliant algorithm design",
    guardianVisible: true,
    occurredAt: "2026-09-26",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "beh-2",
    organizationId: "org-1",
    studentId: studentId2,
    classId,
    recordedBy: "teacher-1",
    type: "incident",
    category: "disruption",
    points: 1,
    description: "Repeated interruptions during instruction",
    guardianVisible: false,
    occurredAt: "2026-09-25",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

afterEach(cleanup);

describe("TeacherBehaviourPanel component", () => {
  it("renders summary statistics and conduct log table", () => {
    const onSave = vi.fn();
    render(
      <TeacherBehaviourPanel
        classes={mockClasses}
        students={mockStudents}
        enrollments={mockEnrollments}
        behaviours={mockBehaviours}
        defaultDate="2026-09-26"
        pending={false}
        onSave={onSave}
      />
    );

    expect(screen.getAllByText("+3").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("-1").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("50%")).toBeTruthy(); // 1 praise out of 2 total = 50%
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Charles Babbage")).toBeTruthy();
    expect(screen.getByText("Portal visible")).toBeTruthy();
    expect(screen.getByText("Internal only")).toBeTruthy();
  });

  it("submits praise points with selected student and points", async () => {
    const onSave = vi.fn();
    render(
      <TeacherBehaviourPanel
        classes={mockClasses}
        students={mockStudents}
        enrollments={mockEnrollments}
        behaviours={mockBehaviours}
        defaultDate="2026-09-26"
        pending={false}
        onSave={onSave}
      />
    );

    fireEvent.change(screen.getByLabelText(/Student/), { target: { value: studentId1 } });
    fireEvent.click(screen.getByText("+2"));
    fireEvent.change(screen.getByLabelText(/Notes & Context/), {
      target: { value: "Helped peers during group lab experiment" },
    });

    const submitBtn = screen.getByRole("button", { name: /Award Praise/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        kind: "behaviour_log",
        studentId: studentId1,
        classId,
        type: "praise",
        category: "academic_excellence",
        points: 2,
        description: "Helped peers during group lab experiment",
        guardianVisible: true,
        occurredAt: "2026-09-26",
      });
    });
  });

  it("switches to incident mode and updates categories and button", async () => {
    const onSave = vi.fn();
    render(
      <TeacherBehaviourPanel
        classes={mockClasses}
        students={mockStudents}
        enrollments={mockEnrollments}
        behaviours={mockBehaviours}
        defaultDate="2026-09-26"
        pending={false}
        onSave={onSave}
      />
    );

    // Click Incident radio button
    fireEvent.click(screen.getByRole("radio", { name: /Incident/i }));

    expect(screen.getByRole("button", { name: /Record Incident/i })).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/Student/), { target: { value: studentId2 } });
    fireEvent.change(screen.getByLabelText(/Category/), { target: { value: "incomplete_work" } });

    const submitBtn = screen.getByRole("button", { name: /Record Incident/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith({
        kind: "behaviour_log",
        studentId: studentId2,
        classId,
        type: "incident",
        category: "incomplete_work",
        points: 1,
        description: "",
        guardianVisible: true,
        occurredAt: "2026-09-26",
      });
    });
  });

  it("filters the conduct log by praise only and incidents only", () => {
    const onSave = vi.fn();
    render(
      <TeacherBehaviourPanel
        classes={mockClasses}
        students={mockStudents}
        enrollments={mockEnrollments}
        behaviours={mockBehaviours}
        defaultDate="2026-09-26"
        pending={false}
        onSave={onSave}
      />
    );

    // Initially both students are visible
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Charles Babbage")).toBeTruthy();

    // Filter to Praise only
    fireEvent.click(screen.getByRole("button", { name: /Praise \(1\)/i }));
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Charles Babbage")).toBeNull();

    // Filter to Incidents only
    fireEvent.click(screen.getByRole("button", { name: /Incidents \(1\)/i }));
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Charles Babbage")).toBeTruthy();
  });
});
