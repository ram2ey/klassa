"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { approveSchoolRollover, getSchoolRolloverPreview, RolloverError, type RolloverInput } from "@/lib/school-rollover";

function message(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Review the placements.";
  return error instanceof RolloverError ? error.message : "Rollover could not be completed. Refresh and try again.";
}

export async function previewSchoolRolloverAction(targetYearId: string) {
  const actor = await requireStaff(["school_admin"]);
  try { return { success: true as const, preview: await getSchoolRolloverPreview(actor, targetYearId) }; }
  catch (error) { return { success: false as const, error: message(error) }; }
}

export async function approveSchoolRolloverAction(input: RolloverInput) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await approveSchoolRollover(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: message(error) }; }
}
