"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireGuardian, requireStaff } from "@/lib/action-access";
import {
  createGuardianInquiry,
  replyGuardianInquiry,
  replyStaffInquiry,
  updateInquiryStatus,
  createInquirySchema,
  replyInquirySchema,
  updateInquiryStatusSchema,
  GuardianInquiryError,
  type CreateInquiryInput,
  type ReplyInquiryInput,
  type UpdateInquiryStatusInput,
} from "@/lib/guardian-inquiry-service";

export async function submitGuardianInquiryAction(raw: CreateInquiryInput) {
  const account = await requireGuardian();
  try {
    const input = createInquirySchema.parse(raw);
    const result = await createGuardianInquiry(account, input);
    revalidatePath("/");
    return { success: true as const, inquiryId: result.inquiryId };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0]?.message ?? "Check the form." };
    }
    if (error instanceof GuardianInquiryError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "The inquiry could not be sent. Please refresh and try again.",
    };
  }
}

export async function replyGuardianInquiryAction(raw: ReplyInquiryInput) {
  const account = await requireGuardian();
  try {
    const input = replyInquirySchema.parse(raw);
    const result = await replyGuardianInquiry(account, input);
    revalidatePath("/");
    return { success: true as const, messageId: result.messageId, status: result.status };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0]?.message ?? "Check the message." };
    }
    if (error instanceof GuardianInquiryError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "Your reply could not be sent. Please try again.",
    };
  }
}

export async function replyStaffInquiryAction(raw: ReplyInquiryInput) {
  const actor = await requireStaff(["teacher", "school_admin", "office_staff"]);
  try {
    const input = replyInquirySchema.parse(raw);
    const result = await replyStaffInquiry(actor, input);
    revalidatePath("/");
    return { success: true as const, messageId: result.messageId, status: result.status };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0]?.message ?? "Check the message." };
    }
    if (error instanceof GuardianInquiryError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "Staff reply could not be sent. Please try again.",
    };
  }
}

export async function updateStaffInquiryStatusAction(raw: UpdateInquiryStatusInput) {
  const actor = await requireStaff(["teacher", "school_admin", "office_staff"]);
  try {
    const input = updateInquiryStatusSchema.parse(raw);
    const result = await updateInquiryStatus(
      { userId: actor.userId, organizationId: actor.organizationId },
      input
    );
    revalidatePath("/");
    return { success: true as const, status: result.status };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0]?.message ?? "Check the status." };
    }
    if (error instanceof GuardianInquiryError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "Status could not be updated. Please try again.",
    };
  }
}

export async function resolveGuardianInquiryAction(inquiryId: string) {
  const account = await requireGuardian();
  try {
    const input = updateInquiryStatusSchema.parse({ inquiryId, status: "resolved" });
    const result = await updateInquiryStatus(
      { userId: account.userId, guardians: account.guardians },
      input
    );
    revalidatePath("/");
    return { success: true as const, status: result.status };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false as const, error: error.issues[0]?.message ?? "Invalid inquiry." };
    }
    if (error instanceof GuardianInquiryError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "Could not resolve inquiry. Please try again.",
    };
  }
}
