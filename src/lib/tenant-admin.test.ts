import { describe, it, expect } from "vitest";
import {
  provisionSchoolOrganization,
  calculateOnboardingProgress,
  validateCrossTenantIsolation,
  provisionSchoolSchema,
} from "./tenant-admin";

describe("Phase 6 Multi-School Tenant Administration", () => {
  it("provisions a new school organization with valid schema", () => {
    const input = {
      name: "Westford Grammar School",
      slug: "westford",
      domain: "westford.edu.is",
      timezone: "Atlantic/Reykjavik",
      gradingScheme: "letter" as const,
      adminName: "Margaret Evans",
      adminEmail: "m.evans@westford.edu.is",
    };

    const { organization, checklist } = provisionSchoolOrganization(input);

    expect(organization.id).toBe("org-westford");
    expect(organization.name).toBe("Westford Grammar School");
    expect(organization.status).toBe("provisioning");
    expect(organization.mfaEnforced).toBe(true);
    expect(checklist.domainVerified).toBe(false);
    expect(checklist.initialAdminInvited).toBe(true);
  });

  it("calculates onboarding verification progress accurately", () => {
    const fullChecklist = {
      domainVerified: true,
      initialAdminInvited: true,
      mfaPolicyActivated: true,
      academicYearCreated: true,
      safeguardingLeadDesignated: true,
      initialRosterImported: true,
    };
    expect(calculateOnboardingProgress(fullChecklist)).toBe(100);

    const partialChecklist = {
      domainVerified: true,
      initialAdminInvited: true,
      mfaPolicyActivated: true,
      academicYearCreated: false,
      safeguardingLeadDesignated: false,
      initialRosterImported: false,
    };
    expect(calculateOnboardingProgress(partialChecklist)).toBe(50);
  });

  it("enforces cross-tenant isolation and flags breaches", () => {
    const valid = validateCrossTenantIsolation("org-northfield", "org-northfield");
    expect(valid.allowed).toBe(true);
    expect(valid.violation).toBeUndefined();

    const breach = validateCrossTenantIsolation("org-northfield", "org-stjude");
    expect(breach.allowed).toBe(false);
    expect(breach.violation).toContain("Tenant Isolation Breach");
  });

  it("validates school slug and email rules with Zod", () => {
    const valid = provisionSchoolSchema.safeParse({
      name: "St. Jude",
      slug: "st-jude",
      domain: "stjude.is",
      adminName: "Fr. John",
      adminEmail: "admin@stjude.is",
    });
    expect(valid.success).toBe(true);

    const invalidSlug = provisionSchoolSchema.safeParse({
      name: "St. Jude",
      slug: "St Jude INVALID!",
      domain: "stjude.is",
      adminName: "Fr. John",
      adminEmail: "admin@stjude.is",
    });
    expect(invalidSlug.success).toBe(false);
  });
});

