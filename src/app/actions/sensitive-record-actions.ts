"use server";
import { encryptNarrative, decryptNarrative } from "@/lib/narrative-crypto";
import { INITIAL_ENCRYPTED_NOTES, DEMO_KEY } from "@/lib/sensitive-record-fixtures";

import { requireDemoAction } from "@/lib/action-access";

import { revalidatePath } from "next/cache";
import { logAuditEvent, AuditActions } from "@/lib/audit";
import {
  type SensitiveCaseRecord,
  type EncryptedCaseNote,
  type SensitiveAccessLogRecord,
  type NeedToKnowAlertRecord,
  type CourtRestrictionRecord,
  type CreateSensitiveCaseInput,
  type CreateNeedToKnowInput,
  type RegisterCourtOrderInput,
  type KlassoRole,
  type DisclosurePackageResult,
  canUserAccessCaseArea,
  canUserManageNeedToKnow,
  canUserManageCourtOrders,
  canUserViewCourtOrderSummary,
  sanitizeTeacherAlert,
  generateDisclosurePackage,
  createSensitiveCaseSchema,
  createNeedToKnowSchema,
  registerCourtOrderSchema,
  INITIAL_SENSITIVE_CASES,
  INITIAL_NEED_TO_KNOW_ALERTS,
  INITIAL_COURT_RESTRICTIONS,
  INITIAL_SENSITIVE_ACCESS_LOGS,
} from "@/lib/sensitive-records";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// IN-MEMORY FALLBACK STORE (persists across user session actions in preview/server environment)
const localCases: SensitiveCaseRecord[] = [...INITIAL_SENSITIVE_CASES];
const localNotes: EncryptedCaseNote[] = [...INITIAL_ENCRYPTED_NOTES];
const localAlerts: NeedToKnowAlertRecord[] = [...INITIAL_NEED_TO_KNOW_ALERTS];
const localCourtRestrictions: CourtRestrictionRecord[] = [...INITIAL_COURT_RESTRICTIONS];
const localAccessLogs: SensitiveAccessLogRecord[] = [...INITIAL_SENSITIVE_ACCESS_LOGS];

export async function getSensitiveCasesAction(userRole: KlassoRole) {
  await requireDemoAction();
  if (userRole === "teacher" || userRole === "guardian") {
    return {
      success: false,
      error: "Access Denied: Teachers and Guardians are prohibited from accessing raw sensitive case records.",
      cases: [],
    };
  }

  const authorizedCases = localCases.filter((c) => canUserAccessCaseArea(userRole, c.area));

  return {
    success: true,
    cases: [...authorizedCases].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    ),
  };
}

export async function createSensitiveCaseAction(
  input: CreateSensitiveCaseInput,
  userRole: KlassoRole,
  userId: string,
  userName: string
) {
  await requireDemoAction();
  const parsed = createSensitiveCaseSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid case parameters",
    };
  }

  if (!canUserAccessCaseArea(userRole, input.area)) {
    return {
      success: false,
      error: `Access Denied: Role '${userRole}' is not authorized to create records in area '${input.area}'.`,
    };
  }

  const prefixMap: Record<string, string> = {
    safeguarding: "CP",
    health_medical: "MED",
    special_needs: "SEN",
    disciplinary: "DISC",
  };
  const prefix = prefixMap[input.area] || "CASE";
  const caseNumber = `${prefix}-2026-${String(localCases.length + 10).padStart(4, "0")}`;
  const caseId = `sc-case-${Date.now()}`;
  const nowStr = new Date().toISOString();

  // 1. Application-level AES-256-GCM encryption of initial narrative note
  const encrypted = encryptNarrative(input.initialNarrativeNote, DEMO_KEY);
  const noteId = `note-${Date.now()}`;

  const newNote: EncryptedCaseNote = {
    id: noteId,
    caseId,
    authorId: userId,
    authorName: userName,
    noteType: "initial_case_intake",
    confidentialityTier: input.confidentialityTier,
    encryptedCiphertext: encrypted.ciphertext,
    ivHex: encrypted.ivHex,
    authTagHex: encrypted.authTagHex,
    isQuarantined: false,
    createdAt: nowStr,
  };
  localNotes.unshift(newNote);

  // 2. Create the case index record
  const newCase: SensitiveCaseRecord = {
    id: caseId,
    organizationId: DEFAULT_ORG_ID,
    studentId: input.studentId,
    studentName: input.studentName,
    studentGrade: input.studentGrade,
    caseNumber,
    area: input.area,
    confidentialityTier: input.confidentialityTier,
    title: input.title,
    status: "open",
    leadSpecialistId: userId,
    leadSpecialistName: `${userName} (${userRole})`,
    hasCourtOrder: input.hasCourtOrder,
    reviewDate: input.reviewDate || null,
    encryptedNotesCount: 1,
    latestNoteSummary: input.title,
    createdAt: nowStr,
    updatedAt: nowStr,
  };
  localCases.unshift(newCase);

  // 3. Log centralized audit events for case creation
  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.SENSITIVE_CASE_CREATED,
    entityType: "sensitive_case",
    entityId: caseId,
    metadata: {
      caseNumber,
      area: input.area,
      studentName: input.studentName,
      confidentialityTier: input.confidentialityTier,
    },
  });

  revalidatePath("/");

  return {
    success: true,
    caseRecord: newCase,
  };
}

