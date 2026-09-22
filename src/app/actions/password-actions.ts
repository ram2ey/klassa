"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12, "Use at least 12 characters.").max(128),
  confirmation: z.string(),
}).superRefine((value, context) => {
  if (value.newPassword !== value.confirmation) {
    context.addIssue({ code: "custom", path: ["confirmation"], message: "The new passwords do not match." });
  }
  if (value.newPassword === value.currentPassword) {
    context.addIssue({ code: "custom", path: ["newPassword"], message: "Choose a password different from the temporary password." });
  }
});

export async function changeTemporaryPasswordAction(raw: z.input<typeof passwordChangeSchema>) {
  const parsed = passwordChangeSchema.safeParse(raw);
  if (!parsed.success) return { success: false as const, error: parsed.error.issues[0]?.message ?? "Invalid password." };

  const requestHeaders = await headers();
  const auth = getAuth();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return { success: false as const, error: "Sign in again before changing your password." };

  const [user] = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
  if (!user) return { success: false as const, error: "Account not found." };
  if (!user.mustChangePassword) return { success: true as const };

  try {
    await auth.api.changePassword({
      headers: requestHeaders,
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        revokeOtherSessions: true,
      },
    });
  } catch {
    return { success: false as const, error: "The temporary password is incorrect or the password could not be changed." };
  }

  await db.transaction(async tx => {
    await tx.update(users).set({ mustChangePassword: false, updatedAt: new Date() })
      .where(and(eq(users.id, user.id), eq(users.mustChangePassword, true)));
    if (user.organizationId) {
      await logAuditEvent({
        organizationId: user.organizationId,
        actorUserId: user.id,
        action: "account.temporary_password_changed",
        entityType: "user",
        entityId: user.id,
      }, tx);
    }
  });

  return { success: true as const };
}
