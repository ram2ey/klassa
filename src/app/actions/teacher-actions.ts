"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { SchoolAdminError } from "@/lib/school-admin-policy";
import { saveSchoolWorkflow } from "@/lib/school-workflow-service";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";

export async function saveTeacherWorkflowAction(input: WorkflowCommand) {
  const actor = await requireStaff(["teacher"]);
  try {
    const result = await saveSchoolWorkflow(actor, input);
    revalidatePath("/");
    return { success: true as const, entityId: result.entityId };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the form." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    return { success: false as const, error: "The change could not be saved. Check your connection and try again." };
  }
}
