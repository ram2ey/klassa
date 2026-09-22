// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashInvitationToken, invitationUrl, isInvitationActive, newInvitationToken } from "./invitation-policy";
import { phoneNumberSchema } from "./phone";
afterEach(() => vi.unstubAllEnvs());

describe("invitation security policy", () => {
  it("normalizes international numbers without guessing a country", () => {
    expect(phoneNumberSchema.parse("+354 (555) 1234")).toBe("+3545551234");
    for (const value of ["5551234", "+00123456789", "+354abc5551234", "+1234567890123456"]) expect(phoneNumberSchema.safeParse(value).success).toBe(false);
  });
  it("generates unique bearer tokens and stores only their digest", () => {
    const first = newInvitationToken(), second = newInvitationToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashInvitationToken(first.token));
    expect(first.tokenHash).toHaveLength(64);
    expect(first.tokenHash).not.toContain(first.token);
  });
  it("rejects expired, revoked and consumed invitations", () => {
    const now = new Date("2026-09-22T12:00:00Z");
    const record = { expiresAt: new Date(now.getTime() + 1000), acceptedAt: null, revokedAt: null };
    expect(isInvitationActive(record, now)).toBe(true);
    expect(isInvitationActive({ ...record, expiresAt: now }, now)).toBe(false);
    expect(isInvitationActive({ ...record, acceptedAt: now }, now)).toBe(false);
    expect(isInvitationActive({ ...record, revokedAt: now }, now)).toBe(false);
  });
  it("puts the secret in the URL fragment and requires HTTPS in production", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://klasso.example.com");
    const { token } = newInvitationToken();
    const url = new URL(invitationUrl(token));
    expect(url.search).toBe(""); expect(url.hash).toBe(`#${token}`);
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("BETTER_AUTH_URL", "http://klasso.example.com");
    expect(() => invitationUrl(token)).toThrow("HTTPS");
  });
});
