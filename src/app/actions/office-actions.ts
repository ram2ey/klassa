"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { SchoolAdminError, type SchoolCommand } from "@/lib/school-admin-policy";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";
import { saveSchoolRecord } from "@/lib/school-admin-service";
import { saveSchoolWorkflow } from "@/lib/school-workflow-service";
import { importSchoolStudents } from "@/lib/school-student-import";

function failure(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the form entries.";
  if (error instanceof SchoolAdminError) return error.message;
  const cause = error instanceof Error ? error.cause : undefined;
  if ((cause && typeof cause === "object" && "code" in cause && cause.code === "23505") ||
    (typeof error === "object" && error && "code" in error && error.code === "23505")) return "A record with these details already exists.";
  return "The change could not be saved. Check your connection and try again.";
}

export async function saveOfficeRecordAction(input: SchoolCommand) {
  const actor = await requireStaff(["office_staff"]);
  try {
    const result = await saveSchoolRecord(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: failure(error) }; }
}

export async function correctOfficeAttendanceAction(input: WorkflowCommand) {
  const actor = await requireStaff(["office_staff"]);
  try {
    const result = await saveSchoolWorkflow(actor, input);
    revalidatePath("/");
    return { success: true as const, entityId: result.entityId };
  } catch (error) { return { success: false as const, error: failure(error) }; }
}

export async function importOfficeStudentsAction(csvText: string) {
  const actor = await requireStaff(["office_staff"]);
  try {
    const result = await importSchoolStudents(actor, csvText);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: failure(error) }; }
}
