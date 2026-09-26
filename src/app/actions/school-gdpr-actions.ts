"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { createSchoolGdprRequest, decideSchoolGdprRequest, generateSchoolGdprExtract,
  SchoolGdprError, type GdprDecisionInput, type GdprRequestInput } from "@/lib/school-gdpr-service";

function failure(error: unknown) {
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Check the request details.";
  if (error instanceof SchoolGdprError) return error.message;
  return "The data rights request could not be saved. Refresh and try again.";
}

export async function createSchoolGdprRequestAction(input: GdprRequestInput) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await createSchoolGdprRequest(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: failure(error) }; }
}

export async function generateSchoolGdprExtractAction(requestId: string) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const extract = await generateSchoolGdprExtract(actor, requestId);
    revalidatePath("/");
    return { success: true as const, extract };
  } catch (error) { return { success: false as const, error: failure(error) }; }
}

export async function decideSchoolGdprRequestAction(input: GdprDecisionInput) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await decideSchoolGdprRequest(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: failure(error) }; }
}
