"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { acceptSchoolInvitation, inspectSchoolInvitation, issueSchoolInvitation, revokeSchoolInvitation } from "@/lib/school-invitations";
import { InvitationError } from "@/lib/invitation-policy";

function message(error: unknown) {
  if (error instanceof InvitationError) return error.message;
  if (error instanceof z.ZodError) return error.issues[0]?.message ?? "Invalid input.";
  return "The operation could not be completed. Check your access and connection, then refresh before retrying.";
}

export async function sendSchoolInvitationAction(input: Parameters<typeof issueSchoolInvitation>[0], invitationId?: string) {
  try {
    const result = await issueSchoolInvitation(input, invitationId);
    revalidatePath("/platform");
    return { success: true as const, ...result };
  } catch (error) { return { success: false as const, error: message(error) }; }
}

export async function revokeSchoolInvitationAction(id: string) {
  try { await revokeSchoolInvitation(id); revalidatePath("/platform"); return { success: true as const }; }
  catch (error) { return { success: false as const, error: message(error) }; }
}

export async function inspectSchoolInvitationAction(token: string) {
  try { return { success: true as const, invitation: await inspectSchoolInvitation(token) }; }
  catch (error) { return { success: false as const, error: message(error) }; }
}

export async function acceptSchoolInvitationAction(input: Parameters<typeof acceptSchoolInvitation>[0]) {
  try { return { success: true as const, ...await acceptSchoolInvitation(input) }; }
  catch (error) { return { success: false as const, error: message(error) }; }
}
