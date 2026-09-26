import type { StaffRole } from "@/lib/action-access";
import type { SensitiveCaseArea } from "@/lib/sensitive-records";
import { canUserAccessCaseArea } from "@/lib/sensitive-records";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";

export type SpecialistRole = "safeguarding_lead" | "senco" | "health_nurse";

export function isSpecialistRole(role: StaffRole): role is SpecialistRole {
  return role === "safeguarding_lead" || role === "senco" || role === "health_nurse";
}

export function specialistAreas(role: SpecialistRole): SensitiveCaseArea[] {
  return (["safeguarding", "health_medical", "special_needs", "disciplinary"] as const)
    .filter(area => canUserAccessCaseArea(role, area));
}

export function canSpecialistRunCommand(role: SpecialistRole, kind: WorkflowCommand["kind"]): boolean {
  if (role === "safeguarding_lead" && (kind === "court_restriction" || kind === "court_restriction_status" || kind === "statutory_disclosure")) return true;
  if (role === "health_nurse" && kind === "clinic_visit") return true;
  if (role === "senco" && (kind === "sen_profile_save" || kind === "sen_review_complete")) return true;
  return ["sensitive_case", "sensitive_note", "sensitive_access", "sensitive_case_status",
    "need_to_know", "need_to_know_resolve"].includes(kind);
}
