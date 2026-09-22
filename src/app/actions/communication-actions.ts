"use server";

import { requireDemoAction } from "@/lib/action-access";

import { revalidatePath } from "next/cache";
import { logAuditEvent, AuditActions } from "@/lib/audit";
import {
  type AnnouncementInput,
  type EmergencyBroadcastInput,
  type GuardianConsentInput,
  type AnnouncementRecord,
  type GuardianConsentRecord,
  type CommunicationTemplateItem,
  type SmsDeliveryItem,
  announcementInputSchema,
  emergencyBroadcastInputSchema,
  guardianConsentInputSchema,
  validateEmergencyApproval,
  canDispatchSms,
  calculateSmsSegments,
  INITIAL_ANNOUNCEMENTS,
  INITIAL_GUARDIAN_CONSENTS,
  DEFAULT_COMMUNICATION_TEMPLATES,
  INITIAL_SMS_DELIVERY_LOGS,
} from "@/lib/communications";

const DEFAULT_ORG_ID = "00000000-0000-0000-0000-000000000001";

// IN-MEMORY FALLBACK STORE (persists across user session actions in preview/server environment)
const localAnnouncements: AnnouncementRecord[] = [...INITIAL_ANNOUNCEMENTS];
const localConsents: GuardianConsentRecord[] = [...INITIAL_GUARDIAN_CONSENTS];
const localTemplates: CommunicationTemplateItem[] = [...DEFAULT_COMMUNICATION_TEMPLATES];
const localSmsLedger: SmsDeliveryItem[] = [...INITIAL_SMS_DELIVERY_LOGS];

// Set of read receipt keys: `${announcementId}_${userId}`
const localReadReceipts = new Set<string>([
  "anc-01_usr-admin-1",
  "anc-02_usr-admin-1",
  "anc-03_usr-admin-1",
]);

export async function getAnnouncementsAction() {
  await requireDemoAction();
  return {
    success: true,
    announcements: [...localAnnouncements].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  };
}

export async function getCommunicationTemplatesAction() {
  await requireDemoAction();
  return {
    success: true,
    templates: [...localTemplates],
  };
}

export async function getGuardianConsentsAction() {
  await requireDemoAction();
  return {
    success: true,
    consents: [...localConsents],
  };
}

export async function getSmsDeliveryLedgerAction() {
  await requireDemoAction();
  const totalDispatches = localSmsLedger.length;
  const totalCost = localSmsLedger.reduce((sum, item) => sum + item.cost, 0);
  const totalSegments = localSmsLedger.reduce((sum, item) => sum + item.segments, 0);
  const deliveredCount = localSmsLedger.filter((i) => i.status === "delivered").length;

  return {
    success: true,
    ledger: [...localSmsLedger].sort(
      (a, b) => new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime(),
    ),
    summary: {
      totalDispatches,
      totalCost: Number(totalCost.toFixed(3)),
      totalSegments,
      deliveredCount,
    },
  };
}

