import { describe, expect, it } from "vitest";
import { accessReviewState } from "./access-review-policy";

const now = Date.parse("2026-09-25T12:00:00Z");
const date = (daysAgo: number) => new Date(now - daysAgo * 86_400_000);

describe("access review status", () => {
  it("flags a recorded sign-in at the 90-day boundary", () => {
    expect(accessReviewState({ lastSignedInAt: date(90), accessReviewedAt: date(1),
      updatedAt: date(2), membershipUpdatedAt: date(3) }, now).dormant).toBe(true);
    expect(accessReviewState({ lastSignedInAt: date(89), accessReviewedAt: date(1),
      updatedAt: date(2), membershipUpdatedAt: date(3) }, now).dormant).toBe(false);
  });
  it("keeps missing historical sign-ins separate from dormant accounts", () => {
    expect(accessReviewState({ lastSignedInAt: null, accessReviewedAt: null,
      updatedAt: date(10), membershipUpdatedAt: date(10) }, now)).toMatchObject({ noRecord: true, dormant: false, reviewDue: true });
  });
  it("requires another review after the account or school role changes", () => {
    expect(accessReviewState({ lastSignedInAt: date(1), accessReviewedAt: date(2),
      updatedAt: date(3), membershipUpdatedAt: date(1) }, now).reviewDue).toBe(true);
    expect(accessReviewState({ lastSignedInAt: date(1), accessReviewedAt: date(2),
      updatedAt: date(3), membershipUpdatedAt: date(3) }, now).reviewDue).toBe(false);
  });
  it("requires a fresh access review every 90 days", () => {
    expect(accessReviewState({ lastSignedInAt: date(1), accessReviewedAt: date(90),
      updatedAt: date(100), membershipUpdatedAt: date(100) }, now).reviewDue).toBe(true);
  });
});
