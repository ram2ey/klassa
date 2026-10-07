/** The first release is staff-only. Change this policy when enabling later modules. */
export function requireDeferredFeature(feature: string): void {
  throw new Error(`${feature} is not included in this staff-only release.`);
}
export function requireMvpLegacyWorkflow(kind: string, period?: string) {
  if (!["attendance", "attendance_submit", "court_restriction", "court_restriction_status"].includes(kind)) requireDeferredFeature("This workflow");
  if (period && period !== "morning_roll_call") requireDeferredFeature("Period attendance");
}
