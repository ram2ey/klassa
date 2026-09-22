// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { accounts, organizationMemberships, smsInvitations, users } from "@/db/schema";
const mocks = vi.hoisted(() => ({ reads: [] as unknown[][], writes: [] as { table: unknown; data: Record<string, unknown> }[],
  platform: vi.fn(), live: vi.fn(), session: vi.fn(), audit: vi.fn(), send: vi.fn(), commit: vi.fn(), rollback: vi.fn(), quota: true }));
vi.mock("@/lib/action-access", () => ({ requirePlatformAdmin: mocks.platform, requireLiveMode: mocks.live }));
vi.mock("@/lib/auth", () => ({ getAuth: () => ({ api: { getSession: mocks.session } }) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/lib/audit", () => ({ logAuditEvent: mocks.audit }));
vi.mock("@/lib/sms", () => ({ getSmsProvider: () => ({ send: mocks.send }) }));
vi.mock("@/db", async () => {
  const schema = await import("@/db/schema");
  function read() {
    const chain = { from: () => chain, where: () => chain, limit: () => chain, for: () => chain,
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(mocks.reads.shift() ?? []).then(resolve) };
    return chain;
  }
  function write(table: unknown, data: Record<string, unknown>) {
    mocks.writes.push({ table, data });
    const chain = { where: () => chain, onConflictDoUpdate: () => chain, onConflictDoNothing: () => chain,
      returning: async () => table === schema.invitationSmsLimits ? (mocks.quota ? [{ key: data.key }] : []) : [{ id: "00000000-0000-4000-8000-000000000008", ...data }],
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve) };
    return chain;
  }
  const database = { select: read, insert: (table: unknown) => ({ values: (data: Record<string, unknown>) => write(table, data) }),
    update: (table: unknown) => ({ set: (data: Record<string, unknown>) => write(table, data) }), execute: async () => [] };
  return { db: { ...database, transaction: async (fn: (tx: typeof database) => Promise<unknown>) => {
    try { const result = await fn(database); mocks.commit(); return result; } catch (error) { mocks.rollback(); throw error; }
  } } };
});
import { acceptSchoolInvitation, issueSchoolInvitation, revokeSchoolInvitation } from "./school-invitations";
import { hashInvitationToken, newInvitationToken } from "./invitation-policy";

const org = "00000000-0000-4000-8000-000000000002";
const phone = "+3545551234";
const invitation = () => ({ id: "00000000-0000-4000-8000-000000000008", organizationId: org, phoneNumber: phone,
  role: "school_admin", expiresAt: new Date(Date.now() + 3600_000), acceptedAt: null, revokedAt: null, lastSentAt: new Date(Date.now() - 120_000) });
beforeEach(() => {
  mocks.reads.length = 0; mocks.writes.length = 0; mocks.quota = true;
  mocks.platform.mockReset().mockResolvedValue({ id: "superuser" }); mocks.session.mockReset().mockResolvedValue(null);
  mocks.audit.mockReset().mockResolvedValue({}); mocks.send.mockReset().mockResolvedValue({ success: true, providerRef: "SM-test" });
  mocks.commit.mockClear(); mocks.rollback.mockClear(); mocks.live.mockReset();
});

describe("SMS invitation lifecycle", () => {
  it("requires superuser authorization before issuing anything", async () => {
    mocks.platform.mockRejectedValue(new Error("Access denied"));
    await expect(issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" })).rejects.toThrow("Access denied");
    expect(mocks.writes).toHaveLength(0); expect(mocks.send).not.toHaveBeenCalled();
  });
  it("commits a hashed invitation before sending, and returns no bearer secret", async () => {
    mocks.reads.push([{ id: org }], []);
    mocks.send.mockImplementation(async () => { expect(mocks.commit).toHaveBeenCalledOnce(); return { success: true, providerRef: "SM-test" }; });
    const result = await issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" });
    const message = String(mocks.send.mock.calls[0][1]);
    const token = message.match(/#([A-Za-z0-9_-]{43})/)![1];
    const stored = mocks.writes.find(write => write.table === smsInvitations && write.data.tokenHash)?.data;
    expect(stored?.tokenHash).toBe(hashInvitationToken(token));
    expect(JSON.stringify(result)).not.toContain(token); expect(JSON.stringify(mocks.audit.mock.calls)).not.toContain(token);
  });
  it("does not send when quota reservation fails", async () => {
    mocks.reads.push([{ id: org }], []); mocks.quota = false;
    await expect(issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" })).rejects.toThrow("SMS limit");
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.rollback).toHaveBeenCalledOnce();
  });
  it("rotates the token when resending and invalidates old pending links", async () => {
    const oldHash = hashInvitationToken(newInvitationToken().token);
    mocks.reads.push([{ id: org }], [{ ...invitation(), tokenHash: oldHash }], []);
    await issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" }, invitation().id);
    const replacement = mocks.writes.find(write => write.table === smsInvitations && write.data.tokenHash)?.data;
    expect(replacement?.tokenHash).not.toBe(oldHash);
    expect(mocks.writes.some(write => write.table === smsInvitations && write.data.revokedAt instanceof Date)).toBe(true);
    expect(mocks.send).toHaveBeenCalledOnce();
  });
  it("rejects an immediate resend before sending or changing the invitation", async () => {
    mocks.reads.push([{ id: org }], [{ ...invitation(), lastSentAt: new Date() }]);
    await expect(issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" }, invitation().id)).rejects.toThrow("one minute");
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.writes).toHaveLength(0);
  });
  it("does not send if the invitation audit fails", async () => {
    mocks.reads.push([{ id: org }], []); mocks.audit.mockRejectedValue(new Error("Audit failed"));
    await expect(issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" })).rejects.toThrow("Audit failed");
    expect(mocks.send).not.toHaveBeenCalled(); expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("reports provider failure without pretending delivery succeeded", async () => {
    mocks.reads.push([{ id: org }], []); mocks.send.mockRejectedValue(new Error("Provider offline"));
    const result = await issueSchoolInvitation({ organizationId: org, phoneNumber: phone, role: "school_admin" });
    expect(result.deliveryStatus).toBe("failed");
    expect(mocks.writes.at(-1)?.data.deliveryStatus).toBe("failed");
  });
  it.each(["expired", "revoked", "accepted", "phone-mismatch"])("rejects %s acceptance before creating an account", async condition => {
    const record = invitation();
    const invalid = { ...record, expiresAt: condition === "expired" ? new Date(0) : record.expiresAt,
      acceptedAt: condition === "accepted" ? new Date() : null, revokedAt: condition === "revoked" ? new Date() : null };
    mocks.reads.push([invalid]);
    await expect(acceptSchoolInvitation({ token: newInvitationToken().token, phoneNumber: condition === "phone-mismatch" ? "+3545559999" : phone, name: "New Admin", password: "long-test-password" })).rejects.toThrow("invalid, expired or already used");
    expect(mocks.writes).toHaveLength(0);
  });
  it("creates a credential account and membership using only the invitation's role and school", async () => {
    mocks.reads.push([invitation()], []);
    await acceptSchoolInvitation({ token: newInvitationToken().token, phoneNumber: phone, name: "New Admin", password: "long-test-password" });
    const account = mocks.writes.find(write => write.table === accounts)!.data;
    expect(account.providerId).toBe("credential"); expect(account.password).not.toBe("long-test-password");
    expect(mocks.writes.find(write => write.table === organizationMemberships)?.data).toMatchObject({ organizationId: org, role: "school_admin" });
    expect(mocks.writes.find(write => write.table === users)?.data.isPlatformAdmin).toBeUndefined();
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
  it("cannot replace an existing account's password with an invitation", async () => {
    mocks.reads.push([invitation()], [{ id: "existing", phoneNumberVerified: true }]);
    await expect(acceptSchoolInvitation({ token: newInvitationToken().token, phoneNumber: phone, name: "Replacement", password: "attacker-password" })).rejects.toThrow("Sign in");
    expect(mocks.writes).toHaveLength(0);
  });
  it("adds a school to the matching authenticated account without changing its credentials", async () => {
    mocks.session.mockResolvedValue({ user: { id: "existing" } });
    mocks.reads.push([invitation()], [{ id: "existing", phoneNumberVerified: true }]);
    const result = await acceptSchoolInvitation({ token: newInvitationToken().token, phoneNumber: phone, name: "Ignored" });
    expect(result.existingAccount).toBe(true);
    expect(mocks.writes.some(write => write.table === users || write.table === accounts)).toBe(false);
  });
  it("audits revocation as the authenticated superuser", async () => {
    await revokeSchoolInvitation(invitation().id);
    expect(mocks.platform).toHaveBeenCalledOnce(); expect(mocks.audit).toHaveBeenCalledWith(expect.objectContaining({ actorUserId: "superuser", action: "invitation.revoked" }), expect.anything());
  });
});
