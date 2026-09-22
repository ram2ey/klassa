"use server";
import { requireDemoAction } from "@/lib/action-access";

import { revalidatePath } from "next/cache";
import {
  type CreateGdprRequestInput,
  type GdprRequestRecord,
  createGdprRequestSchema,
  generateStudentDataPortabilityPackage,
  anonymizeStudentPII,
  INITIAL_GDPR_REQUESTS,
} from "@/lib/gdpr";
import { logAuditEvent, AuditActions } from "@/lib/audit";
import { checkRateLimit } from "@/lib/rate-limit";

const DEFAULT_ORG_ID = "org-northfield";
const localGdprRequests: GdprRequestRecord[] = [...INITIAL_GDPR_REQUESTS];

export async function getGdprRequestsAction() {
  await requireDemoAction();
  return {
    success: true,
    requests: [...localGdprRequests],
  };
}

export async function submitGdprRequestAction(
  input: CreateGdprRequestInput,
  userId: string = "usr-guest"
) {
  await requireDemoAction();
  // Rate limit check
  const rl = checkRateLimit("general", userId);
  if (!rl.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Try again in ${rl.retryAfter} seconds.`,
    };
  }

  const parsed = createGdprRequestSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || "Invalid GDPR request input",
    };
  }

  const reqId = `gdpr-${Date.now()}`;
  const newRequest: GdprRequestRecord = {
    id: reqId,
    organizationId: DEFAULT_ORG_ID,
    studentId: input.studentId,
    studentName: input.studentName,
    requestType: input.requestType,
    status: "pending",
    requesterName: input.requesterName,
    requesterRole: input.requesterRole,
    requesterEmail: input.requesterEmail,
    justification: input.justification,
    safeguardingRedacted: input.requesterRole === "guardian" || input.requesterRole === "parent",
    createdAt: new Date().toISOString(),
  };

  localGdprRequests.unshift(newRequest);

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.GDPR_PORTABILITY_EXPORTED,
    entityType: "gdpr_request",
    entityId: reqId,
    metadata: {
      studentId: input.studentId,
      requestType: input.requestType,
      requesterEmail: input.requesterEmail,
    },
  });

  revalidatePath("/");
  return { success: true, request: newRequest };
}

export async function executeExportPackageAction(
  studentId: string,
  studentName: string,
  requesterRole: string,
  userId: string
) {
  await requireDemoAction();
  const rl = checkRateLimit("sensitive", userId);
  if (!rl.allowed) {
    return {
      success: false,
      error: `Rate limit exceeded. Please wait ${rl.retryAfter} seconds before exporting another dossier.`,
    };
  }

  const dossier = generateStudentDataPortabilityPackage(studentId, studentName, requesterRole);

  // Update request status if present
  const req = localGdprRequests.find(
    (r) => r.studentId === studentId && r.requestType === "export" && r.status === "pending"
  );
  if (req) {
    req.status = "completed";
    req.processedAt = new Date().toISOString();
    req.processedBy = userId;
    req.resultExportUrl = `/api/v1/gdpr/export/${studentId}`;
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: userId,
    action: AuditActions.GDPR_PORTABILITY_EXPORTED,
    entityType: "student_dossier",
    entityId: studentId,
    metadata: {
      studentName,
      requesterRole,
      safeguardingRedacted: dossier.exportMetadata.safeguardingRedacted,
    },
  });

  revalidatePath("/");
  return { success: true, dossier };
}

export async function executeAnonymizeStudentAction(
  student: { id: string; firstName: string; lastName: string; dateOfBirth: string },
  justification: string,
  operatorRole: string,
  operatorId: string
) {
  await requireDemoAction();
  void [student, justification, operatorRole, operatorId];
  return { success: false, anonymizedStudent: undefined as ReturnType<typeof anonymizeStudentPII> | undefined,
    error: "Anonymization is unavailable: this preview cannot erase all linked records. No records were changed and no request was marked complete." };
}

export async function toggleProcessingRestrictionAction(
  studentId: string,
  isRestricted: boolean,
  justification: string,
  operatorId: string
) {
  await requireDemoAction();
  const req = localGdprRequests.find(
    (r) => r.studentId === studentId && r.requestType === "restrict"
  );
  if (req) {
    req.status = isRestricted ? "completed" : "in_review";
    req.isProcessingRestricted = isRestricted;
    req.processedAt = new Date().toISOString();
    req.processedBy = operatorId;
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: operatorId,
    action: AuditActions.GDPR_PROCESSING_RESTRICTED,
    entityType: "student",
    entityId: studentId,
    metadata: {
      isRestricted,
      justification,
    },
  });

  revalidatePath("/");
  return { success: true, isRestricted };
}

