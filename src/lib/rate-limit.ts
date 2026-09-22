export type RateLimitTier = "auth" | "sensitive" | "general" | "api";

export interface RateLimitConfig {
  limit: number;
  windowSeconds: number;
}

export const RATE_LIMIT_TIERS: Record<RateLimitTier, RateLimitConfig> = {
  auth: { limit: 5, windowSeconds: 900 }, // 5 attempts per 15 minutes (brute-force defense)
  sensitive: { limit: 10, windowSeconds: 60 }, // 10 attempts per minute (decryption shield)
  general: { limit: 120, windowSeconds: 60 }, // 120 attempts per minute (standard UI)
  api: { limit: 60, windowSeconds: 60 }, // 60 requests per minute (OpenAPI consumers)
};

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  retryAfter: number | null;
  tier: RateLimitTier;
  identifier: string;
}

export interface RateLimitViolation {
  tier: RateLimitTier;
  identifier: string;
  endpoint: string;
  timestamp: string;
  attemptCount: number;
}

// In-memory sliding window bucket store: Map<key, number[]>
const requestLog = new Map<string, number[]>();
const violationsLog: RateLimitViolation[] = [];

/**
 * Checks and records a request against a rate limiting tier using a sliding window.
 */
export function checkRateLimit(
  tier: RateLimitTier,
  identifier: string,
  nowMs: number = Date.now()
): RateLimitResult {
  const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.general;
  const windowMs = config.windowSeconds * 1000;
  const key = `${tier}:${identifier}`;

  // Retrieve existing timestamps and purge those outside the sliding window
  const timestamps = requestLog.get(key) || [];
  const cutoff = nowMs - windowMs;
  const validTimestamps = timestamps.filter((ts) => ts > cutoff);

  const requestCount = validTimestamps.length;
  const oldestTimestamp = validTimestamps[0] ?? nowMs;
  const timeUntilReset = Math.max(0, Math.ceil((oldestTimestamp + windowMs - nowMs) / 1000));

  if (requestCount >= config.limit) {
    // Record violation
    const violation: RateLimitViolation = {
      tier,
      identifier,
      endpoint: `tier:${tier}`,
      timestamp: new Date(nowMs).toISOString(),
      attemptCount: requestCount + 1,
    };
    violationsLog.unshift(violation);
    if (violationsLog.length > 100) violationsLog.pop();

    return {
      allowed: false,
      limit: config.limit,
      remaining: 0,
      resetSeconds: timeUntilReset,
      retryAfter: timeUntilReset,
      tier,
      identifier,
    };
  }

  // Allow request and append timestamp
  validTimestamps.push(nowMs);
  requestLog.set(key, validTimestamps);

  return {
    allowed: true,
    limit: config.limit,
    remaining: Math.max(0, config.limit - validTimestamps.length),
    resetSeconds: timeUntilReset || config.windowSeconds,
    retryAfter: null,
    tier,
    identifier,
  };
}

/**
 * Returns RFC 6585 compliant HTTP rate limiting response headers.
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.resetSeconds.toString(),
  };

  if (!result.allowed && result.retryAfter !== null) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Resets the rate limit for a specific tier and identifier (useful for tests or admin unlocks).
 */
export function resetRateLimit(tier?: RateLimitTier, identifier?: string): void {
  if (tier && identifier) {
    requestLog.delete(`${tier}:${identifier}`);
  } else if (tier) {
    for (const key of requestLog.keys()) {
      if (key.startsWith(`${tier}:`)) requestLog.delete(key);
    }
  } else {
    requestLog.clear();
    violationsLog.length = 0;
  }
}

/**
 * Prunes expired entries across all keys to prevent unbounded memory growth.
 */
export function pruneRateLimitBuckets(nowMs: number = Date.now()): number {
  let prunedKeys = 0;
  for (const [key, timestamps] of requestLog.entries()) {
    const tier = key.split(":")[0] as RateLimitTier;
    const config = RATE_LIMIT_TIERS[tier] || RATE_LIMIT_TIERS.general;
    const cutoff = nowMs - config.windowSeconds * 1000;
    const valid = timestamps.filter((ts) => ts > cutoff);

    if (valid.length === 0) {
      requestLog.delete(key);
      prunedKeys++;
    } else if (valid.length !== timestamps.length) {
      requestLog.set(key, valid);
    }
  }
  return prunedKeys;
}

/**
 * Returns diagnostic statistics for security dashboards and health checks.
 */
export function getRateLimitMetrics() {
  return {
    activeTrackedKeys: requestLog.size,
    totalViolationsRecorded: violationsLog.length,
    recentViolations: [...violationsLog.slice(0, 10)],
    tiers: { ...RATE_LIMIT_TIERS },
  };
}

