import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  StudentAcademicDrawer,
  type StudentAcademicDrawerProps,
} from "./student-academic-drawer";

const mockStudent = {
  id: "student-1",
  studentNumber: "ST-001",
  firstName: "Ada",
  lastName: "Lovelace",
  preferredName: "Addie",
  dateOfBirth: "2010-12-10",
  status: "active",
};

const mockTerms = [
  { id: "term-1", name: "Autumn Term", position: 1 },
  { id: "term-2", name: "Spring Term", position: 2 },
];

const mockSubjects = [
  { id: "sub-1", name: "Mathematics", code: "MATH" },
  { id: "sub-2", name: "Computer Science", code: "CS" },
];

const mockReports = [
  {
    id: "rep-1",
    studentId: "student-1",
    termId: "term-1",
    version: 1,
    overallPercentage: 86.5,
    gpa: 3.7,
    attendanceRate: 98,
    publishedAt: "2026-01-15T10:00:00Z",
    teacherRemarks: "Exemplary progress in mathematical reasoning.",
  },
  {
    id: "rep-2",
    studentId: "student-1",
    termId: "term-2",
    version: 1,
    overallPercentage: 92.0,
    gpa: 3.95,
    attendanceRate: 96,
    publishedAt: "2026-04-20T10:00:00Z",
    teacherRemarks: "Outstanding analytical work and computer algorithms.",
  },
];

const mockReportSubjects = [
  {
    id: "rs-1",
    reportCardId: "rep-2",
    subjectId: "sub-1",
    scorePercentage: 94,
    letterGrade: "A",
    comments: "Superb algebra mastery",
  },
  {
    id: "rs-2",
    reportCardId: "rep-2",
    subjectId: "sub-2",
    scorePercentage: 98,
    letterGrade: "A*",
    comments: "Invented new algorithm",
  },
];

const mockBehaviours: StudentAcademicDrawerProps["behaviours"] = [
  {
    id: "beh-1",
    studentId: "student-1",
    type: "praise",
    category: "academic_excellence",
    points: 3,
    description: "Built working difference engine prototype",
    guardianVisible: true,
    occurredAt: "2026-09-20",
  },
  {
    id: "beh-2",
    studentId: "student-1",
    type: "incident",
    category: "disruption",
    points: 1,
    description: "Talked over instructions",
    guardianVisible: false,
    occurredAt: "2026-09-22",
  },
];

const mockGuardians = [
  {
    id: "g-1",
    firstName: "Anne",
    lastName: "Isabella",
    relationship: "mother",
    phone: "+441234567890",
    email: "anne@example.com",
    isPrimary: true,
    hasLegalResponsibility: true,
  },
];

afterEach(cleanup);

describe("StudentAcademicDrawer component", () => {
  it("renders student header details, placement, and KPI metrics", () => {
    const onClose = vi.fn();
    render(
      <StudentAcademicDrawer
        student={mockStudent}
        classPlacement="Year 5 Willow · Grade 5"
        terms={mockTerms}
        subjects={mockSubjects}
        reports={mockReports}
        reportSubjects={mockReportSubjects}
        behaviours={mockBehaviours}
        guardians={mockGuardians}
        onClose={onClose}
      />
    );

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("(Addie)")).toBeTruthy();
    expect(screen.getByText(/ST-001/)).toBeTruthy();
    expect(screen.getByText("ACTIVE")).toBeTruthy();
    expect(screen.getByText(/Year 5 Willow · Grade 5/)).toBeTruthy();

    // Latest GPA and scores from report 2
    expect(screen.getByText("3.95")).toBeTruthy();
    expect(screen.getAllByText("92%").length).toBeGreaterThanOrEqual(1);
    // Net conduct: +3 - 1 = +2
    expect(screen.getByText("+2")).toBeTruthy();
  });

  it("renders multi-term progression trends and published report cards", () => {
    const onClose = vi.fn();
    render(
      <StudentAcademicDrawer
        student={mockStudent}
        terms={mockTerms}
        reports={mockReports}
        reportSubjects={mockReportSubjects}
        onClose={onClose}
      />
    );

    // Multi-term section
    expect(screen.getByText("Multi-Term Grade Progression")).toBeTruthy();
    expect(screen.getAllByText("Autumn Term").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Spring Term").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+5.5%")).toBeTruthy(); // 92.0 - 86.5 = +5.5%

    // Official report cards list
    expect(screen.getByText("Official Published Report Cards")).toBeTruthy();
    const printableLinks = screen.getAllByText("Open printable card");
    expect(printableLinks.length).toBe(2);
    expect(printableLinks[0].closest("a")?.getAttribute("href")).toBe("/reports/rep-1");
  });

  it("switches to Subject Grades tab and renders curriculum subject scores", () => {
    const onClose = vi.fn();
    render(
      <StudentAcademicDrawer
        student={mockStudent}
        terms={mockTerms}
        subjects={mockSubjects}
        reports={mockReports}
        reportSubjects={mockReportSubjects}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Subject Grades/i }));

    expect(screen.getByText("Subject-by-Subject Academic Results")).toBeTruthy();
    expect(screen.getByText("Mathematics")).toBeTruthy();
    expect(screen.getByText("94%")).toBeTruthy();
    expect(screen.getByText("A")).toBeTruthy();
    expect(screen.getByText("Computer Science")).toBeTruthy();
    expect(screen.getByText("98%")).toBeTruthy();
    expect(screen.getByText("A*")).toBeTruthy();
  });

  it("switches to Behaviour & Merits tab and displays conduct logs", () => {
    const onClose = vi.fn();
    render(
      <StudentAcademicDrawer
        student={mockStudent}
        behaviours={mockBehaviours}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Behaviour & Merits/i }));

    expect(screen.getByText("Conduct & Praise Points Tally")).toBeTruthy();
    expect(screen.getByText("+3")).toBeTruthy(); // Praise merits
    expect(screen.getByText("-1")).toBeTruthy(); // Sanctions
    expect(screen.getByText("Built working difference engine prototype")).toBeTruthy();
    expect(screen.getByText("Talked over instructions")).toBeTruthy();
    expect(screen.getByText("Portal visible")).toBeTruthy();
    expect(screen.getByText("Staff only")).toBeTruthy();
  });

  it("switches to Guardians & Contacts tab and displays contacts and safety notices", () => {
    const onClose = vi.fn();
    render(
      <StudentAcademicDrawer
        student={mockStudent}
        guardians={mockGuardians}
        safetyNotices={[
          { type: "directive", title: "Severe Peanut Allergy", detail: "EpiPen in classroom cabinet" },
        ]}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Guardians & Contacts/i }));

    expect(screen.getByText("Anne Isabella")).toBeTruthy();
    expect(screen.getByText("Primary Contact")).toBeTruthy();
    expect(screen.getByText("+441234567890")).toBeTruthy();
    expect(screen.getByText("Severe Peanut Allergy")).toBeTruthy();
    expect(screen.getByText("EpiPen in classroom cabinet")).toBeTruthy();
  });

  it("handles close button click and escape key", () => {
    const onClose = vi.fn();
    render(
      <StudentAcademicDrawer
        student={mockStudent}
        onClose={onClose}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
