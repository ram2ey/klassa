"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { SchoolAdminError } from "@/lib/school-admin-policy";
import { saveSchoolWorkflow } from "@/lib/school-workflow-service";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";
import { approveEmergencyBroadcast, getPendingEmergencyBroadcasts } from "@/lib/emergency-broadcast-service";

export async function pendingEmergencyBroadcastsAction() {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  return getPendingEmergencyBroadcasts(actor);
}

export async function approveEmergencyBroadcastAction(id: string) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  try {
    const result = await approveEmergencyBroadcast(actor, id);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Approval failed." };
  }
}

export async function saveSchoolWorkflowAction(input: WorkflowCommand) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  try {
    const result = await saveSchoolWorkflow(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the form." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    const cause = error instanceof Error ? error.cause : undefined;
    if ((cause && typeof cause === "object" && "code" in cause && cause.code === "23505") ||
      (typeof error === "object" && error && "code" in error && error.code === "23505")) return { success: false as const, error: "A record with these details already exists." };
    return { success: false as const, error: "The change could not be saved. Check your connection and try again." };
  }
}
