"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { bulkUpdateSchoolStudents, saveSchoolRecord } from "@/lib/school-admin-service";
import { SchoolAdminError, type BulkStudentUpdate, type SchoolCommand } from "@/lib/school-admin-policy";
import { importSchoolStudents } from "@/lib/school-student-import";

export async function saveSchoolRecordAction(input: SchoolCommand) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await saveSchoolRecord(actor, input);
    revalidatePath("/");
    revalidatePath("/platform");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check your form entries." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    const cause = error instanceof Error ? error.cause : undefined;
    if ((cause && typeof cause === "object" && "code" in cause && cause.code === "23505") ||
      (typeof error === "object" && error && "code" in error && error.code === "23505")) {
      return { success: false as const, error: "This subject code or record already exists in your school." };
    }
    return { success: false as const, error: "The change could not be saved. Check your connection and try again." };
  }
}

export async function bulkUpdateSchoolStudentsAction(input: BulkStudentUpdate) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await bulkUpdateSchoolStudents(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check your selections." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    return { success: false as const, error: "The bulk update could not be saved. Refresh the directory and try again." };
  }
}

export async function importStudentsAction(csvText: string) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await importSchoolStudents(actor, csvText);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    return { success: false as const, error: "Import failed. Check the file and try again." };
  }
}
