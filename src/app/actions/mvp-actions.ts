"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireLiveMode, requireStaff } from "@/lib/action-access";
import { SchoolAdminError } from "@/lib/school-admin-policy";
import { saveMvpCommand } from "@/lib/mvp-service";
import type { MvpCommand } from "@/lib/mvp-policy";

export async function saveMvpAction(input: MvpCommand) {
  requireLiveMode();
  const actor = await requireStaff(["school_admin", "office_staff", "teacher"]);
  try {
    const result = await saveMvpCommand(actor, input);
    revalidatePath("/");
    revalidatePath("/reports", "layout");
    revalidatePath("/fees", "layout");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check the form." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    const cause = error instanceof Error ? error.cause : undefined;
    const code = error && typeof error === "object" && "code" in error ? error.code : cause && typeof cause === "object" && "code" in cause ? cause.code : null;
    if (code === "23505") return { success: false as const, error: "This record already exists. Each pupil can have only one opening balance, and class fee names must be unique within a term." };
    return { success: false as const, error: "The change could not be saved. Check your connection and retry the same request." };
  }
}
