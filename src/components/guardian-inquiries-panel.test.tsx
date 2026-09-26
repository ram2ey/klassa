import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import {
  GuardianInquiriesPanel,
  type GuardianInquiryStudent,
  type GuardianInquiryRecord,
} from "./guardian-inquiries-panel";

const mocks = vi.hoisted(() => ({
  submitInquiry: vi.fn(),
  replyInquiry: vi.fn(),
  resolveInquiry: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/guardian-inquiry-actions", () => ({
  submitGuardianInquiryAction: mocks.submitInquiry,
  replyGuardianInquiryAction: mocks.replyInquiry,
  resolveGuardianInquiryAction: mocks.resolveInquiry,
}));

const mockStudents: GuardianInquiryStudent[] = [
  {
    id: "student-1",
    firstName: "Ada",
    lastName: "Lovelace",
    schoolId: "school-1",
    schoolName: "St. Jude Academy",
  },
];

const mockInquiries: GuardianInquiryRecord[] = [
  {
    id: "inq-1",
    studentId: "student-1",
    studentName: "Ada Lovelace",
    schoolId: "school-1",
    schoolName: "St. Jude Academy",
    targetRole: "teacher",
    title: "Clarification on Math fractions homework",
    category: "academic",
    status: "in_progress",
    closedAt: null,
    createdAt: "2026-09-20T10:00:00Z",
    updatedAt: "2026-09-20T12:00:00Z",
    messages: [
      {
        id: "msg-1",
        senderType: "guardian",
        senderName: "Jane Lovelace",
        message: "Could you please explain problem 3 on page 42?",
        createdAt: "2026-09-20T10:00:00Z",
      },
      {
        id: "msg-2",
        senderType: "teacher",
        senderName: "Mr. Babbage",
        message: "Hello Mrs. Lovelace, problem 3 involves finding the common denominator.",
        createdAt: "2026-09-20T12:00:00Z",
      },
    ],
  },
];

beforeEach(() => {
  mocks.submitInquiry.mockReset().mockResolvedValue({ success: true, inquiryId: "inq-new" });
  mocks.replyInquiry.mockReset().mockResolvedValue({ success: true, messageId: "msg-new", status: "in_progress" });
  mocks.resolveInquiry.mockReset().mockResolvedValue({ success: true, status: "resolved" });
  mocks.refresh.mockClear();
});

afterEach(cleanup);

describe("GuardianInquiriesPanel component", () => {
  it("renders inquiries list with topic, category, and status", () => {
    render(<GuardianInquiriesPanel students={mockStudents} inquiries={mockInquiries} />);

    expect(screen.getByText("School Inquiries & Messages")).toBeTruthy();
    expect(screen.getByText("Clarification on Math fractions homework")).toBeTruthy();
    expect(screen.getByText("Academic Progress & Homework")).toBeTruthy();
    expect(screen.getByText(/Staff replied/i)).toBeTruthy();
    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
  });

  it("shows conversation thread messages when inquiry is expanded", () => {
    render(<GuardianInquiriesPanel students={mockStudents} inquiries={mockInquiries} />);

    // Since inq-1 is expanded by default (index 0)
    expect(screen.getByText("Could you please explain problem 3 on page 42?")).toBeTruthy();
    expect(
      screen.getByText("Hello Mrs. Lovelace, problem 3 involves finding the common denominator.")
    ).toBeTruthy();
    expect(screen.getByText("Teacher")).toBeTruthy();
    expect(screen.getByText("Mr. Babbage")).toBeTruthy();
  });

  it("opens new inquiry form and submits a new message thread", async () => {
    render(<GuardianInquiriesPanel students={mockStudents} inquiries={mockInquiries} />);

    fireEvent.click(screen.getByRole("button", { name: /New inquiry/i }));

    expect(screen.getByText("Start a new inquiry")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Subject \/ Topic/i), {
      target: { value: "Science lab equipment question" },
    });
    fireEvent.change(screen.getByLabelText(/Initial Message/i), {
      target: { value: "Does Ada need safety goggles for tomorrow's lab?" },
    });

    fireEvent.click(screen.getByRole("button", { name: /Submit inquiry/i }));

    await waitFor(() =>
      expect(mocks.submitInquiry).toHaveBeenCalledWith(
        expect.objectContaining({
          studentId: "student-1",
          category: "academic",
          title: "Science lab equipment question",
          message: "Does Ada need safety goggles for tomorrow's lab?",
        })
      )
    );
  });

  it("submits a follow-up reply in an existing thread", async () => {
    render(<GuardianInquiriesPanel students={mockStudents} inquiries={mockInquiries} />);

    const replyInput = screen.getByPlaceholderText("Write your follow-up reply...");
    fireEvent.change(replyInput, { target: { value: "Thank you for the quick explanation!" } });

    fireEvent.click(screen.getByRole("button", { name: "Send" }));

    await waitFor(() =>
      expect(mocks.replyInquiry).toHaveBeenCalledWith({
        inquiryId: "inq-1",
        message: "Thank you for the quick explanation!",
      })
    );
  });

  it("marks inquiry as resolved on button click", async () => {
    render(<GuardianInquiriesPanel students={mockStudents} inquiries={mockInquiries} />);

    fireEvent.click(screen.getByRole("button", { name: /Mark as resolved/i }));

    await waitFor(() =>
      expect(mocks.resolveInquiry).toHaveBeenCalledWith("inq-1")
    );
  });
});
