import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StaffInquiryList } from "./staff-inquiry-list";
import type { SerializedGuardianInquiry } from "@/lib/guardian-inquiry-service";

const mocks = vi.hoisted(() => ({
  replyStaff: vi.fn(),
  updateStatus: vi.fn(),
  refresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));

vi.mock("@/app/actions/guardian-inquiry-actions", () => ({
  replyStaffInquiryAction: mocks.replyStaff,
  updateStaffInquiryStatusAction: mocks.updateStatus,
}));

const mockInquiries: SerializedGuardianInquiry[] = [
  {
    id: "inq-101",
    studentId: "student-1",
    studentName: "Ada Lovelace",
    studentNumber: "ST-001",
    guardianId: "g-1",
    guardianName: "Jane Lovelace",
    guardianPhone: "+441234567890",
    guardianEmail: "jane@example.com",
    classId: "class-1",
    className: "Year 5 Willow",
    targetRole: "teacher",
    title: "Question about History field trip permission",
    category: "general",
    status: "open",
    closedAt: null,
    createdAt: "2026-09-21T09:00:00Z",
    updatedAt: "2026-09-21T09:00:00Z",
    messages: [
      {
        id: "msg-101",
        senderType: "guardian",
        senderUserId: "user-guardian",
        senderName: "Jane Lovelace",
        message: "Are paper permission slips needed or is the portal consent sufficient?",
        createdAt: "2026-09-21T09:00:00Z",
      },
    ],
  },
  {
    id: "inq-102",
    studentId: "student-2",
    studentName: "Charles Babbage",
    studentNumber: "ST-002",
    guardianId: "g-2",
    guardianName: "Benjamin Babbage",
    guardianPhone: "+449876543210",
    guardianEmail: "ben@example.com",
    classId: "class-1",
    className: "Year 5 Willow",
    targetRole: "teacher",
    title: "Pastoral support following illness",
    category: "pastoral",
    status: "resolved",
    closedAt: "2026-09-22T15:00:00Z",
    createdAt: "2026-09-20T11:00:00Z",
    updatedAt: "2026-09-22T15:00:00Z",
    messages: [
      {
        id: "msg-102",
        senderType: "guardian",
        senderUserId: "user-g2",
        senderName: "Benjamin Babbage",
        message: "Charles will need extra rest during sports period.",
        createdAt: "2026-09-20T11:00:00Z",
      },
    ],
  },
];

beforeEach(() => {
  mocks.replyStaff.mockReset().mockResolvedValue({ success: true, messageId: "msg-staff", status: "in_progress" });
  mocks.updateStatus.mockReset().mockResolvedValue({ success: true, status: "resolved" });
  mocks.refresh.mockClear();
});

afterEach(cleanup);

describe("StaffInquiryList component", () => {
  it("renders inquiries with student name, class, guardian contacts, and status badge", () => {
    render(<StaffInquiryList inquiries={mockInquiries} />);

    expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    expect(screen.getByText("ST-001")).toBeTruthy();
    expect(screen.getByText("Year 5 Willow")).toBeTruthy();
    expect(screen.getAllByText("Jane Lovelace").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("+441234567890")).toBeTruthy();
    expect(screen.getByText(/Needs reply/i)).toBeTruthy();
    expect(screen.getByText("1 action required")).toBeTruthy();
  });

  it("calls onOpenStudentDrawer when student name button is clicked", () => {
    const onOpenDrawer = vi.fn();
    render(<StaffInquiryList inquiries={mockInquiries} onOpenStudentDrawer={onOpenDrawer} />);

    fireEvent.click(screen.getByRole("button", { name: "Ada Lovelace" }));
    expect(onOpenDrawer).toHaveBeenCalledWith("student-1");
  });

  it("submits a staff reply message", async () => {
    render(<StaffInquiryList inquiries={mockInquiries} />);

    // inq-101 is expanded by default (first item)
    const replyInput = screen.getByPlaceholderText("Write your reply to the guardian...");
    fireEvent.change(replyInput, {
      target: { value: "Portal consent is fully sufficient, no paper slips required." },
    });

    fireEvent.click(screen.getByRole("button", { name: "Reply" }));

    await waitFor(() =>
      expect(mocks.replyStaff).toHaveBeenCalledWith({
        inquiryId: "inq-101",
        message: "Portal consent is fully sufficient, no paper slips required.",
      })
    );
  });

  it("changes inquiry status to in_progress", async () => {
    render(<StaffInquiryList inquiries={mockInquiries} />);

    fireEvent.click(screen.getByRole("button", { name: "Mark as in progress" }));
    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith({
        inquiryId: "inq-101",
        status: "in_progress",
      })
    );
  });

  it("changes inquiry status to resolved", async () => {
    render(<StaffInquiryList inquiries={mockInquiries} />);

    fireEvent.click(screen.getByRole("button", { name: /Mark as resolved/i }));
    await waitFor(() =>
      expect(mocks.updateStatus).toHaveBeenCalledWith({
        inquiryId: "inq-101",
        status: "resolved",
      })
    );
  });

  it("filters inquiries by search query", () => {
    render(<StaffInquiryList inquiries={mockInquiries} />);

    const searchInput = screen.getByPlaceholderText("Search student or topic…");
    fireEvent.change(searchInput, { target: { value: "Unknown Student" } });

    expect(screen.getByText("No inquiries found")).toBeTruthy();
  });
});