export async function createAnnouncementAction(
  rawInput: AnnouncementInput,
  actorName = "Sarah Jenkins (Registrar)",
) {
  await requireDemoAction();
  const parseResult = announcementInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid announcement parameters",
    };
  }

  const input = parseResult.data;

  // Emergency announcements cannot be dispatched via single-party standard creation
  if (input.priority === "emergency") {
    return {
      success: false,
      error: "Emergency broadcasts require Four-Eyes two-party authorization in the Emergency Command Center.",
    };
  }

  if ((input.channels === "sms" || input.channels === "both") && input.targetType !== "school") {
    return { success: false, error: "Class and grade SMS audiences are not implemented. Use an in-app preview or school-wide SMS simulation." };
  }

  // Resolve target audience label and simulated count
  let targetLabel = "Entire Northfield Academy";
  let targetCount = 142;

  if (input.targetType === "grade") {
    targetLabel = `Grade ${input.targetId === "all" ? "Level" : input.targetId.replace("grade-", "")} Cohort`;
    targetCount = 38;
  } else if (input.targetType === "class") {
    targetLabel = input.targetId === "class-10a" ? "Class 10-A" : `Class ${input.targetId}`;
    targetCount = 22;
  }

  const newId = `anc-${Date.now().toString(36)}`;
  const nowStr = new Date().toISOString();

  const newAnnouncement: AnnouncementRecord = {
    id: newId,
    organizationId: DEFAULT_ORG_ID,
    title: input.title,
    content: input.content,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel,
    priority: input.priority,
    channels: input.channels,
    status: input.scheduledFor ? "scheduled" : "published",
    requiresTwoParty: false,
    authorId: "usr-admin-1",
    authorName: actorName,
    targetRecipientCount: targetCount,
    readCount: 0,
    scheduledFor: input.scheduledFor ?? null,
    publishedAt: input.scheduledFor ? null : nowStr,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  localAnnouncements.unshift(newAnnouncement);

  // If SMS channel is included, simulate telecommunication dispatch filtered by guardian consent
  if (!input.scheduledFor && (input.channels === "sms" || input.channels === "both")) {
    const { segments } = calculateSmsSegments(input.content);

    // Filter by consent
    for (const consent of localConsents) {
      const consentCheck = canDispatchSms(consent, "announcements", false);
      if (consentCheck.allowed) {
        localSmsLedger.unshift({
          id: `sms-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
          recipientPhone: consent.phone,
          recipientName: consent.guardianName,
          announcementTitle: input.title,
          channel: "sms",
          segments,
          cost: 0,
          status: "simulated",
          sentAt: nowStr,
        });
      }
    }
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actorName,
    action: AuditActions.ANNOUNCEMENT_CREATED,
    entityType: "announcement",
    entityId: newId,
    metadata: {
      title: input.title,
      targetType: input.targetType,
      channels: input.channels,
      priority: input.priority,
      targetRecipientCount: targetCount,
    },
  });

  if (!input.scheduledFor) {
    await logAuditEvent({
      organizationId: DEFAULT_ORG_ID,
      actorUserId: actorName,
      action: AuditActions.ANNOUNCEMENT_PUBLISHED,
      entityType: "announcement",
      entityId: newId,
      metadata: { title: input.title, publishedAt: nowStr },
    });
  }

  revalidatePath("/");
  return { success: true, announcement: newAnnouncement };
}

export async function initiateEmergencyBroadcastAction(
  rawInput: EmergencyBroadcastInput,
  initiatorName = "Sarah Jenkins (Registrar)",
) {
  await requireDemoAction();
  const parseResult = emergencyBroadcastInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid emergency broadcast parameters",
    };
  }

  const input = parseResult.data;

  // Four-Eyes Principle validation
  const approvalValidation = validateEmergencyApproval(
    input.firstApproverId,
    input.secondApproverId,
  );
  if (!approvalValidation.valid) {
    return {
      success: false,
      error: approvalValidation.error ?? "Two-party authorization failure.",
    };
  }

  const newId = `anc-emerg-${Date.now().toString(36)}`;
  const nowStr = new Date().toISOString();
  const targetCount = 142; // School-wide emergency recipient baseline

  const approverNames: Record<string, string> = {
    "usr-admin-1": "Sarah Jenkins (Registrar)",
    "usr-principal-1": "Dr. Arthur Vance (Headmaster)",
    "usr-vp-1": "Marcus Brody (Vice Principal)",
    "usr-safety-1": "Capt. James Cole (Campus Safety Director)",
  };

  if (!Object.hasOwn(approverNames, input.firstApproverId) || !Object.hasOwn(approverNames, input.secondApproverId)) {
    return { success: false, error: "Select two recognized demo approvers. This does not constitute live authorization." };
  }

  const firstApproverName = approverNames[input.firstApproverId] ?? "Authorized Officer A";
  const secondApproverName = approverNames[input.secondApproverId] ?? "Authorized Officer B";

  const newEmergency: AnnouncementRecord = {
    id: newId,
    organizationId: DEFAULT_ORG_ID,
    title: input.title,
    content: input.content,
    targetType: input.targetType,
    targetId: input.targetId,
    targetLabel: "Entire Northfield Academy (All Campuses)",
    priority: "emergency",
    channels: input.channels,
    status: "published",
    requiresTwoParty: true,
    firstApproverId: input.firstApproverId,
    firstApproverName,
    secondApproverId: input.secondApproverId,
    secondApproverName,
    authorId: input.firstApproverId,
    authorName: initiatorName,
    targetRecipientCount: targetCount,
    readCount: 1, // Author read receipt
    publishedAt: nowStr,
    createdAt: nowStr,
    updatedAt: nowStr,
  };

  localAnnouncements.unshift(newEmergency);

  // Dispatch emergency SMS with emergency override active across all guardians
  const { segments } = calculateSmsSegments(input.content);
  for (const consent of input.channels === "in_app" ? [] : localConsents) {
    const consentCheck = canDispatchSms(consent, "emergency", true);
    if (consentCheck.allowed) {
      localSmsLedger.unshift({
        id: `sms-emerg-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
        recipientPhone: consent.phone,
        recipientName: consent.guardianName,
        announcementTitle: `[EMERGENCY] ${input.title}`,
        channel: "sms",
        segments,
        cost: 0,
        status: "simulated",
        sentAt: nowStr,
      });
    }
  }

  // Dual audit trail
  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: firstApproverName,
    action: AuditActions.EMERGENCY_BROADCAST_INITIATED,
    entityType: "emergency_broadcast",
    entityId: newId,
    metadata: {
      title: input.title,
      channels: input.channels,
      firstApproverId: input.firstApproverId,
    },
  });

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: secondApproverName,
    action: AuditActions.EMERGENCY_BROADCAST_CONFIRMED,
    entityType: "emergency_broadcast",
    entityId: newId,
    metadata: {
      title: input.title,
      firstApproverId: input.firstApproverId,
      secondApproverId: input.secondApproverId,
      publishedAt: nowStr,
    },
  });

  revalidatePath("/");
  return { success: true, emergencyAnnouncement: newEmergency };
}

