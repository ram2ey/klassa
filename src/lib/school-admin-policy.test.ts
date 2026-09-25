import { describe, expect, it } from "vitest";
import { schoolCommandSchema } from "./school-admin-policy";

describe("school setup validation", () => {
  it("rejects reversed academic dates", () => {
    expect(schoolCommandSchema.safeParse({ kind: "year", name: "2026/27", startsOn: "2027-08-01", endsOn: "2026-06-30", isCurrent: true }).success).toBe(false);
  });
  it("rejects future birth dates", () => {
    expect(schoolCommandSchema.safeParse({ kind: "student", studentNumber: "S-01", firstName: "Ada", lastName: "Lovelace", dateOfBirth: "2999-01-01", status: "pending" }).success).toBe(false);
  });
  it("accepts guardians without a phone or email", () => {
    expect(schoolCommandSchema.safeParse({ kind: "guardian", firstName: "Alex", lastName: "Smith", email: "", phone: "" }).success).toBe(true);
  });
  it("cannot grant the platform administrator role", () => {
    expect(schoolCommandSchema.safeParse({ kind: "staff_role", membershipId: "00000000-0000-4000-8000-000000000001", role: "platform_admin" }).success).toBe(false);
  });
});
