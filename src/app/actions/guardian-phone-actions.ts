"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { guardians } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { logAuditEvent } from "@/lib/audit";
import { normalizePhoneNumber } from "@/lib/sms";

export async function confirmGuardianPhoneAction(raw: { guardianId: string; confirmedPhone: string; evidence: string }) {
  const actor = await requireStaff(["office_staff", "school_admin"]);
  const input = z.object({ guardianId: z.uuid(), confirmedPhone: z.string().trim(),
    evidence: z.string().trim().min(8).max(500) }).parse(raw);
  const phone = normalizePhoneNumber(input.confirmedPhone);
  if (!/^\+233\d{9}$/.test(phone)) return { success: false as const, error: "Use a valid Ghana mobile number." };
  try {
    await db.transaction(async tx => {
      const [guardian] = await tx.select().from(guardians).where(and(eq(guardians.id, input.guardianId),
        eq(guardians.organizationId, actor.organizationId))).for("update");
      if (!guardian || normalizePhoneNumber(guardian.phone ?? "") !== phone) throw new Error("Phone does not match the current guardian record.");
      await tx.update(guardians).set({ phoneVerifiedAt: new Date(), phoneVerifiedBy: actor.userId, updatedAt: new Date() })
        .where(and(eq(guardians.id, guardian.id), eq(guardians.organizationId, actor.organizationId)));
      await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
        action: "guardian.phone_confirmed", entityType: "guardian", entityId: guardian.id,
        metadata: { evidence: input.evidence, lastFour: phone.slice(-4) } }, tx);
    });
    revalidatePath("/");
    return { success: true as const };
  } catch (error) { return { success: false as const, error: error instanceof Error ? error.message : "Confirmation failed." }; }
}
