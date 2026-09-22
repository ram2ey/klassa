"use server";
import { requireDemoAction } from "@/lib/action-access";

import { revalidatePath } from "next/cache";
import {
  type ProvisionSchoolInput,
  type OrganizationRecord,
  type OnboardingChecklist,
  provisionSchoolSchema,
  provisionSchoolOrganization,
  INITIAL_ORGANIZATIONS,
  INITIAL_ONBOARDING_CHECKLISTS,
} from "@/lib/tenant-admin";
import { logAuditEvent, AuditActions } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const localOrganizations: OrganizationRecord[] = [...INITIAL_ORGANIZATIONS];
const localChecklists: Record<string, OnboardingChecklist> = { ...INITIAL_ONBOARDING_CHECKLISTS };

export async function getOrganizationsAction() {
  await requireDemoAction();
  return {
    success: true,
    organizations: [...localOrganizations],
    checklists: { ...localChecklists },
  };
}

export async function provisionSchoolAction(
  input: ProvisionSchoolInput,
  operatorId: string = "usr-sysadmin"
) {
  await requireDemoAction();
  const rl = checkRateLimit("general", operatorId);
  if (!rl.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rl.retryAfter} seconds before provisioning another school.`,
    };
  }

  const parsed = provisionSchoolSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid school provisioning input",
    };
  }

  // Check slug uniqueness
  if (localOrganizations.some((o) => o.slug === input.slug)) {
    return {
      success: false,
      error: `School with slug '${input.slug}' already exists.`,
    };
  }

  const { organization, checklist } = provisionSchoolOrganization(input);
  localOrganizations.push(organization);
  localChecklists[organization.id] = checklist;

  await logAuditEvent({
    organizationId: organization.id,
    actorUserId: operatorId,
    action: AuditActions.ORGANIZATION_PROVISIONED,
    entityType: "organization",
    entityId: organization.id,
    metadata: {
      name: input.name,
      slug: input.slug,
      domain: input.domain,
      adminEmail: input.adminEmail,
    },
  });

  revalidatePath("/");
  return { success: true, organization, checklist };
}

export async function updateOnboardingChecklistAction(
  orgId: string,
  itemKey: keyof OnboardingChecklist,
  value: boolean,
  operatorId: string = "usr-sysadmin"
) {
  await requireDemoAction();
  if (localChecklists[orgId]) {
    localChecklists[orgId][itemKey] = value;
  }

  await logAuditEvent({
    organizationId: orgId,
    actorUserId: operatorId,
    action: AuditActions.ORGANIZATION_PROVISIONED,
    entityType: "onboarding_checklist",
    entityId: `${orgId}:${String(itemKey)}`,
    metadata: { itemKey, value },
  });

  revalidatePath("/");
  return { success: true, checklist: localChecklists[orgId] };
}
