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
  cases: [], notes: [], accessLogs: [], alerts: [], restrictions: [], clinicVisits: [],
  senProfiles: [], senReviews: [],
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
  it("records a clinic visit for the school nurse", async () => {
    render(<SpecialistWorkspace data={data} notices={[]} section="clinic" />);
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "student-a" } });
    fireEvent.change(screen.getByLabelText("Visit category"), { target: { value: "injury" } });
    fireEvent.change(screen.getByLabelText("Presenting symptoms / complaint"), { target: { value: "Scraped knee during sports" } });
    fireEvent.change(screen.getByLabelText("Triage assessment & treatment administered"), { target: { value: "Antiseptic wash and sterile dressing" } });
    fireEvent.change(screen.getByLabelText("Visit outcome"), { target: { value: "returned_to_class" } });
    fireEvent.click(screen.getByLabelText("Guardian was notified"));
    fireEvent.change(screen.getByLabelText("Guardian contact notes (optional)"), { target: { value: "Mother notified via telephone" } });
    fireEvent.click(screen.getByRole("button", { name: "Record clinic visit" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      kind: "clinic_visit",
      studentId: "student-a",
      category: "injury",
      symptoms: "Scraped knee during sports",
      treatment: "Antiseptic wash and sterile dressing",
      outcome: "returned_to_class",
      guardianNotified: true,
      guardianNotificationNotes: "Mother notified via telephone",
    }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledOnce());
  });
  it("allows safeguarding lead to generate a statutory disclosure package", async () => {
    const dslData = {
      ...data,
      actor: { organizationId: "school-a", userId: "dsl-1", name: "Morgan DSL", role: "safeguarding_lead" },
      areas: ["safeguarding", "health_medical", "disciplinary"],
    } as SpecialistData;
    mocks.save.mockResolvedValueOnce({
      success: true,
      entityId: "student-a",
      disclosurePackage: {
        studentName: "Ada Lee",
        dossierNumber: "DISCL-100-2026",
        generatedAt: "2026-09-26T10:00:00Z",
        schoolName: "Northfield School",
        recipientAgency: "Reykjavik CPS",
        includedRecords: [],
        withheldSafeguardingCount: 0,
        activeCourtOrdersCount: 0,
        digitalIntegrityChecksum: "abcdef1234567890",
      },
    });
    render(<SpecialistWorkspace data={dslData} notices={[]} section="disclosures" />);
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "student-a" } });
    fireEvent.change(screen.getByLabelText("Recipient agency / authority"), { target: { value: "Reykjavik CPS" } });
    fireEvent.change(screen.getByLabelText("Statutory legal basis / case reference"), { target: { value: "Section 47 investigation" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate certified disclosure package" }));
    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      kind: "statutory_disclosure",
      studentId: "student-a",
      recipientAgency: "Reykjavik CPS",
      reason: "Section 47 investigation",
    }));
  });
  it("renders SENCO workspace with SEN register navigation and allows adding profile", async () => {
    const sencoData = {
      ...data,
      actor: { organizationId: "school-a", userId: "senco-1", name: "Dr. Arthur Bell", role: "senco" },
      areas: ["special_needs"],
      senProfiles: [],
      senReviews: [],
    } as SpecialistData;

    render(<SpecialistWorkspace data={sencoData} notices={[]} section="sen" />);
    expect(screen.getByText("Special Educational Needs Register & Reviews")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Add student to register/i })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Add student to register/i }));
    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "student-a" } });
    fireEvent.change(screen.getByLabelText("Support Tier"), { target: { value: "targeted" } });
    fireEvent.change(screen.getByLabelText("Primary Area of Need"), { target: { value: "Cognition & Learning" } });
    fireEvent.change(screen.getByLabelText("Support Plan Summary & Classroom Interventions"), { target: { value: "1-to-1 reading support twice weekly" } });
    fireEvent.change(screen.getByLabelText("Exam Access Arrangements & Accommodations"), { target: { value: "25% Extra Time" } });
    fireEvent.change(screen.getByLabelText("Next Scheduled Review Date"), { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Create SEN profile" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      kind: "sen_profile_save",
      studentId: "student-a",
      tier: "targeted",
      primaryNeed: "Cognition & Learning",
      supportPlanSummary: "1-to-1 reading support twice weekly",
      examAccessArrangements: "25% Extra Time",
      nextReviewDate: "2026-12-15",
      reviewFrequencyWeeks: 12,
      status: "active",
    }));
  });
  it("allows SENCO to log a statutory review for an existing profile", async () => {
    const sencoData = {
      ...data,
      actor: { organizationId: "school-a", userId: "senco-1", name: "Dr. Arthur Bell", role: "senco" },
      areas: ["special_needs"],
      senProfiles: [{
        id: "prof-1",
        organizationId: "school-a",
        studentId: "student-a",
        caseId: null,
        tier: "targeted" as const,
        primaryNeed: "Cognition & Learning",
        secondaryNeeds: null,
        supportPlanSummary: "1-to-1 reading support",
        examAccessArrangements: "25% Extra Time",
        leadSpecialistId: "senco-1",
        reviewFrequencyWeeks: 12,
        nextReviewDate: "2026-09-01", // overdue
        lastReviewedAt: null,
        status: "active",
        createdAt: new Date(),
        updatedAt: new Date(),
      }],
      senReviews: [],
    } as SpecialistData;

    render(<SpecialistWorkspace data={sencoData} notices={[]} section="sen" />);
    expect(screen.getByText("Overdue: 2026-09-01")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Log review/i }));
    expect(screen.getByText("Log Statutory SEN Review")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Attendees Present"), { target: { value: "Dr. Bell, Mrs. Smith, Guardians" } });
    fireEvent.change(screen.getByLabelText("Targets Met & Progress Review"), { target: { value: "Phonics score improved by 20%" } });
    fireEvent.change(screen.getByLabelText("New SMART Targets for Next Cycle"), { target: { value: "Independent writing for 15 minutes" } });
    fireEvent.change(screen.getByLabelText("Next Scheduled Review Date"), { target: { value: "2026-12-15" } });
    fireEvent.click(screen.getByRole("button", { name: "Complete and record review" }));

    await waitFor(() => expect(mocks.save).toHaveBeenCalledWith({
      kind: "sen_review_complete",
      profileId: "prof-1",
      reviewDate: expect.any(String),
      reviewType: "termly",
      attendees: "Dr. Bell, Mrs. Smith, Guardians",
      targetsMetSummary: "Phonics score improved by 20%",
      newTargets: "Independent writing for 15 minutes",
      tierDecision: "targeted",
      nextReviewDate: "2026-12-15",
    }));
  });
});
