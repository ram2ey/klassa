"use server";
import { requireDeferredFeature } from "@/lib/mvp-release";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { recordGuardianSmsPreferences, SchoolConsentError, staffSmsPreferencesSchema } from "@/lib/guardian-school-consent-service";

export async function recordGuardianSmsPreferencesAction(input: z.input<typeof staffSmsPreferencesSchema>) {
  const actor = await requireStaff(["office_staff", "school_admin"]);
  requireDeferredFeature("Parent SMS");
  try {
    await recordGuardianSmsPreferences(actor, input);
    revalidatePath("/");
    return { success: true as const };
  } catch (error) {
    const message = error instanceof z.ZodError ? error.issues[0]?.message :
      error instanceof SchoolConsentError ? error.message : undefined;
    return { success: false as const, error: message ?? "SMS preferences could not be saved. Try again." };
  }
}
