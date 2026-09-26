// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireGuardian: vi.fn(),
  requireStaff: vi.fn(),
  createGuardianInquiry: vi.fn(),
  replyGuardianInquiry: vi.fn(),
  replyStaffInquiry: vi.fn(),
  updateInquiryStatus: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/action-access", () => ({
  requireGuardian: mocks.requireGuardian,
  requireStaff: mocks.requireStaff,
}));

vi.mock("@/lib/guardian-inquiry-service", async () => {
  const actual = await vi.importActual<typeof import("@/lib/guardian-inquiry-service")>(
    "@/lib/guardian-inquiry-service"
  );
  return {
    ...actual,
    createGuardianInquiry: mocks.createGuardianInquiry,
    replyGuardianInquiry: mocks.replyGuardianInquiry,
    replyStaffInquiry: mocks.replyStaffInquiry,
    updateInquiryStatus: mocks.updateInquiryStatus,
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

import {
  submitGuardianInquiryAction,
  replyGuardianInquiryAction,
  replyStaffInquiryAction,
  updateStaffInquiryStatusAction,
  resolveGuardianInquiryAction,
} from "./guardian-inquiry-actions";

beforeEach(() => {
  mocks.requireGuardian.mockReset();
  mocks.requireStaff.mockReset();
  mocks.createGuardianInquiry.mockReset();
  mocks.replyGuardianInquiry.mockReset();
  mocks.replyStaffInquiry.mockReset();
  mocks.updateInquiryStatus.mockReset();
  mocks.revalidatePath.mockReset();
});

describe("guardian inquiry actions", () => {
  describe("submitGuardianInquiryAction", () => {
    it("delegates to createGuardianInquiry and revalidates path on success", async () => {
      mocks.requireGuardian.mockResolvedValue({
        userId: "user-1",
        guardians: [{ id: "g-1", organizationId: "org-1" }],
      });
      mocks.createGuardianInquiry.mockResolvedValue({ inquiryId: "inq-123" });

      const result = await submitGuardianInquiryAction({
        studentId: "00000000-0000-4000-8000-000000000001",
        category: "academic",
        title: "Science project clarification",
        message: "When is the project due for Class 5A?",
      });

      expect(result).toEqual({ success: true, inquiryId: "inq-123" });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    });

    it("returns validation error for short titles", async () => {
      mocks.requireGuardian.mockResolvedValue({
        userId: "user-1",
        guardians: [],
      });

      const result = await submitGuardianInquiryAction({
        studentId: "00000000-0000-4000-8000-000000000001",
        category: "academic",
        title: "No", // too short
        message: "Valid message here",
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toContain("at least 3 characters");
      }
      expect(mocks.createGuardianInquiry).not.toHaveBeenCalled();
    });
  });

  describe("replyStaffInquiryAction", () => {
    it("checks staff role and sends reply", async () => {
      mocks.requireStaff.mockResolvedValue({
        userId: "teacher-1",
        name: "Mr. Roberts",
        role: "teacher",
        organizationId: "org-1",
      });
      mocks.replyStaffInquiry.mockResolvedValue({
        messageId: "msg-456",
        status: "in_progress",
      });

      const result = await replyStaffInquiryAction({
        inquiryId: "00000000-0000-4000-8000-000000000005",
        message: "The deadline is Friday at 3pm.",
      });

      expect(result).toEqual({
        success: true,
        messageId: "msg-456",
        status: "in_progress",
      });
      expect(mocks.requireStaff).toHaveBeenCalledWith([
        "teacher",
        "school_admin",
        "office_staff",
      ]);
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    });
  });

  describe("updateStaffInquiryStatusAction", () => {
    it("updates inquiry status and revalidates", async () => {
      mocks.requireStaff.mockResolvedValue({
        userId: "admin-1",
        role: "school_admin",
        organizationId: "org-1",
      });
      mocks.updateInquiryStatus.mockResolvedValue({
        success: true,
        status: "resolved",
      });

      const result = await updateStaffInquiryStatusAction({
        inquiryId: "00000000-0000-4000-8000-000000000005",
        status: "resolved",
      });

      expect(result).toEqual({ success: true, status: "resolved" });
      expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    });
  });
});
