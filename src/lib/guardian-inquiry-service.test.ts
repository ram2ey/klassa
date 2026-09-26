// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  commit: vi.fn(),
  rollback: vi.fn(),
}));

vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) {
      const result = mocks.execute(sql, params);
      return Object.assign(result, { values: () => result });
    },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> {
      try {
        const result = await operation(client);
        mocks.commit();
        return result;
      } catch (error) {
        mocks.rollback();
        throw error;
      }
    },
  };
  return { db: drizzle(client as unknown as Sql) };
});

import {
  createGuardianInquiry,
  replyGuardianInquiry,
  replyStaffInquiry,
  updateInquiryStatus,
} from "./guardian-inquiry-service";

const schoolId = "00000000-0000-4000-8000-000000000001";
const guardianId = "00000000-0000-4000-8000-000000000002";
const studentId = "00000000-0000-4000-8000-000000000003";
const classId = "00000000-0000-4000-8000-000000000004";
const inquiryId = "00000000-0000-4000-8000-000000000005";
const messageId = "00000000-0000-4000-8000-000000000006";

const guardianAccount = {
  userId: "guardian-user-1",
  name: "Jane Smith",
  guardians: [{ id: guardianId, organizationId: schoolId }],
};

const staffAccount = {
  userId: "teacher-user-1",
  name: "Mr. Brown",
  role: "teacher" as const,
  organizationId: schoolId,
};

beforeEach(() => {
  mocks.execute.mockReset();
  mocks.commit.mockClear();
  mocks.rollback.mockClear();

  mocks.execute.mockImplementation(async (query) => {
    if (query.includes('from "student_guardians"')) {
      return [[guardianId, studentId, schoolId]];
    }
    if (query.includes('from "enrollments"')) {
      return [[classId]];
    }
    if (query.startsWith('insert into "guardian_inquiries"')) {
      return [[inquiryId]];
    }
    if (query.startsWith('insert into "guardian_inquiry_messages"')) {
      return [[messageId]];
    }
    if (query.startsWith('insert into "audit_events"')) {
      return [["audit-1"]];
    }
    return [];
  });
});