export async function viewSensitiveCaseDetailAction(
  caseId: string,
  userRole: KlassoRole,
  userId: string,
  userName: string,
  accessReason: string,
  ipAddress: string = "127.0.0.1"
) {
  await requireDemoAction();
  const caseItem = localCases.find((c) => c.id === caseId);
  if (!caseItem) {
    return { success: false, error: "Case not found" };
  }

  if (!canUserAccessCaseArea(userRole, caseItem.area)) {
    return {
      success: false,
      error: `Access Denied: Role '${userRole}' lacks clearance to view ${caseItem.area} confidential files.`,
    };
  }

  if (!accessReason || accessReason.trim().length < 5) {
    return {
      success: false,
      error: "Mandatory Security Requirement: A legitimate access justification (minimum 5 characters) must be entered to decrypt confidential case notes.",
    };
  }

  // 1. Mandatory Read Auditing: Every view of confidential files is written to immutable access log
  const accessLogId = `acc-${Date.now()}`;
  const accessRecord: SensitiveAccessLogRecord = {
    id: accessLogId,
    organizationId: DEFAULT_ORG_ID,
    caseId: caseItem.id,
    caseNumber: caseItem.caseNumber,
    userId,
    userName,
    userRole,
    action: "view_decrypted",
    accessReason: accessReason.trim(),
    ipAddress,
    accessedAt: new Date().toISOString(),
  };
  localAccessLogs.unshift(accessRecord);

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.SENSITIVE_RECORD_DECRYPTED,
    entityType: "sensitive_case",
    entityId: caseItem.id,
    metadata: {
      caseNumber: caseItem.caseNumber,
      accessReason: accessReason.trim(),
      userRole,
      ipAddress,
    },
  });

  // 2. Decrypt each narrative note
  const notes = localNotes.filter((n) => n.caseId === caseId);
  const decryptedNotes = notes.map((n) => {
    try {
      const plaintext = decryptNarrative(n.encryptedCiphertext, n.ivHex, n.authTagHex, DEMO_KEY);
      return {
        ...n,
        decryptedText: plaintext,
      };
    } catch {
      return {
        ...n,
        decryptedText: "[DECRYPTION_FAILED: Tampering or cryptographic key mismatch detected]",
      };
    }
  });

  return {
    success: true,
    caseRecord: caseItem,
    notes: decryptedNotes,
    accessLogRecord: accessRecord,
  };
}

export async function getNeedToKnowAlertsAction(userRole: KlassoRole) {
  await requireDemoAction();
  if (userRole === "guardian") {
    return { success: false, alerts: [], error: "Guardians cannot access internal teacher alerts." };
  }

  return {
    success: true,
    alerts: [...localAlerts].sort((a, b) => {
      // Prioritize critical, then urgent, then routine
      const order = { critical: 0, urgent: 1, routine: 2 };
      return order[a.severity] - order[b.severity];
    }),
  };
}

export async function createNeedToKnowAlertAction(
  input: CreateNeedToKnowInput,
  userRole: KlassoRole,
  userId: string,
  userName: string
) {
  await requireDemoAction();
  const parsed = createNeedToKnowSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid need-to-know alert parameters",
    };
  }

  if (!canUserManageNeedToKnow(userRole)) {
    return {
      success: false,
      error: `Access Denied: Role '${userRole}' cannot publish Need-to-Know teacher alerts.`,
    };
  }

  // Sanitize directives to avoid clinical/investigative diagnostic leaks
  const sanitized = sanitizeTeacherAlert(input.directiveSummary, input.actionRequired);

  const alertId = `ntk-${Date.now()}`;
  const newAlert: NeedToKnowAlertRecord = {
    id: alertId,
    organizationId: DEFAULT_ORG_ID,
    studentId: input.studentId,
    studentName: input.studentName,
    studentGrade: input.studentGrade,
    caseId: input.caseId || null,
    category: input.category,
    severity: input.severity,
    directiveSummary: sanitized.directiveSummary,
    actionRequired: sanitized.actionRequired,
    authorSpecialistName: `${userName} (${userRole})`,
    isActive: true,
    expiresAt: input.expiresAt || null,
    createdAt: new Date().toISOString(),
  };

  localAlerts.unshift(newAlert);

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.NEED_TO_KNOW_ALERT_CREATED,
    entityType: "need_to_know_alert",
    entityId: alertId,
    metadata: {
      studentName: input.studentName,
      category: input.category,
      severity: input.severity,
      sanitized: sanitized.flaggedLeakedContent,
    },
  });

  revalidatePath("/");

  return {
    success: true,
    alert: newAlert,
    flaggedClinicalContent: sanitized.flaggedLeakedContent,
  };
}

