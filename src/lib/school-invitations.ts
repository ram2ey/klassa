import { randomUUID } from "node:crypto";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { db } from "@/db";
import { accounts, auditEvents, invitationSmsLimits, organizationMemberships, organizations, rateLimitLogs,
  sessions, smsInvitations, staffRole, users } from "@/db/schema";
import { requireLiveMode, requirePlatformAdmin } from "@/lib/action-access";
import { getAuth } from "@/lib/auth";
import { logAuditEvent } from "@/lib/audit";
import { getSmsProvider } from "@/lib/sms";
import { maskPhoneNumber, phoneNumberSchema } from "@/lib/phone";
import { loginUsername } from "@/lib/login-identity";
import { hashInvitationToken, invitationAcceptanceSchema, invitationTokenSchema, invitationUrl, INVITATION_LIFETIME_MS,
  InvitationError, isInvitationActive, newInvitationToken } from "@/lib/invitation-policy";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
const issueSchema = z.object({ organizationId: z.uuid(), phoneNumber: phoneNumberSchema, role: z.enum(staffRole.enumValues) });

async function reserveQuota(tx: Transaction, key: string, max: number, windowMs: number, cooldownMs: number, now: Date) {
  const cutoff = new Date(now.getTime() - windowMs).toISOString();
  const cooldown = new Date(now.getTime() - cooldownMs).toISOString();
  const [reserved] = await tx.insert(invitationSmsLimits).values({ key, attempts: 1, windowStartsAt: now, lastAttemptAt: now })
    .onConflictDoUpdate({ target: invitationSmsLimits.key, set: {
      attempts: sql`case when ${invitationSmsLimits.windowStartsAt} <= ${cutoff}::timestamptz then 1 else ${invitationSmsLimits.attempts} + 1 end`,
      windowStartsAt: sql`case when ${invitationSmsLimits.windowStartsAt} <= ${cutoff}::timestamptz then ${now.toISOString()}::timestamptz else ${invitationSmsLimits.windowStartsAt} end`,
      lastAttemptAt: now,
    }, setWhere: sql`${invitationSmsLimits.lastAttemptAt} <= ${cooldown}::timestamptz and (${invitationSmsLimits.windowStartsAt} <= ${cutoff}::timestamptz or ${invitationSmsLimits.attempts} < ${max})` })
    .returning({ key: invitationSmsLimits.key });
  if (!reserved) throw new InvitationError("SMS limit reached. Wait before trying again (one per minute and five per number per day).");
}

/** Tokens never enter audit metadata, client responses or the delivery-status table. */
async function sendInvitation(invitation: typeof smsInvitations.$inferSelect, token: string) {
  let result: Awaited<ReturnType<ReturnType<typeof getSmsProvider>["send"]>>;
  try {
    result = await getSmsProvider().send(invitation.phoneNumber,
      `Klassa: You have been invited to a school workspace. Activate within 48 hours: ${invitationUrl(token)} Ignore this message if unexpected.`);
  } catch { result = { success: false, providerRef: "" }; }
  // A delayed response from an older send must never overwrite a resend or revocation.
  await db.update(smsInvitations).set({ deliveryStatus: result.success ? "sent" : "failed",
    providerRef: result.providerRef || null, updatedAt: new Date() })
    .where(and(eq(smsInvitations.id, invitation.id), eq(smsInvitations.tokenHash, invitation.tokenHash), isNull(smsInvitations.revokedAt)));
  return { id: invitation.id, deliveryStatus: result.success ? "sent" as const : "failed" as const };
}

