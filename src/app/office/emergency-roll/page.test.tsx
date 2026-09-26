import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ load: vi.fn() }));
vi.mock("@/lib/office-data", () => ({ getOfficeData: mocks.load }));
vi.mock("@/components/print-report-button", () => ({ PrintReportButton: () => <button>Print</button> }));
import EmergencyRollPage from "./page";

describe("office emergency roll sheets", () => {
  it("includes current active students and actionable safety warnings", async () => {
    mocks.load.mockResolvedValue({ school: { name: "School A" }, years: [{ id: "year-a", isCurrent: true }],
      classes: [{ id: "class-a", academicYearId: "year-a", name: "5A" }],
      enrollments: [{ classId: "class-a", studentId: "student-a", status: "active" },
        { classId: "class-a", studentId: "student-b", status: "withdrawn" }],
      students: [{ id: "student-a", firstName: "Ada", lastName: "Lee", studentNumber: "A001" },
        { id: "student-b", firstName: "Ben", lastName: "Lee", studentNumber: "A002" }],
      medicalAlerts: [{ id: "alert-a", studentId: "student-a", directiveSummary: "Carry inhaler" }],
      restrictions: [{ studentId: "student-a", isEnforced: true, prohibitPickup: true,
        effectiveDate: "2020-01-01", expirationDate: null }] });
    const html = renderToStaticMarkup(await EmergencyRollPage());
    expect(html).toContain("Ada Lee");
    expect(html).toContain("Carry inhaler");
    expect(html).toContain("Pickup restriction");
    expect(html).not.toContain("Ben Lee");
  });
});
