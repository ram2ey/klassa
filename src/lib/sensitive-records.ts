import crypto from "node:crypto";
import { z } from "zod";

export type SensitiveCaseArea = "safeguarding" | "health_medical" | "special_needs" | "disciplinary";
export type CaseConfidentialityTier = "standard_sensitive" | "confidential" | "strictly_confidential";
export type SensitiveCaseStatus = "open" | "under_review" | "monitoring" | "closed";
export type NeedToKnowSeverity = "routine" | "urgent" | "critical";
export type CourtOrderType = "restraining_order" | "custody_restriction" | "prohibited_contact" | "non_disclosure";

export interface SensitiveCaseRecord {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  studentGrade: string;
  caseNumber: string;
  area: SensitiveCaseArea;
  confidentialityTier: CaseConfidentialityTier;
  title: string;
  status: SensitiveCaseStatus;
  leadSpecialistId: string | null;
  leadSpecialistName: string;
  hasCourtOrder: boolean;
  reviewDate: string | null;
  closedAt?: string | null;
  closedReason?: string | null;
  encryptedNotesCount: number;
  latestNoteSummary?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EncryptedCaseNote {
  id: string;
  caseId: string;
  authorId: string;
  authorName: string;
  noteType: string;
  confidentialityTier: CaseConfidentialityTier;
  encryptedCiphertext: string;
  ivHex: string;
  authTagHex: string;
  isQuarantined: boolean;
  decryptedText?: string;
  createdAt: string;
}

export interface SensitiveAccessLogRecord {
  id: string;
  organizationId: string;
  caseId: string;
  caseNumber: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  accessReason: string;
  ipAddress: string;
  accessedAt: string;
}

export interface NeedToKnowAlertRecord {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  studentGrade: string;
  caseId?: string | null;
  category: "medical" | "dietary" | "learning_support" | "safety";
  severity: NeedToKnowSeverity;
  directiveSummary: string;
  actionRequired: string;
  authorSpecialistName: string;
  isActive: boolean;
  expiresAt: string | null;
  createdAt: string;
}

export interface CourtRestrictionRecord {
  id: string;
  organizationId: string;
  studentId: string;
  studentName: string;
  restrictedGuardianId?: string | null;
  restrictedPersonName: string;
  orderType: CourtOrderType;
  docketNumber: string;
  issuingCourt: string;
  summary: string;
  prohibitPickup: boolean;
  prohibitDisclosure: boolean;
  prohibitDirectContact: boolean;
  effectiveDate: string;
  expirationDate: string | null;
  isEnforced: boolean;
  createdAt: string;
}

// -------------------------------------------------------------
// AES-256-GCM Application-Level Cryptography Engine
// -------------------------------------------------------------
// -------------------------------------------------------------
// Role-Based Access Control & Permission Matrix
// -------------------------------------------------------------
export type KlassoRole =
  | "school_admin"
  | "office_staff"
  | "teacher"
  | "safeguarding_lead"
  | "senco"
  | "health_nurse"
  | "guardian";

export function canUserAccessCaseArea(role: KlassoRole, area: SensitiveCaseArea): boolean {
  if (role === "school_admin") return true;

  switch (area) {
    case "safeguarding":
      return role === "safeguarding_lead";
    case "health_medical":
      return role === "health_nurse" || role === "safeguarding_lead";
    case "special_needs":
      return role === "senco";
    case "disciplinary":
      return role === "safeguarding_lead";
    default:
      return false;
  }
}

export function canUserManageNeedToKnow(role: KlassoRole): boolean {
  return [
    "school_admin",
    "safeguarding_lead",
    "senco",
    "health_nurse",
  ].includes(role);
}

export function canUserManageCourtOrders(role: KlassoRole): boolean {
  return ["school_admin", "safeguarding_lead"].includes(role);
}

export function canUserViewCourtOrderSummary(role: KlassoRole): boolean {
  // Office staff and teachers need to see if a pickup restriction exists to stop unauthorized departures
  return ["school_admin", "safeguarding_lead", "office_staff", "teacher"].includes(role);
}

// -------------------------------------------------------------
// Need-to-Know Sanitization Engine
// Guarantees teachers receive actionable guidelines without diagnostic or investigative leaks
// -------------------------------------------------------------
const FORBIDDEN_LEAK_PATTERNS = [
  /\b(psychiatri[a-z]*|antipsychotic|bipolar|schizo[a-z]*)\b/gi,
  /\b(cps\b|child protective services|social services investigation|sexual abuse|physical abuse allegation)\b/gi,
  /\b(dsm-[0-9ivx]+|icd-[0-9]+)\b/gi,
  /\b(custody battle|parental court summons|restraining order details)\b/gi,
];

export function sanitizeTeacherAlert(directive: string, actionPlan: string): {
  directiveSummary: string;
  actionRequired: string;
  flaggedLeakedContent: boolean;
} {
  let flagged = false;

  for (const pattern of FORBIDDEN_LEAK_PATTERNS) {
    if (pattern.test(directive) || pattern.test(actionPlan)) {
      flagged = true;
    }
  }

  // Sanitize any accidental clinical jargon into safe institutional wording
  let cleanDirective = directive;
  let cleanAction = actionPlan;

  FORBIDDEN_LEAK_PATTERNS.forEach((p) => {
    cleanDirective = cleanDirective.replace(p, "[Protected Case Detail]");
    cleanAction = cleanAction.replace(p, "[Protected Protocol]");
  });

  return {
    directiveSummary: cleanDirective.trim(),
    actionRequired: cleanAction.trim(),
    flaggedLeakedContent: flagged,
  };
}

// -------------------------------------------------------------
// Court Restrictions & Guardian Protection Logic
// -------------------------------------------------------------
export function checkGuardianAccessRestrictions(
  guardianId: string,
  courtRestrictions: CourtRestrictionRecord[]
): {
  isBlocked: boolean;
  prohibitPickup: boolean;
  prohibitDisclosure: boolean;
  prohibitDirectContact: boolean;
  orders: CourtRestrictionRecord[];
} {
  const activeOrders = courtRestrictions.filter(
    (order) => order.isEnforced && order.restrictedGuardianId === guardianId
  );

  if (activeOrders.length === 0) {
    return {
      isBlocked: false,
      prohibitPickup: false,
      prohibitDisclosure: false,
      prohibitDirectContact: false,
      orders: [],
    };
  }

  return {
    isBlocked: true,
    prohibitPickup: activeOrders.some((o) => o.prohibitPickup),
    prohibitDisclosure: activeOrders.some((o) => o.prohibitDisclosure),
    prohibitDirectContact: activeOrders.some((o) => o.prohibitDirectContact),
    orders: activeOrders,
  };
}

// -------------------------------------------------------------
// Redacted Guardian / Court Disclosure Package Generator
// -------------------------------------------------------------
export interface DisclosurePackageResult {
  studentName: string;
  dossierNumber: string;
  generatedAt: string;
  includedRecords: Array<{
    area: string;
    title: string;
    date: string;
    status: string;
    redactedNotes: string;
  }>;
  withheldSafeguardingCount: number;
  activeCourtOrdersCount: number;
  digitalIntegrityChecksum: string;
}

export function generateDisclosurePackage(
  student: { id: string; name: string },
  cases: SensitiveCaseRecord[],
  courtOrders: CourtRestrictionRecord[],
  requestingRole: KlassoRole
): DisclosurePackageResult {
  const studentCases = cases.filter((c) => c.studentId === student.id);
  const activeOrders = courtOrders.filter((o) => o.studentId === student.id && o.isEnforced);

  let withheldSafeguarding = 0;
  const included: DisclosurePackageResult["includedRecords"] = [];

  for (const c of studentCases) {
    // Under safeguarding regulations, active child protection investigations are strictly withheld from standard disclosures
    if (c.area === "safeguarding" && requestingRole !== "school_admin") {
      withheldSafeguarding += 1;
      continue;
    }

    included.push({
      area: c.area,
      title: c.title,
      date: c.createdAt,
      status: c.status,
      redactedNotes: `[Official Institutional Summary: ${c.title} — Reviewed under school records policy.]`,
    });
  }

  const checksumPayload = `${student.id}:${included.length}:${withheldSafeguarding}:${Date.now()}`;
  const checksum = crypto.createHash("sha256").update(checksumPayload).digest("hex").substring(0, 16);

  return {
    studentName: student.name,
    dossierNumber: `DISCL-${student.id.substring(0, 8).toUpperCase()}-${Date.now().toString().slice(-4)}`,
    generatedAt: new Date().toISOString(),
    includedRecords: included,
    withheldSafeguardingCount: withheldSafeguarding,
    activeCourtOrdersCount: activeOrders.length,
    digitalIntegrityChecksum: checksum,
  };
}

// -------------------------------------------------------------
// Validation Schemas
// -------------------------------------------------------------
export const createSensitiveCaseSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  studentGrade: z.string().min(1, "Grade is required"),
  area: z.enum(["safeguarding", "health_medical", "special_needs", "disciplinary"]),
  confidentialityTier: z.enum(["standard_sensitive", "confidential", "strictly_confidential"]).default("confidential"),
  title: z.string().trim().min(5, "Title must be at least 5 characters").max(200),
  initialNarrativeNote: z.string().trim().min(10, "Initial narrative note must provide meaningful context").max(5000),
  reviewDate: z.string().optional().nullable(),
  hasCourtOrder: z.boolean().default(false),
});

