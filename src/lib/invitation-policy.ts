import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { phoneNumberSchema } from "@/lib/phone";

export const invitationTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, "Invalid invitation.");
export const invitationAcceptanceSchema = z.object({
  token: invitationTokenSchema,
  phoneNumber: phoneNumberSchema,
  name: z.string().trim().min(2).max(180),
  password: z.string().min(12, "Use at least 12 characters.").max(128).optional(),
});
export const INVITATION_LIFETIME_MS = 48 * 60 * 60 * 1000;
export function hashInvitationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
export function newInvitationToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashInvitationToken(token) };
}
export function isInvitationActive(invitation: { acceptedAt: Date | null; revokedAt: Date | null; expiresAt: Date }, now = new Date()) {
  return !invitation.acceptedAt && !invitation.revokedAt && invitation.expiresAt > now;
}
export function invitationUrl(token: string) {
  const base = new URL(process.env.BETTER_AUTH_URL ?? "http://localhost:3000");
  if (process.env.NODE_ENV === "production" && base.protocol !== "https:") throw new Error("Invitation delivery requires an HTTPS application URL.");
  // A fragment keeps the bearer token out of web-server access logs and referrers.
  return new URL(`/accept-invitation#${token}`, base.origin).toString();
}

export class InvitationError extends Error {}
