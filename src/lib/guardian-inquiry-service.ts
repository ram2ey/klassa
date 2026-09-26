import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  classes,
  enrollments,
  guardianInquiries,
  guardianInquiryMessages,
  guardians,
  studentGuardians,
  students,
  users,
} from "@/db/schema";
import { AuditActions, logAuditEvent } from "@/lib/audit";
import type { requireGuardian, requireStaff } from "@/lib/action-access";

export class GuardianInquiryError extends Error {}

export const inquiryCategoryEnum = z.enum([
  "academic",
  "pastoral",
  "attendance",
  "general",
]);
export type InquiryCategory = z.infer<typeof inquiryCategoryEnum>;

export const inquiryCategoryLabels: Record<InquiryCategory, string> = {
  academic: "Academic Progress & Homework",
  pastoral: "Pastoral Care & Wellbeing",
  attendance: "Attendance & Absence Follow-up",
  general: "General School Information",
};

export const inquiryStatusEnum = z.enum(["open", "in_progress", "resolved"]);
export type InquiryStatus = z.infer<typeof inquiryStatusEnum>;

export const createInquirySchema = z.object({
  studentId: z.string().uuid("Please select a student"),
  targetRole: z.enum(["teacher", "school_admin"]).default("teacher"),
  category: inquiryCategoryEnum,
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(180),
  message: z.string().trim().min(5, "Message must be at least 5 characters").max(5000),
});
export type CreateInquiryInput = z.input<typeof createInquirySchema>;

export const replyInquirySchema = z.object({
  inquiryId: z.string().uuid(),
  message: z.string().trim().min(1, "Message cannot be empty").max(5000),
});
export type ReplyInquiryInput = z.infer<typeof replyInquirySchema>;

export const updateInquiryStatusSchema = z.object({
  inquiryId: z.string().uuid(),
  status: inquiryStatusEnum,
});
export type UpdateInquiryStatusInput = z.infer<typeof updateInquiryStatusSchema>;

type GuardianAccount = Awaited<ReturnType<typeof requireGuardian>>;
type StaffAccount = Awaited<ReturnType<typeof requireStaff>>;

export async function createGuardianInquiry(
  account: GuardianAccount,
  raw: CreateInquiryInput
) {
  const input = createInquirySchema.parse(raw);
  const guardianIds = account.guardians.map((g) => g.id);

  return db.transaction(async (tx) => {
    const [authorizedLink] = await tx
      .select({
        guardianId: studentGuardians.guardianId,
        studentId: studentGuardians.studentId,
        organizationId: studentGuardians.organizationId,
      })
      .from(studentGuardians)
      .innerJoin(
        students,
        and(
          eq(students.id, studentGuardians.studentId),
          eq(students.organizationId, studentGuardians.organizationId)
        )
      )
      .where(
        and(
          inArray(studentGuardians.guardianId, guardianIds),
          eq(studentGuardians.studentId, input.studentId),
          eq(studentGuardians.hasLegalResponsibility, true)
        )
      )
      .limit(1);

    if (!authorizedLink) {
      throw new GuardianInquiryError(
        "You do not have permission to submit an inquiry for this student."
      );
    }

    const [activeEnrollment] = await tx
      .select({ classId: enrollments.classId })
      .from(enrollments)
      .where(
        and(
          eq(enrollments.studentId, input.studentId),
          eq(enrollments.status, "active")
        )
      )
      .limit(1);

    const [inquiry] = await tx
      .insert(guardianInquiries)
      .values({
        organizationId: authorizedLink.organizationId,
        guardianId: authorizedLink.guardianId,
        studentId: input.studentId,
        classId: activeEnrollment?.classId ?? null,
        targetRole: input.targetRole,
        title: input.title,
        category: input.category,
        status: "open",
      })
      .returning({ id: guardianInquiries.id });

    if (!inquiry) {
      throw new GuardianInquiryError("Failed to create the inquiry record.");
    }

    const [message] = await tx
      .insert(guardianInquiryMessages)
      .values({
        organizationId: authorizedLink.organizationId,
        inquiryId: inquiry.id,
        senderType: "guardian",
        senderUserId: account.userId,
        senderName: account.name,
        message: input.message,
      })
      .returning({ id: guardianInquiryMessages.id });

    await logAuditEvent(
      {
        organizationId: authorizedLink.organizationId,
        actorUserId: account.userId,
        action: AuditActions.GUARDIAN_INQUIRY_CREATED,
        entityType: "guardian_inquiry",
        entityId: inquiry.id,
        metadata: {
          studentId: input.studentId,
          category: input.category,
          targetRole: input.targetRole,
          title: input.title,
          initialMessageId: message.id,
        },
      },
      tx
    );

    return { inquiryId: inquiry.id };
  });
}

