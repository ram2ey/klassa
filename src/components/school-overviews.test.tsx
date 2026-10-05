import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import type { TeacherData } from "@/lib/teacher-data";
import { AdministratorOverview, buildAdministratorOverview, summarizeSubmittedAttendance, TeacherOverview } from "./school-overviews";

afterEach(cleanup);
const school = {
  school: { name: "Test School" }, years: [{ id: "current", name: "2026–27", isCurrent: true }],
  students: [{ id: "active", status: "active" }, { id: "pending", status: "pending" }, { id: "old", status: "withdrawn" }],
  classes: [{ id: "now", academicYearId: "current" }, { id: "before", academicYearId: "previous" }],
  staff: [{ role: "school_admin" }, { role: "teacher" }], links: [{ studentId: "old" }],
  enrollments: [{ studentId: "active", academicYearId: "previous", status: "active" }],
  attendanceSummary: [{ studentId: "active", total: 5, attended: 3, absent: 1, firstDate: "2026-09-01", lastDate: "2026-09-30" }],
  absenceNotes: [{ status: "submitted" }, { status: "reviewed" }], audit: [],
} as unknown as SchoolAdminData;

describe("school overview data scopes", () => {
  it("counts active pupils and current-year classes without treating old enrollments or guardian links as setup completion", () => {
    const model = buildAdministratorOverview(school);
    expect(model.metrics.map(row => row.value)).toEqual([1, 1, 2, "60%"]);
    expect(model.steps?.map(row => row.done)).toEqual([true, true, true, false, false]);
    expect(model.attendance.scope).toContain("All school years");
    expect(model.attendance.scope).toContain("2026-09-01 to 2026-09-30");
    expect(model.tasks?.[0]).toMatchObject({ count: 1, href: "/?section=attendance#guardian-absence-notes" });
    expect(model.tasks?.[0].detail).toContain("latest 100");
  });

  it("uses only submitted or locked marks, including late and excluding drafts", () => {
    expect(summarizeSubmittedAttendance([
      { id: "s", status: "submitted", period: "morning_roll_call" },
      { id: "l", status: "locked", period: "period_1" },
      { id: "d", status: "in_progress", period: "morning_roll_call" },
    ], [
      { sessionId: "s", status: "present" }, { sessionId: "s", status: "late" },
      { sessionId: "l", status: "absent" }, { sessionId: "l", status: "excused" },
      { sessionId: "d", status: "present" }, { sessionId: "unknown", status: "present" },
    ])).toEqual({ total: 4, attended: 2, absent: 1 });
  });

  it("guides an empty school to academic setup instead of opening enrollment without classes", () => {
    const empty = { ...school, years: [], classes: [], students: [], enrollments: [], attendanceSummary: [], staff: [], links: [] };
    const enroll = vi.fn();
    render(<AdministratorOverview data={empty} onEnroll={enroll} />);
    expect(screen.getByRole("link", { name: "Continue school setup" }).getAttribute("href")).toBe("/?section=academic");
    expect(screen.queryByRole("button", { name: "Enroll student" })).toBeNull();
    expect(screen.getByRole("progressbar").getAttribute("value")).toBe("0");
    expect(screen.getByText("No submitted attendance marks yet", { selector: "h3" })).toBeTruthy();
    expect(screen.queryByText("0%")).toBeNull();
    expect(screen.queryByText("100%")).toBeNull();
  });

  it("connects the overview enrollment action to the existing enrollment workflow", () => {
    const enroll = vi.fn();
    render(<AdministratorOverview data={school} onEnroll={enroll} />);
    fireEvent.click(screen.getByRole("button", { name: "Enroll student" }));
    expect(enroll).toHaveBeenCalledOnce();
  });

  it("deduplicates active pupils for teachers and keeps actions inside teaching permissions", () => {
    const teacher = {
      school: school.school, currentYear: school.years[0], classes: [school.classes[0]],
      students: school.students, enrollments: [{ studentId: "active", status: "active" }, { studentId: "active", status: "active" }, { studentId: "old", status: "active" }],
      assessments: [], sessions: [], records: [],
    } as unknown as TeacherData;
    render(<TeacherOverview data={teacher} date="2026-10-05" notices={[]} />);
    expect(screen.getByRole("heading", { name: "Active pupils" }).closest("article")?.textContent).toContain("1");
    expect(screen.getByRole("link", { name: "Take attendance" }).getAttribute("href")).toBe("/?section=attendance&date=2026-10-05");
    expect(screen.queryByRole("heading", { name: "School setup" })).toBeNull();
    expect(screen.queryByRole("link", { name: "Manage staff" })).toBeNull();
    expect(screen.queryByRole("link", { name: "View history" })).toBeNull();
  });
});