export async function issueSchoolInvitation(raw: z.input<typeof issueSchema>, invitationId?: string) {
  const actor = await requirePlatformAdmin();
  const input = issueSchema.parse(raw);
  if (invitationId) z.uuid().parse(invitationId);
  const { token, tokenHash } = newInvitationToken();
  invitationUrl(token); // Validate configuration before committing or charging a send attempt.
  const invitation = await db.transaction(async tx => {
    const now = new Date();
    const [school] = await tx.select().from(organizations).where(eq(organizations.id, input.organizationId)).limit(1);
    if (!school) throw new InvitationError("School not found.");
    if (invitationId) {
      const [previous] = await tx.select().from(smsInvitations).where(eq(smsInvitations.id, invitationId)).for("update");
      if (!previous || previous.organizationId !== input.organizationId || previous.acceptedAt || previous.revokedAt) {
        throw new InvitationError("This invitation cannot be resent. Create a new invitation instead.");
      }
      if (now.getTime() - previous.lastSentAt.getTime() < 60_000) throw new InvitationError("Wait at least one minute before resending.");
    }
    const existing = await tx.select({ id: users.id }).from(users).where(eq(users.phoneNumber, input.phoneNumber)).limit(1);
    if (existing[0]) {
      const [membership] = await tx.select().from(organizationMemberships)
        .where(and(eq(organizationMemberships.userId, existing[0].id), eq(organizationMemberships.organizationId, input.organizationId))).limit(1);
      if (membership) throw new InvitationError("This account already belongs to that school.");
    }
    await reserveQuota(tx, `sender:${actor.id}`, 20, 60 * 60_000, 0, now);
    await reserveQuota(tx, `phone:${hashInvitationToken(input.phoneNumber)}`, 5, 24 * 60 * 60_000, 60_000, now);
    // Reissuing to the same phone and school invalidates earlier unaccepted links as well.
    await tx.update(smsInvitations).set({ revokedAt: now, updatedAt: now })
      .where(and(eq(smsInvitations.organizationId, input.organizationId), eq(smsInvitations.phoneNumber, input.phoneNumber),
        isNull(smsInvitations.acceptedAt), isNull(smsInvitations.revokedAt)));
    const values = { ...input, tokenHash, invitedBy: actor.id, expiresAt: new Date(now.getTime() + INVITATION_LIFETIME_MS),
      lastSentAt: now, deliveryStatus: "pending", providerRef: null, revokedAt: null, updatedAt: now };
    const [created] = invitationId
      ? await tx.update(smsInvitations).set(values).where(eq(smsInvitations.id, invitationId)).returning()
      : await tx.insert(smsInvitations).values(values).returning();
    await logAuditEvent({ organizationId: input.organizationId, actorUserId: actor.id,
      action: invitationId ? "invitation.sms_resent" : "invitation.sms_created", entityType: "sms_invitation", entityId: created.id,
      metadata: { role: input.role } }, tx);
    return created;
  });
  return sendInvitation(invitation, token);
}

export async function revokeSchoolInvitation(id: string) {
  const actor = await requirePlatformAdmin(); z.uuid().parse(id);
  await db.transaction(async tx => {
    const [invitation] = await tx.update(smsInvitations).set({ revokedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(smsInvitations.id, id), isNull(smsInvitations.acceptedAt), isNull(smsInvitations.revokedAt))).returning();
    if (!invitation) throw new InvitationError("Invitation is already accepted, revoked or unavailable.");
    await logAuditEvent({ organizationId: invitation.organizationId, actorUserId: actor.id,
      action: "invitation.revoked", entityType: "sms_invitation", entityId: id }, tx);
  });
}

export async function acceptSchoolInvitation(raw: z.input<typeof invitationAcceptanceSchema>) {
  requireLiveMode();
  const input = invitationAcceptanceSchema.parse(raw);
  const signedIn = await getAuth().api.getSession({ headers: await headers() });
  return db.transaction(async tx => {
    // Serializes simultaneous invitations to the same number across multiple schools.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${input.phoneNumber}, 0))`);
    const [invitation] = await tx.select().from(smsInvitations)
      .where(eq(smsInvitations.tokenHash, hashInvitationToken(input.token))).for("update");
    if (!invitation || !isInvitationActive(invitation) || invitation.phoneNumber !== input.phoneNumber) {
      throw new InvitationError("This invitation is invalid, expired or already used. Ask your administrator for a new one.");
    }
    const [existing] = await tx.select().from(users).where(eq(users.phoneNumber, invitation.phoneNumber)).limit(1);
    let userId: string;
    let username = existing?.username ?? null;
    if (existing) {
      if (signedIn?.user.id !== existing.id || !existing.phoneNumberVerified) {
        throw new InvitationError("This phone number already has an account. Sign in to that account first, then reopen the invitation link.");
      }
      userId = existing.id; // Never replace an existing account's name, password, MFA or other memberships.
    } else {
      if (signedIn) throw new InvitationError("Sign out before activating an invitation for a different phone number.");
      if (!input.password) throw new InvitationError("Choose a password of at least 12 characters.");
      if (!input.username) throw new InvitationError("Choose a username for your school account.");
      const [school] = await tx.select().from(organizations).where(eq(organizations.id, invitation.organizationId)).limit(1);
      if (!school) throw new InvitationError("School not found.");
      username = loginUsername(school.slug, input.username);
      userId = randomUUID();
      await tx.insert(users).values({ id: userId, name: input.name,
        // Better Auth requires an email column; this is an internal identifier, never a mailbox or login credential.
        email: `${userId}@accounts.klasso.invalid`, emailVerified: false,
        username, displayUsername: input.username,
        phoneNumber: invitation.phoneNumber, phoneNumberVerified: true,
        organizationId: invitation.organizationId, role: invitation.role,
      });
      await tx.insert(accounts).values({ id: randomUUID(), userId, accountId: userId, providerId: "credential", password: await hashPassword(input.password) });
    }
    await tx.insert(organizationMemberships).values({ userId, organizationId: invitation.organizationId, role: invitation.role })
      .onConflictDoNothing({ target: [organizationMemberships.organizationId, organizationMemberships.userId] });
    await tx.update(smsInvitations).set({ acceptedAt: new Date(), acceptedBy: userId, updatedAt: new Date() }).where(eq(smsInvitations.id, invitation.id));
    await logAuditEvent({ organizationId: invitation.organizationId, actorUserId: userId, action: "invitation.accepted",
      entityType: "sms_invitation", entityId: invitation.id, metadata: { role: invitation.role } }, tx);
    return { existingAccount: !!existing, username };
  });
}

