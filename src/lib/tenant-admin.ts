import { z } from "zod";
import { SCHOOL_TIME_ZONE } from "@/lib/timezone";

export interface OrganizationRecord {
  id: string;
  name: string;
  slug: string;
  domain: string;
  timezone: string;
  gradingScheme: "letter" | "standards_based";
  status: "active" | "provisioning" | "suspended";
  studentCount: number;
  staffCount: number;
  mfaEnforced: boolean;
  createdAt: string;
}

export interface OnboardingChecklist {
  domainVerified: boolean;
  initialAdminInvited: boolean;
  mfaPolicyActivated: boolean;
  academicYearCreated: boolean;
  safeguardingLeadDesignated: boolean;
  initialRosterImported: boolean;
}

export const provisionSchoolSchema = z.object({
  name: z.string().min(3, "School name must be at least 3 characters"),
  slug: z.string().min(2, "School slug must be at least 2 characters").regex(/^[a-z0-9-]+$/, "Slug must be lowercase alphanumeric with hyphens"),
  domain: z.string().min(4, "Domain is required"),
  gradingScheme: z.enum(["letter", "standards_based"]).default("letter"),
  adminEmail: z.email("Valid administrator email is required"),
  adminName: z.string().min(2, "Administrator name is required"),
});

export type ProvisionSchoolInput = z.infer<typeof provisionSchoolSchema>;

export const INITIAL_ORGANIZATIONS: OrganizationRecord[] = [
  {
    id: "org-northfield",
    name: "Northfield Academy",
    slug: "northfield",
    domain: "northfield.edu.is",
    timezone: SCHOOL_TIME_ZONE,
    gradingScheme: "letter",
    status: "active",
    studentCount: 412,
    staffCount: 28,
    mfaEnforced: true,
    createdAt: "2024-01-15T08:00:00.000Z",
  },
  {
    id: "org-stjude",
    name: "St. Jude Preparatory",
    slug: "st-jude",
    domain: "stjude.edu.is",
    timezone: SCHOOL_TIME_ZONE,
    gradingScheme: "standards_based",
    status: "active",
    studentCount: 280,
    staffCount: 18,
    mfaEnforced: true,
    createdAt: "2025-06-01T09:00:00.000Z",
  },
  {
    id: "org-riverdale",
    name: "Riverdale High School",
    slug: "riverdale",
    domain: "riverdale.edu.is",
    timezone: SCHOOL_TIME_ZONE,
    gradingScheme: "letter",
    status: "provisioning",
    studentCount: 520,
    staffCount: 35,
    mfaEnforced: true,
    createdAt: "2026-08-10T11:00:00.000Z",
  },
];

export const INITIAL_ONBOARDING_CHECKLISTS: Record<string, OnboardingChecklist> = {
  "org-northfield": {
    domainVerified: true,
    initialAdminInvited: true,
    mfaPolicyActivated: true,
    academicYearCreated: true,
    safeguardingLeadDesignated: true,
    initialRosterImported: true,
  },
  "org-stjude": {
    domainVerified: true,
    initialAdminInvited: true,
    mfaPolicyActivated: true,
    academicYearCreated: true,
    safeguardingLeadDesignated: true,
    initialRosterImported: true,
  },
  "org-riverdale": {
    domainVerified: true,
    initialAdminInvited: true,
    mfaPolicyActivated: true,
    academicYearCreated: true,
    safeguardingLeadDesignated: false,
    initialRosterImported: false,
  },
};

/**
 * Calculates percentage completion of an institution's onboarding checklist.
 */
export function calculateOnboardingProgress(checklist: OnboardingChecklist): number {
  const keys = Object.keys(checklist) as (keyof OnboardingChecklist)[];
  const completed = keys.filter((k) => checklist[k]).length;
  return Math.round((completed / keys.length) * 100);
}

/**
 * Validates cross-tenant boundaries ensuring that records belonging to one school
 * cannot be accessed or modified by sessions associated with a different school.
 */
export function validateCrossTenantIsolation(
  sessionOrgId: string,
  targetRecordOrgId: string
): { allowed: boolean; violation?: string } {
  if (sessionOrgId !== targetRecordOrgId) {
    return {
      allowed: false,
      violation: `Tenant Isolation Breach: Session organization '${sessionOrgId}' does not match record organization '${targetRecordOrgId}'.`,
    };
  }
  return { allowed: true };
}

/**
 * Provisions a new school organization with validated parameters.
 */
export function provisionSchoolOrganization(input: ProvisionSchoolInput): {
  organization: OrganizationRecord;
  checklist: OnboardingChecklist;
} {
  const newOrg: OrganizationRecord = {
    id: `org-${input.slug}`,
    name: input.name,
    slug: input.slug,
    domain: input.domain,
    timezone: SCHOOL_TIME_ZONE,
    gradingScheme: input.gradingScheme,
    status: "provisioning",
    studentCount: 0,
    staffCount: 1, // initial admin
    mfaEnforced: true,
    createdAt: new Date().toISOString(),
  };

  const checklist: OnboardingChecklist = {
    domainVerified: false,
    initialAdminInvited: true,
    mfaPolicyActivated: true,
    academicYearCreated: false,
    safeguardingLeadDesignated: false,
    initialRosterImported: false,
  };

  return { organization: newOrg, checklist };
}