export async function replyGuardianInquiry(
  account: GuardianAccount,
  raw: ReplyInquiryInput
) {
  const input = replyInquirySchema.parse(raw);
  const guardianIds = account.guardians.map((g) => g.id);

  return db.transaction(async (tx) => {
    const [inquiry] = await tx
      .select()
      .from(guardianInquiries)
      .where(
        and(
          eq(guardianInquiries.id, input.inquiryId),
          inArray(guardianInquiries.guardianId, guardianIds)
        )
      )
      .for("update");

    if (!inquiry) {
      throw new GuardianInquiryError("Inquiry thread not found or access denied.");
    }

    const [message] = await tx
      .insert(guardianInquiryMessages)
      .values({
        organizationId: inquiry.organizationId,
        inquiryId: inquiry.id,
        senderType: "guardian",
        senderUserId: account.userId,
        senderName: account.name,
        message: input.message,
      })
      .returning({ id: guardianInquiryMessages.id });

    const isReopening = inquiry.status === "resolved";
    const newStatus: InquiryStatus = isReopening ? "open" : inquiry.status;

    await tx
      .update(guardianInquiries)
      .set({
        status: newStatus,
        closedAt: isReopening ? null : inquiry.closedAt,
        closedBy: isReopening ? null : inquiry.closedBy,
        updatedAt: new Date(),
      })
      .where(eq(guardianInquiries.id, inquiry.id));

    await logAuditEvent(
      {
        organizationId: inquiry.organizationId,
        actorUserId: account.userId,
        action: AuditActions.GUARDIAN_INQUIRY_REPLIED,
        entityType: "guardian_inquiry_message",
        entityId: message.id,
        metadata: {
          inquiryId: inquiry.id,
          senderType: "guardian",
          reopened: inquiry.status === "resolved",
        },
      },
      tx
    );

    return { messageId: message.id, status: newStatus };
  });
}

export async function replyStaffInquiry(
  actor: StaffAccount,
  raw: ReplyInquiryInput
) {
  const input = replyInquirySchema.parse(raw);

  return db.transaction(async (tx) => {
    const [inquiry] = await tx
      .select()
      .from(guardianInquiries)
      .where(
        and(
          eq(guardianInquiries.id, input.inquiryId),
          eq(guardianInquiries.organizationId, actor.organizationId)
        )
      )
      .for("update");

    if (!inquiry) {
      throw new GuardianInquiryError("Inquiry thread not found in this school.");
    }

    const senderType =
      actor.role === "teacher"
        ? "teacher"
        : actor.role === "office_staff"
        ? "office_staff"
        : "school_admin";

    const [message] = await tx
      .insert(guardianInquiryMessages)
      .values({
        organizationId: inquiry.organizationId,
        inquiryId: inquiry.id,
        senderType,
        senderUserId: actor.userId,
        senderName: actor.name,
        message: input.message,
      })
      .returning({ id: guardianInquiryMessages.id });

    const newStatus: InquiryStatus =
      inquiry.status === "open" ? "in_progress" : inquiry.status;

    await tx
      .update(guardianInquiries)
      .set({
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(guardianInquiries.id, inquiry.id));

    await logAuditEvent(
      {
        organizationId: inquiry.organizationId,
        actorUserId: actor.userId,
        action: AuditActions.GUARDIAN_INQUIRY_REPLIED,
        entityType: "guardian_inquiry_message",
        entityId: message.id,
        metadata: {
          inquiryId: inquiry.id,
          senderType,
          newStatus,
        },
      },
      tx
    );

    return { messageId: message.id, status: newStatus };
  });
}

export async function updateInquiryStatus(
  actor: {
    userId: string;
    organizationId?: string;
    guardians?: { id: string; organizationId: string }[];
  },
  raw: UpdateInquiryStatusInput
) {
  const input = updateInquiryStatusSchema.parse(raw);

  return db.transaction(async (tx) => {
    const [inquiry] = await tx
      .select()
      .from(guardianInquiries)
      .where(eq(guardianInquiries.id, input.inquiryId))
      .for("update");

    if (!inquiry) {
      throw new GuardianInquiryError("Inquiry not found.");
    }

    const isGuardianOwner = actor.guardians?.some(
      (g) =>
        g.id === inquiry.guardianId && g.organizationId === inquiry.organizationId
    );
    const isSchoolStaff = actor.organizationId === inquiry.organizationId;

    if (!isGuardianOwner && !isSchoolStaff) {
      throw new GuardianInquiryError("Access denied to update this inquiry.");
    }

    const isResolving = input.status === "resolved";

    await tx
      .update(guardianInquiries)
      .set({
        status: input.status,
        closedAt: isResolving ? new Date() : null,
        closedBy: isResolving ? actor.userId : null,
        updatedAt: new Date(),
      })
      .where(eq(guardianInquiries.id, inquiry.id));

    await logAuditEvent(
      {
        organizationId: inquiry.organizationId,
        actorUserId: actor.userId,
        action: AuditActions.GUARDIAN_INQUIRY_STATUS_UPDATED,
        entityType: "guardian_inquiry",
        entityId: inquiry.id,
        metadata: {
          previousStatus: inquiry.status,
          newStatus: input.status,
        },
      },
      tx
    );

    return { success: true, status: input.status };
  });
}

export type SerializedInquiryMessage = {
  id: string;
  senderType: "guardian" | "teacher" | "school_admin" | "office_staff";
  senderUserId: string | null;
  senderName: string;
  message: string;
  createdAt: string | Date;
};

export type SerializedGuardianInquiry = {
  id: string;
  studentId: string;
  studentName: string;
  studentNumber: string;
  guardianId: string;
  guardianName: string;
  guardianPhone?: string | null;
  guardianEmail?: string | null;
  classId: string | null;
  className: string;
  targetRole: string;
  title: string;
  category: InquiryCategory;
  categoryLabel?: string;
  status: InquiryStatus;
  closedAt: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  messages: SerializedInquiryMessage[];
};
