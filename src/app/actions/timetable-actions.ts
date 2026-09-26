"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import {
  saveTimetablePeriod,
  deleteTimetablePeriod,
  saveTimetablePeriodSchema,
  deleteTimetablePeriodSchema,
  TimetableError,
  type SaveTimetablePeriodInput,
  type DeleteTimetablePeriodInput,
} from "@/lib/timetable-service";

export async function saveTimetablePeriodAction(raw: SaveTimetablePeriodInput) {
  const actor = await requireStaff(["school_admin", "teacher"]);
  try {
    const input = saveTimetablePeriodSchema.parse(raw);
    const result = await saveTimetablePeriod(actor, input);
    revalidatePath("/");
    return { success: true as const, periodId: result.periodId };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues[0]?.message ?? "Invalid timetable schedule details.",
      };
    }
    if (error instanceof TimetableError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "The timetable period could not be saved. Please try again.",
    };
  }
}

export async function deleteTimetablePeriodAction(
  raw: DeleteTimetablePeriodInput
) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const input = deleteTimetablePeriodSchema.parse(raw);
    await deleteTimetablePeriod(actor, input);
    revalidatePath("/");
    return { success: true as const };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false as const,
        error: error.issues[0]?.message ?? "Invalid period identifier.",
      };
    }
    if (error instanceof TimetableError) {
      return { success: false as const, error: error.message };
    }
    return {
      success: false as const,
      error: "The timetable period could not be removed. Please try again.",
    };
  }
}
