import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SpecialistWorkspace } from "./specialist-workspace";
import type { SpecialistData } from "@/lib/specialist-data";

const mocks = vi.hoisted(() => ({ save: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
vi.mock("@/components/account-sign-out", () => ({ AccountSignOut: () => null }));
vi.mock("@/app/actions/school-workflow-actions", () => ({ saveSchoolWorkflowAction: mocks.save }));

const data = {
  actor: { organizationId: "school-a", userId: "nurse-a", name: "Avery Lee", role: "health_nurse" },
  school: { id: "school-a", name: "Northfield School" }, areas: ["health_medical"],
  students: [{ id: "student-a", firstName: "Ada", lastName: "Lee", studentNumber: "100" }],
  cases: [], notes: [], accessLogs: [], alerts: [], restrictions: [],
} as SpecialistData;

beforeEach(() => { mocks.save.mockReset().mockResolvedValue({ success: true, entityId: "case-a" }); mocks.refresh.mockClear(); });
afterEach(cleanup);

describe("live specialist workspace", () => {
  it("shows the nurse's permitted area without court controls", () => {
    render(<SpecialistWorkspace data={data} notices={[]} section="overview" />);
    expect(screen.getByRole("heading", { level: 1, name: "Overview" })).toBeTruthy();
    expect(screen.getByText(/Health Medical/)).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Court restrictions" })).toBeNull();
  });
  it("creates a case with the nurse's permitted area", async () => {
    render(<SpecialistWorkspace data={data} notices={[]} section="cases" />);
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "student-a" } });
    fireEvent.change(screen.getByLabelText("Case number"), { target: { value: "MED-1" } });
    fireEvent.change(screen.getByLabelText("Case area"), { target: { value: "health_medical" } });
    fireEvent.change(screen.getByLabelText("Confidentiality"), { target: { value: "confidential" } });
    fireEvent.change(screen.getByLabelText("Case title"), { target: { value: "Medical care plan" } });
    fireEvent.click(screen.getByRole("button", { name: "Create case" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({ kind: "sensitive_case", studentId: "student-a",
      caseNumber: "MED-1", area: "health_medical", confidentialityTier: "confidential", title: "Medical care plan" }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
});