export async function getPlatformInvitationData() {
  await requirePlatformAdmin();
  const loadedAt = Date.now();
  const [schools, invitations, memberships, activeSessions, audit, securityEvents] = await Promise.all([
    db.select({ id: organizations.id, name: organizations.name, slug: organizations.slug, timezone: organizations.timezone,
      createdAt: organizations.createdAt }).from(organizations).orderBy(organizations.name),
    db.select({ id: smsInvitations.id, organizationId: smsInvitations.organizationId,
      phoneNumber: smsInvitations.phoneNumber, role: smsInvitations.role, expiresAt: smsInvitations.expiresAt,
      acceptedAt: smsInvitations.acceptedAt, revokedAt: smsInvitations.revokedAt, deliveryStatus: smsInvitations.deliveryStatus,
      lastSentAt: smsInvitations.lastSentAt }).from(smsInvitations).orderBy(desc(smsInvitations.createdAt)).limit(200),
    db.select({ id: organizationMemberships.id, organizationId: organizationMemberships.organizationId,
      userId: organizationMemberships.userId, role: organizationMemberships.role, joinedAt: organizationMemberships.createdAt,
      name: users.name, username: users.username, phoneNumber: users.phoneNumber, phoneNumberVerified: users.phoneNumberVerified,
      twoFactorEnabled: users.twoFactorEnabled, mustChangePassword: users.mustChangePassword }).from(organizationMemberships)
      .innerJoin(users, eq(organizationMemberships.userId, users.id)).orderBy(users.name),
    db.select({ userId: sessions.userId, expiresAt: sessions.expiresAt }).from(sessions)
      .where(sql`${sessions.expiresAt} > now()`),
    db.select({ id: auditEvents.id, organizationId: auditEvents.organizationId, schoolName: organizations.name,
      actorName: users.name, action: auditEvents.action, entityType: auditEvents.entityType,
      entityId: auditEvents.entityId, createdAt: auditEvents.createdAt }).from(auditEvents)
      .innerJoin(organizations, eq(auditEvents.organizationId, organizations.id))
      .leftJoin(users, eq(auditEvents.actorUserId, users.id)).orderBy(desc(auditEvents.createdAt)).limit(80),
    db.select({ id: rateLimitLogs.id, organizationId: rateLimitLogs.organizationId, tier: rateLimitLogs.tier,
      endpoint: rateLimitLogs.endpoint, requestCount: rateLimitLogs.requestCount, limit: rateLimitLogs.limit,
      blockedAt: rateLimitLogs.blockedAt }).from(rateLimitLogs).orderBy(desc(rateLimitLogs.blockedAt)).limit(50),
  ]);
  const sessionUserIds = new Set(activeSessions.map(session => session.userId));
  return {
    schools,
    invitations,
    memberships: memberships.map(membership => ({ ...membership, hasActiveSession: sessionUserIds.has(membership.userId) })),
    audit,
    securityEvents,
    loadedAt,
  };
}

export async function inspectSchoolInvitation(token: string) {
  requireLiveMode(); invitationTokenSchema.parse(token);
  const [record] = await db.select({ invitation: smsInvitations, schoolName: organizations.name, tenantId: organizations.slug }).from(smsInvitations)
    .innerJoin(organizations, eq(organizations.id, smsInvitations.organizationId))
    .where(eq(smsInvitations.tokenHash, hashInvitationToken(token))).limit(1);
  if (!record || !isInvitationActive(record.invitation)) throw new InvitationError("Invitation expired, revoked or already used. Ask your administrator for a new link.");
  const [account] = await db.select({ id: users.id }).from(users).where(eq(users.phoneNumber, record.invitation.phoneNumber)).limit(1);
  const session = await getAuth().api.getSession({ headers: await headers() });
  return { schoolName: record.schoolName, tenantId: record.tenantId, role: record.invitation.role, phoneHint: maskPhoneNumber(record.invitation.phoneNumber),
    mode: account ? (session?.user.id === account.id ? "existing" as const : "sign-in" as const) : "new" as const };
}
