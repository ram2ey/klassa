"use server";

import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/action-access";
import { previewParentSmsRecipients, queueParentSmsAnnouncement, type ParentSmsInput, type ParentSmsQueueInput } from "@/lib/parent-sms-service";

function message(error: unknown) { return error instanceof Error ? error.message : "The SMS announcement could not be completed."; }

export async function previewParentSmsAction(input: ParentSmsInput) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  try { return { success: true as const, ...await previewParentSmsRecipients(actor, input) }; }
  catch (error) { return { success: false as const, error: message(error) }; }
}

export async function queueParentSmsAction(input: ParentSmsQueueInput) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  try {
    const result = await queueParentSmsAnnouncement(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: message(error) }; }
}
