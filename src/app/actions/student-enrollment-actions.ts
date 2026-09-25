"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { enrollSchoolStudent, type EnrollmentInput } from "@/lib/student-enrollment";
import { SchoolAdminError } from "@/lib/school-admin-policy";

export async function enrollStudentAction(input: EnrollmentInput) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  try {
    const result = await enrollSchoolStudent(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the enrollment details." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    return { success: false as const, error: "Enrollment could not be saved. Check the details and try again." };
  }
}