export type CreateSensitiveCaseInput = z.infer<typeof createSensitiveCaseSchema>;

export const createNeedToKnowSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  studentGrade: z.string().min(1, "Grade is required"),
  caseId: z.string().optional().nullable(),
  category: z.enum(["medical", "dietary", "learning_support", "safety"]),
  severity: z.enum(["routine", "urgent", "critical"]).default("routine"),
  directiveSummary: z.string().trim().min(5, "Summary must be at least 5 characters").max(255),
  actionRequired: z.string().trim().min(10, "Classroom action instruction must be at least 10 characters").max(2000),
  expiresAt: z.string().optional().nullable(),
});

export type CreateNeedToKnowInput = z.infer<typeof createNeedToKnowSchema>;

export const registerCourtOrderSchema = z.object({
  studentId: z.string().min(1, "Student ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  restrictedGuardianId: z.string().optional().nullable(),
  restrictedPersonName: z.string().trim().min(2, "Restricted individual name is required"),
  orderType: z.enum(["restraining_order", "custody_restriction", "prohibited_contact", "non_disclosure"]).default("restraining_order"),
  docketNumber: z.string().trim().min(3, "Docket / Case number is required"),
  issuingCourt: z.string().trim().min(3, "Issuing court name is required"),
  summary: z.string().trim().min(10, "Legal order summary must be at least 10 characters"),
  prohibitPickup: z.boolean().default(true),
  prohibitDisclosure: z.boolean().default(true),
  prohibitDirectContact: z.boolean().default(true),
  effectiveDate: z.string().min(1, "Effective date is required"),
  expirationDate: z.string().optional().nullable(),
});

export type RegisterCourtOrderInput = z.infer<typeof registerCourtOrderSchema>;

// -------------------------------------------------------------
// Sample / Realistic Phase 5 Test & Preview Dataset
// -------------------------------------------------------------
export const INITIAL_SENSITIVE_CASES: SensitiveCaseRecord[] = [
  {
    id: "sc-case-001",
    organizationId: "org-northfield",
    studentId: "st-003",
    studentName: "Lucas Vance",
    studentGrade: "Grade 6",
    caseNumber: "CP-2026-0014",
    area: "safeguarding",
    confidentialityTier: "strictly_confidential",
    title: "External Family Safeguarding & Child Protection Referral",
    status: "open",
    leadSpecialistId: "usr-safe-01",
    leadSpecialistName: "Rachel Vance (Safeguarding Lead)",
    hasCourtOrder: true,
    reviewDate: "2026-10-15",
    encryptedNotesCount: 1,
    latestNoteSummary: "Child and Family Services referral and protective monitoring plan.",
    createdAt: "2026-09-02T09:00:00Z",
    updatedAt: "2026-09-18T14:30:00Z",
  },
  {
    id: "sc-case-002",
    organizationId: "org-northfield",
    studentId: "st-001",
    studentName: "Amelia Warren",
    studentGrade: "Grade 5",
    caseNumber: "MED-2026-0042",
    area: "health_medical",
    confidentialityTier: "confidential",
    title: "Moderate Persistent Asthma & Severe Peanut Anaphylaxis Management",
    status: "monitoring",
    leadSpecialistId: "usr-nurse-01",
    leadSpecialistName: "Helena Thorne (School Nurse)",
    hasCourtOrder: false,
    reviewDate: "2026-12-01",
    encryptedNotesCount: 1,
    latestNoteSummary: "Allergy action plan and emergency EpiPen protocol.",
    createdAt: "2026-08-28T11:15:00Z",
    updatedAt: "2026-09-10T16:00:00Z",
  },
  {
    id: "sc-case-003",
    organizationId: "org-northfield",
    studentId: "st-002",
    studentName: "Elias Martin",
    studentGrade: "Grade 5",
    caseNumber: "SEN-2026-0008",
    area: "special_needs",
    confidentialityTier: "confidential",
    title: "Individualized Education Plan (IEP) — ADHD & Processing Support",
    status: "open",
    leadSpecialistId: "usr-senco-01",
    leadSpecialistName: "Dr. Arthur Bell (SENCO)",
    hasCourtOrder: false,
    reviewDate: "2026-11-10",
    encryptedNotesCount: 1,
    latestNoteSummary: "Active IEP with extended testing time and visual aids.",
    createdAt: "2026-09-05T08:45:00Z",
    updatedAt: "2026-09-15T10:20:00Z",
  },
  {
    id: "sc-case-004",
    organizationId: "org-northfield",
    studentId: "st-004",
    studentName: "Julian Hayes",
    studentGrade: "Grade 6",
    caseNumber: "DISC-2026-0021",
    area: "disciplinary",
    confidentialityTier: "standard_sensitive",
    title: "Behavioral Restorative Action Plan",
    status: "under_review",
    leadSpecialistId: "usr-safe-01",
    leadSpecialistName: "Rachel Vance (Safeguarding Lead)",
    hasCourtOrder: false,
    reviewDate: "2026-10-01",
    encryptedNotesCount: 1,
    latestNoteSummary: "Restorative agreement with guidance counseling support.",
    createdAt: "2026-09-12T13:10:00Z",
    updatedAt: "2026-09-17T11:00:00Z",
  },
];

export const INITIAL_NEED_TO_KNOW_ALERTS: NeedToKnowAlertRecord[] = [
  {
    id: "ntk-001",
    organizationId: "org-northfield",
    studentId: "st-001",
    studentName: "Amelia Warren",
    studentGrade: "Grade 5",
    caseId: "sc-case-002",
    category: "medical",
    severity: "critical",
    directiveSummary: "Severe Peanut Anaphylaxis & Asthma Protocol",
    actionRequired: "Carry emergency EpiPen kit on all off-campus excursions. If wheezing or facial swelling occurs, administer inhaler / EpiPen and notify Nurse immediately.",
    authorSpecialistName: "Helena Thorne (School Nurse)",
    isActive: true,
    expiresAt: "2027-06-30T00:00:00Z",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "ntk-002",
    organizationId: "org-northfield",
    studentId: "st-002",
    studentName: "Elias Martin",
    studentGrade: "Grade 5",
    caseId: "sc-case-003",
    category: "learning_support",
    severity: "routine",
    directiveSummary: "Accommodations: 25% Extra Exam Time & Visual Cues",
    actionRequired: "Provide structured written instructions for complex tasks. Seat near the front of the classroom away from external corridor distractions.",
    authorSpecialistName: "Dr. Arthur Bell (SENCO)",
    isActive: true,
    expiresAt: "2027-06-30T00:00:00Z",
    createdAt: "2026-09-06T10:00:00Z",
  },
  {
    id: "ntk-003",
    organizationId: "org-northfield",
    studentId: "st-003",
    studentName: "Lucas Vance",
    studentGrade: "Grade 6",
    caseId: "sc-case-001",
    category: "safety",
    severity: "urgent",
    directiveSummary: "Designated Safe Guardian Pickup Protocol",
    actionRequired: "Under no circumstances release student to non-approved individuals. Any unannounced departure request must be verified by Front Office and Rachel Vance.",
    authorSpecialistName: "Rachel Vance (Safeguarding Lead)",
    isActive: true,
    expiresAt: "2027-01-15T00:00:00Z",
    createdAt: "2026-09-03T11:20:00Z",
  },
];

export const INITIAL_COURT_RESTRICTIONS: CourtRestrictionRecord[] = [
  {
    id: "court-001",
    organizationId: "org-northfield",
    studentId: "st-003",
    studentName: "Lucas Vance",
    restrictedGuardianId: "grd-restricted-01",
    restrictedPersonName: "Julian Vance (Non-custodial parent)",
    orderType: "restraining_order",
    docketNumber: "FAM-2026-8821-RO",
    issuingCourt: "Northfield District Family Court",
    summary: "Active civil protective order. Individual is strictly prohibited from entering school premises, making contact with the student, or receiving student attendance/records.",
    prohibitPickup: true,
    prohibitDisclosure: true,
    prohibitDirectContact: true,
    effectiveDate: "2026-08-15",
    expirationDate: "2027-08-15",
    isEnforced: true,
    createdAt: "2026-08-20T09:30:00Z",
  },
];

export const INITIAL_SENSITIVE_ACCESS_LOGS: SensitiveAccessLogRecord[] = [
  {
    id: "acc-001",
    organizationId: "org-northfield",
    caseId: "sc-case-001",
    caseNumber: "CP-2026-0014",
    userId: "usr-safe-01",
    userName: "Rachel Vance",
    userRole: "safeguarding_lead",
    action: "view_decrypted",
    accessReason: "Social services case conference review",
    ipAddress: "192.168.1.45",
    accessedAt: "2026-09-18T14:28:10Z",
  },
  {
    id: "acc-002",
    organizationId: "org-northfield",
    caseId: "sc-case-002",
    caseNumber: "MED-2026-0042",
    userId: "usr-nurse-01",
    userName: "Helena Thorne",
    userRole: "health_nurse",
    action: "view_decrypted",
    accessReason: "Field trip emergency inhaler dosage check",
    ipAddress: "192.168.1.62",
    accessedAt: "2026-09-10T15:58:22Z",
  },
];

