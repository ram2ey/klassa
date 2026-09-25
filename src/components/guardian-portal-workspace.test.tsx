import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { GuardianPortalWorkspace } from "./guardian-portal-workspace";
import type { GuardianPortalData } from "@/lib/guardian-portal-data";

vi.mock("@/components/account-sign-out", () => ({ AccountSignOut: () => null }));
vi.mock("@/components/guardian-absence-note-form", () => ({ GuardianAbsenceNoteForm: () => null }));

const reportId = "11111111-1111-4111-8111-111111111111";
const child = {
  id: "student-a", firstName: "Ada", lastName: "Lee", studentNumber: "100", status: "active",
  schoolName: "School A", schoolId: "school-a", currentYearId: "year-a", currentYearName: "2026",
  className: "Class A", classIds: ["class-a"], gradeIds: ["grade-a"], attendance: [], attendanceRate: null,
  absenceNotes: [], reports: [{ id: reportId, studentId: "student-a", termId: "term-a", version: 1,
    overallPercentage: "80", gpa: "3.0", publishedAt: new Date(), termName: "Autumn", subjects: [] }],
};

describe("guardian portal report links", () => {
  it("links each published report card to its printable page", () => {
    const data = { guardianName: "Parent", students: [child], announcements: [] } as GuardianPortalData;
    const html = renderToStaticMarkup(<GuardianPortalWorkspace data={data} />);
    expect(html).toContain(`href="/reports/${reportId}"`);
    expect(html).toContain("Open printable report card");
  });

  it("does not show a printable link when there are no published reports", () => {
    const data = { guardianName: "Parent", students: [{ ...child, reports: [] }], announcements: [] } as GuardianPortalData;
    const html = renderToStaticMarkup(<GuardianPortalWorkspace data={data} />);
    expect(html).not.toContain("Open printable report card");
  });
});