describe("guardian inquiry service", () => {
  describe("createGuardianInquiry", () => {
    it("successfully creates inquiry and initial message when guardian is authorized", async () => {
      const result = await createGuardianInquiry(guardianAccount, {
        studentId,
        category: "academic",
        targetRole: "teacher",
        title: "Question regarding Math homework",
        message: "Could you clarify problem #4 on the worksheet?",
      });

      expect(result).toEqual({ inquiryId });
      expect(mocks.commit).toHaveBeenCalledOnce();

      const insertInquiry = mocks.execute.mock.calls.find(([query]) =>
        query.startsWith('insert into "guardian_inquiries"')
      );
      expect(insertInquiry).toBeDefined();
      expect(insertInquiry![1]).toEqual(
        expect.arrayContaining([
          schoolId,
          guardianId,
          studentId,
          "Question regarding Math homework",
          "academic",
          "open",
        ])
      );

      const insertMessage = mocks.execute.mock.calls.find(([query]) =>
        query.startsWith('insert into "guardian_inquiry_messages"')
      );
      expect(insertMessage).toBeDefined();
      expect(insertMessage![1]).toEqual(
        expect.arrayContaining([
          schoolId,
          inquiryId,
          "guardian",
          "Jane Smith",
          "Could you clarify problem #4 on the worksheet?",
        ])
      );
    });

    it("rejects when guardian lacks legal responsibility for the student", async () => {
      mocks.execute.mockImplementation(async (query) => {
        if (query.includes('from "student_guardians"')) return [];
        return [];
      });

      await expect(
        createGuardianInquiry(guardianAccount, {
          studentId,
          category: "general",
          title: "Inquiry without access",
          message: "This should be rejected.",
        })
      ).rejects.toThrow("permission to submit an inquiry");

      expect(mocks.rollback).toHaveBeenCalledOnce();
    });
  });

  describe("replyGuardianInquiry", () => {
    it("posts reply and reopens inquiry if it was resolved", async () => {
      mocks.execute.mockImplementation(async (query) => {
        if (query.includes('from "guardian_inquiries"')) {
          return [
            [
              inquiryId,
              schoolId,
              guardianId,
              studentId,
              classId,
              null,
              "teacher",
              "Math Homework",
              "academic",
              "resolved",
              new Date(),
              "staff-user",
              new Date(),
              new Date(),
            ],
          ];
        }
        if (query.startsWith('insert into "guardian_inquiry_messages"')) {
          return [[messageId]];
        }
        if (query.startsWith('update "guardian_inquiries"')) {
          return [];
        }
        return [];
      });

      const result = await replyGuardianInquiry(guardianAccount, {
        inquiryId,
        message: "I have a follow up question on the solution.",
      });

      expect(result).toEqual({ messageId, status: "open" });
      expect(mocks.commit).toHaveBeenCalledOnce();

      const updateCall = mocks.execute.mock.calls.find(([query]) =>
        query.startsWith('update "guardian_inquiries"')
      );
      expect(updateCall).toBeDefined();
      expect(updateCall![1]).toContain("open");
    });
  });

  describe("replyStaffInquiry", () => {
    it("posts staff reply and transitions open inquiry to in_progress", async () => {
      mocks.execute.mockImplementation(async (query) => {
        if (query.includes('from "guardian_inquiries"')) {
          return [
            [
              inquiryId,
              schoolId,
              guardianId,
              studentId,
              classId,
              null,
              "teacher",
              "Math Homework",
              "academic",
              "open",
              null,
              null,
              new Date(),
              new Date(),
            ],
          ];
        }
        if (query.startsWith('insert into "guardian_inquiry_messages"')) {
          return [[messageId]];
        }
        if (query.startsWith('update "guardian_inquiries"')) {
          return [];
        }
        return [];
      });

      const result = await replyStaffInquiry(staffAccount, {
        inquiryId,
        message: "Hello Mrs. Smith, problem #4 involves prime factorization.",
      });

      expect(result).toEqual({ messageId, status: "in_progress" });
      expect(mocks.commit).toHaveBeenCalledOnce();

      const insertCall = mocks.execute.mock.calls.find(([query]) =>
        query.startsWith('insert into "guardian_inquiry_messages"')
      );
      expect(insertCall![1]).toEqual(
        expect.arrayContaining([
          schoolId,
          inquiryId,
          "teacher",
          "Mr. Brown",
          "Hello Mrs. Smith, problem #4 involves prime factorization.",
        ])
      );
    });
  });

  describe("updateInquiryStatus", () => {
    it("resolves an inquiry and records closure timestamp and actor", async () => {
      mocks.execute.mockImplementation(async (query) => {
        if (query.includes('from "guardian_inquiries"')) {
          return [
            [
              inquiryId,
              schoolId,
              guardianId,
              studentId,
              classId,
              null,
              "teacher",
              "Math Homework",
              "academic",
              "in_progress",
              null,
              null,
              new Date(),
              new Date(),
            ],
          ];
        }
        if (query.startsWith('update "guardian_inquiries"')) {
          return [];
        }
        return [];
      });

      const result = await updateInquiryStatus(
        { userId: "teacher-user-1", organizationId: schoolId },
        { inquiryId, status: "resolved" }
      );

      expect(result).toEqual({ success: true, status: "resolved" });
      expect(mocks.commit).toHaveBeenCalledOnce();

      const updateCall = mocks.execute.mock.calls.find(([query]) =>
        query.startsWith('update "guardian_inquiries"')
      );
      expect(updateCall![1]).toContain("resolved");
      expect(updateCall![1]).toContain("teacher-user-1");
    });
  });
});