export async function resolveNeedToKnowAlertAction(alertId: string, userRole: KlassoRole, userId: string) {
  await requireDemoAction();
  if (!canUserManageNeedToKnow(userRole)) {
    return { success: false, error: "Access Denied: Only specialists or administrators can resolve alerts." };
  }

  const alertIndex = localAlerts.findIndex((a) => a.id === alertId);
  if (alertIndex === -1) {
    return { success: false, error: "Alert not found" };
  }

  localAlerts[alertIndex] = {
    ...localAlerts[alertIndex],
    isActive: false,
  };

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.NEED_TO_KNOW_ALERT_RESOLVED,
    entityType: "need_to_know_alert",
    entityId: alertId,
    metadata: { studentName: localAlerts[alertIndex].studentName },
  });

  revalidatePath("/");

  return { success: true };
}

export async function getCourtRestrictionsAction(userRole: KlassoRole) {
  await requireDemoAction();
  if (!canUserViewCourtOrderSummary(userRole)) {
    return { success: false, restrictions: [], error: "Access Denied" };
  }

  return {
    success: true,
    restrictions: [...localCourtRestrictions],
  };
}

export async function registerCourtRestrictionAction(
  input: RegisterCourtOrderInput,
  userRole: KlassoRole,
  userId: string,
  userName: string
) {
  await requireDemoAction();
  const parsed = registerCourtOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid court order input",
    };
  }

  if (!canUserManageCourtOrders(userRole)) {
    return {
      success: false,
      error: `Access Denied: Role '${userRole}' cannot register statutory court restrictions.`,
    };
  }

  const orderId = `court-${Date.now()}`;
  const newOrder: CourtRestrictionRecord = {
    id: orderId,
    organizationId: DEFAULT_ORG_ID,
    studentId: input.studentId,
    studentName: input.studentName,
    restrictedGuardianId: input.restrictedGuardianId || null,
    restrictedPersonName: input.restrictedPersonName,
    orderType: input.orderType,
    docketNumber: input.docketNumber,
    issuingCourt: input.issuingCourt,
    summary: input.summary,
    prohibitPickup: input.prohibitPickup,
    prohibitDisclosure: input.prohibitDisclosure,
    prohibitDirectContact: input.prohibitDirectContact,
    effectiveDate: input.effectiveDate,
    expirationDate: input.expirationDate || null,
    isEnforced: true,
    createdAt: new Date().toISOString(),
  };

  localCourtRestrictions.unshift(newOrder);

  // If student has a matching case, update hasCourtOrder
  const matchingCase = localCases.find((c) => c.studentId === input.studentId);
  if (matchingCase) {
    matchingCase.hasCourtOrder = true;
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.COURT_RESTRICTION_LOGGED,
    entityType: "court_restriction",
    entityId: orderId,
    metadata: {
      studentName: input.studentName,
      restrictedPerson: input.restrictedPersonName,
      docketNumber: input.docketNumber,
      orderType: input.orderType,
      registeredByName: userName,
    },
  });

  revalidatePath("/");

  return {
    success: true,
    order: newOrder,
  };
}

export async function generateStudentDisclosureAction(
  studentId: string,
  studentName: string,
  requestingRole: KlassoRole,
  userId: string
): Promise<{ success: boolean; package?: DisclosurePackageResult; error?: string }> {
  await requireDemoAction();
  if (requestingRole === "guardian" || requestingRole === "teacher") {
    return {
      success: false,
      error: "Access Denied: Formal student disclosure packages must be generated by authorized school administrative or specialist staff.",
    };
  }

  const pkg = generateDisclosurePackage(
    { id: studentId, name: studentName },
    localCases,
    localCourtRestrictions,
    requestingRole
  );

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.DISCLOSURE_PACKAGE_EXPORTED,
    entityType: "disclosure_package",
    entityId: pkg.dossierNumber,
    metadata: {
      studentName,
      includedCount: pkg.includedRecords.length,
      withheldSafeguarding: pkg.withheldSafeguardingCount,
      checksum: pkg.digitalIntegrityChecksum,
    },
  });

  return {
    success: true,
    package: pkg,
  };
}

export async function getSensitiveAccessLogsAction(userRole: KlassoRole) {
  await requireDemoAction();
  if (userRole !== "school_admin" && userRole !== "safeguarding_lead") {
    return {
      success: false,
      logs: [],
      error: "Access Denied: Access log review is restricted to School Administration and Safeguarding Officers.",
    };
  }

  return {
    success: true,
    logs: [...localAccessLogs],
  };
}

