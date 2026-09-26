import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { SencoRegisterPanel } from "./senco-register-panel";
import type { senProfiles, senReviews } from "@/db/schema";

type SenProfile = typeof senProfiles.$inferSelect;
type SenReview = typeof senReviews.$inferSelect;

afterEach(cleanup);

const mockStudents = [
  { id: "stu-1", name: "Ada Lovelace", studentNumber: "ST-001" },
  { id: "stu-2", name: "Alan Turing", studentNumber: "ST-002" },
  { id: "stu-3", name: "Grace Hopper", studentNumber: "ST-003" },
];

const mockProfiles: SenProfile[] = [
  {
    id: "prof-1",
    organizationId: "org-1",
    studentId: "stu-1",
    caseId: null,
    tier: "universal",
    primaryNeed: "Visual Impairment",
    secondaryNeeds: "Large print materials",
    supportPlanSummary: "Seating at front of class, high contrast handouts",
    examAccessArrangements: "Enlarged print examination papers",
    leadSpecialistId: "senco-1",
    reviewFrequencyWeeks: 12,
    nextReviewDate: "2026-11-20", // upcoming
    lastReviewedAt: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "prof-2",
    organizationId: "org-1",
    studentId: "stu-2",
    caseId: null,
    tier: "specialist",
    primaryNeed: "Autism Spectrum Condition",
    secondaryNeeds: "Sensory overload, Anxiety",
    supportPlanSummary: "1-to-1 teaching assistant 15h weekly, quiet breakout pass",
    examAccessArrangements: "25% Extra Time, Separate room, Rest breaks",
    leadSpecialistId: "senco-1",
    reviewFrequencyWeeks: 52,
    nextReviewDate: "2026-08-01", // overdue
    lastReviewedAt: null,
    status: "active",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

const mockReviews: SenReview[] = [
  {
    id: "rev-1",
    organizationId: "org-1",
    profileId: "prof-2",
    studentId: "stu-2",
    reviewerId: "senco-1",
    reviewDate: "2025-08-01",
    reviewType: "annual_ehcp",
    attendees: "Dr. Bell (SENCO), Educational Psychologist, Parents",
    targetsMetSummary: "Met communication target with assistive speech device",
    newTargets: "Independent transition between science labs",
    tierDecision: "specialist",
    nextReviewDate: "2026-08-01",
    notes: "EHCP annual review paperwork sent to local authority",
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("SencoRegisterPanel component", () => {
  it("renders KPI metrics correctly across tiers and overdue reviews", () => {
    render(
      <SencoRegisterPanel
        profiles={mockProfiles}
        reviews={mockReviews}
        students={mockStudents}
        isPending={false}
        onSaveCommand={vi.fn()}
      />
    );

    expect(screen.getByText("2 students")).toBeTruthy();
    expect(screen.getAllByText("Tier 1: Universal").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Tier 3: Specialist").length).toBeGreaterThan(0);
    expect(screen.getByText("1 overdue")).toBeTruthy();
  });

  it("filters students by support tier and overdue status", () => {
    render(
      <SencoRegisterPanel
        profiles={mockProfiles}
        reviews={mockReviews}
        students={mockStudents}
        isPending={false}
        onSaveCommand={vi.fn()}
      />
    );

    // Initial state: both students visible
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("Alan Turing")).toBeTruthy();

    // Filter by Universal
    fireEvent.click(screen.getByRole("button", { name: /Universal \(1\)/i }));
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Alan Turing")).toBeNull();

    // Filter by Specialist
    fireEvent.click(screen.getByRole("button", { name: /Specialist \(1\)/i }));
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Alan Turing")).toBeTruthy();

    // Filter by Overdue
    fireEvent.click(screen.getByRole("button", { name: /Overdue \(1\)/i }));
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Alan Turing")).toBeTruthy();
  });

  it("filters students by search input", () => {
    render(
      <SencoRegisterPanel
        profiles={mockProfiles}
        reviews={mockReviews}
        students={mockStudents}
        isPending={false}
        onSaveCommand={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText(/Search by student name/i);

    // Search by need
    fireEvent.change(searchInput, { target: { value: "Autism" } });
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Alan Turing")).toBeTruthy();

    // Search by student number
    fireEvent.change(searchInput, { target: { value: "ST-001" } });
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.queryByText("Alan Turing")).toBeNull();
  });

  it("toggles past review chronology", () => {
    render(
      <SencoRegisterPanel
        profiles={mockProfiles}
        reviews={mockReviews}
        students={mockStudents}
        isPending={false}
        onSaveCommand={vi.fn()}
      />
    );

    expect(screen.queryByText(/Review Chronology:/i)).toBeNull();

    const viewHistoryBtn = screen.getByRole("button", { name: /View review history/i });
    fireEvent.click(viewHistoryBtn);

    expect(screen.getByText(/Review Chronology:/i)).toBeTruthy();
    expect(screen.getByText(/Met communication target with assistive speech device/i)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Hide review history/i }));
    expect(screen.queryByText(/Review Chronology:/i)).toBeNull();
  });

  it("submits a new SEN profile save command", () => {
    const handleSave = vi.fn();
    render(
      <SencoRegisterPanel
        profiles={mockProfiles}
        reviews={mockReviews}
        students={mockStudents}
        isPending={false}
        onSaveCommand={handleSave}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: /Add student to register/i }));
    expect(screen.getByText("Add Student to SEN Register")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Student"), { target: { value: "stu-3" } });
    fireEvent.change(screen.getByLabelText("Support Tier"), { target: { value: "targeted" } });
    fireEvent.change(screen.getByLabelText("Primary Area of Need"), { target: { value: "Speech & Language" } });
    fireEvent.change(screen.getByLabelText("Support Plan Summary & Classroom Interventions"), { target: { value: "Weekly SLT exercises" } });
    fireEvent.change(screen.getByLabelText("Next Scheduled Review Date"), { target: { value: "2026-12-01" } });

    fireEvent.click(screen.getByRole("button", { name: "Create SEN profile" }));

    expect(handleSave).toHaveBeenCalledWith({
      kind: "sen_profile_save",
      studentId: "stu-3",
      tier: "targeted",
      primaryNeed: "Speech & Language",
      secondaryNeeds: undefined,
      supportPlanSummary: "Weekly SLT exercises",
      examAccessArrangements: undefined,
      nextReviewDate: "2026-12-01",
      reviewFrequencyWeeks: 12,
      status: "active",
    });
  });

  it("submits a completed review command", () => {
    const handleSave = vi.fn();
    render(
      <SencoRegisterPanel
        profiles={mockProfiles}
        reviews={mockReviews}
        students={mockStudents}
        isPending={false}
        onSaveCommand={handleSave}
      />
    );

    const logReviewButtons = screen.getAllByRole("button", { name: /Log review/i });
    fireEvent.click(logReviewButtons[0]);

    expect(screen.getByText("Log Statutory SEN Review")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Review Meeting Date"), { target: { value: "2026-09-26" } });
    fireEvent.change(screen.getByLabelText("Attendees Present"), { target: { value: "Dr. Bell, Mrs. Lovelace" } });
    fireEvent.change(screen.getByLabelText("Targets Met & Progress Review"), { target: { value: "Seating accommodation working well" } });
    fireEvent.change(screen.getByLabelText("New SMART Targets for Next Cycle"), { target: { value: "Increase reading stamina" } });
    fireEvent.change(screen.getByLabelText("Next Scheduled Review Date"), { target: { value: "2026-12-20" } });

    fireEvent.click(screen.getByRole("button", { name: "Complete and record review" }));

    expect(handleSave).toHaveBeenCalledWith({
      kind: "sen_review_complete",
      profileId: "prof-1",
      reviewDate: "2026-09-26",
      reviewType: "termly",
      attendees: "Dr. Bell, Mrs. Lovelace",
      targetsMetSummary: "Seating accommodation working well",
      newTargets: "Increase reading stamina",
      tierDecision: "universal",
      nextReviewDate: "2026-12-20",
      notes: undefined,
    });
  });
});
