import { describe, it, expect, beforeEach } from "vitest";
import {
  checkRateLimit,
  getRateLimitHeaders,
  resetRateLimit,
  pruneRateLimitBuckets,
  getRateLimitMetrics,
  RATE_LIMIT_TIERS,
} from "./rate-limit";

describe("Phase 6 Rate Limiting Engine", () => {
  beforeEach(() => {
    resetRateLimit();
  });

  it("allows requests under the configured threshold", () => {
    const res = checkRateLimit("general", "user-123");
    expect(res.allowed).toBe(true);
    expect(res.limit).toBe(RATE_LIMIT_TIERS.general.limit);
    expect(res.remaining).toBe(RATE_LIMIT_TIERS.general.limit - 1);
    expect(res.retryAfter).toBeNull();
  });

  it("blocks requests when limit is exceeded and returns retryAfter", () => {
    const tier = "auth"; // limit is 5
    for (let i = 0; i < 5; i++) {
      const allowed = checkRateLimit(tier, "ip-1.2.3.4");
      expect(allowed.allowed).toBe(true);
    }

    // 6th request must be blocked
    const blocked = checkRateLimit(tier, "ip-1.2.3.4");
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfter).toBeGreaterThan(0);
  });

  it("generates standard RFC 6585 rate limit headers", () => {
    const res = checkRateLimit("sensitive", "user-doctor");
    const headers = getRateLimitHeaders(res);

    expect(headers["X-RateLimit-Limit"]).toBe("10");
    expect(headers["X-RateLimit-Remaining"]).toBe("9");
    expect(headers["X-RateLimit-Reset"]).toBeDefined();
    expect(headers["Retry-After"]).toBeUndefined();

    // Fill up to block
    for (let i = 0; i < 9; i++) {
      checkRateLimit("sensitive", "user-doctor");
    }
    const blockedRes = checkRateLimit("sensitive", "user-doctor");
    const blockedHeaders = getRateLimitHeaders(blockedRes);
    expect(blockedHeaders["Retry-After"]).toBeDefined();
  });

  it("tracks rate limit violation metrics", () => {
    for (let i = 0; i < 6; i++) {
      checkRateLimit("auth", "attacker-ip");
    }

    const metrics = getRateLimitMetrics();
    expect(metrics.totalViolationsRecorded).toBe(1);
    expect(metrics.recentViolations[0]?.identifier).toBe("attacker-ip");
  });

  it("prunes expired timestamps across buckets", () => {
    const pastTime = Date.now() - 1000 * 1000;
    checkRateLimit("general", "old-session", pastTime);

    const pruned = pruneRateLimitBuckets(Date.now());
    expect(pruned).toBeGreaterThanOrEqual(1);
  });
});

