type AccessReviewDates = {
  lastSignedInAt: Date | string | null;
  accessReviewedAt: Date | string | null;
  updatedAt: Date | string;
  membershipUpdatedAt: Date | string;
};

const DAY_MS = 86_400_000;

export function accessReviewState(member: AccessReviewDates, now: number) {
  const lastSignIn = member.lastSignedInAt ? new Date(member.lastSignedInAt).getTime() : null;
  const reviewedAt = member.accessReviewedAt ? new Date(member.accessReviewedAt).getTime() : null;
  return {
    dormant: lastSignIn !== null && now - lastSignIn >= 90 * DAY_MS,
    noRecord: lastSignIn === null,
    reviewDue: reviewedAt === null || now - reviewedAt >= 90 * DAY_MS
      || reviewedAt < Math.max(new Date(member.updatedAt).getTime(), new Date(member.membershipUpdatedAt).getTime()),
  };
}