export async function recordAnnouncementReadAction(announcementId: string, userId: string) {
  await requireDemoAction();
  const key = `${announcementId}_${userId}`;
  if (!localReadReceipts.has(key)) {
    localReadReceipts.add(key);
    const target = localAnnouncements.find((a) => a.id === announcementId);
    if (target) {
      target.readCount = Math.min(target.targetRecipientCount, target.readCount + 1);
    }
  }

  return { success: true, readReceiptsCount: localReadReceipts.size };
}

export async function updateGuardianConsentAction(
  rawInput: GuardianConsentInput,
  actorName = "David Warren (Guardian)",
) {
  await requireDemoAction();
  const parseResult = guardianConsentInputSchema.safeParse(rawInput);
  if (!parseResult.success) {
    return {
      success: false,
      error: parseResult.error.issues[0]?.message ?? "Invalid consent payload",
    };
  }

  const input = parseResult.data;
  const consentIndex = localConsents.findIndex((c) => c.guardianId === input.guardianId);
  const nowStr = new Date().toISOString();

  if (consentIndex >= 0) {
    localConsents[consentIndex] = {
      ...localConsents[consentIndex],
      phone: input.phone,
      optInSmsAnnouncements: input.optInSmsAnnouncements,
      optInSmsAttendance: input.optInSmsAttendance,
      optInSmsEmergency: input.optInSmsEmergency,
      optOutReason: input.optOutReason ?? null,
      optOutAt:
        !input.optInSmsAnnouncements || !input.optInSmsAttendance ? nowStr : null,
      updatedAt: nowStr,
    };
  } else {
    localConsents.push({
      id: `cst-${Date.now().toString(36)}`,
      guardianId: input.guardianId,
      guardianName: actorName,
      studentName: "Student",
      phone: input.phone,
      optInSmsAnnouncements: input.optInSmsAnnouncements,
      optInSmsAttendance: input.optInSmsAttendance,
      optInSmsEmergency: input.optInSmsEmergency,
      optOutReason: input.optOutReason ?? null,
      optOutAt:
        !input.optInSmsAnnouncements || !input.optInSmsAttendance ? nowStr : null,
      updatedAt: nowStr,
    });
  }

  await logAuditEvent({
    organizationId: DEFAULT_ORG_ID,
    actorUserId: actorName,
    action: AuditActions.GUARDIAN_CONSENT_UPDATED,
    entityType: "guardian_consent",
    entityId: input.guardianId,
    metadata: {
      phone: input.phone,
      optInSmsAnnouncements: input.optInSmsAnnouncements,
      optInSmsAttendance: input.optInSmsAttendance,
      optInSmsEmergency: input.optInSmsEmergency,
    },
  });

  revalidatePath("/");
  return { success: true, consent: localConsents.find((c) => c.guardianId === input.guardianId) };
}

export async function getGuardianNoticesAction(studentId?: string) {
  await requireDemoAction();
  // Return all published announcements visible to guardians
  const notices = localAnnouncements.filter((a) => a.status === "published");
  const consent = studentId
    ? localConsents.find((c) => c.guardianId === "grd-001") ?? localConsents[0]
    : localConsents[0];

  return {
    success: true,
    notices,
    consent,
  };
}
