import { z } from "zod";

export type AnnouncementTarget = "school" | "grade" | "class";
export type AnnouncementPriority = "normal" | "urgent" | "emergency";
export type AnnouncementStatus = "draft" | "scheduled" | "published" | "archived";
export type DeliveryChannel = "in_app" | "sms" | "both";
export type CommunicationCategory = "announcements" | "attendance" | "emergency";

export interface GuardianConsentRecord {
  id: string;
  guardianId: string;
  guardianName: string;
  studentName: string;
  phone: string;
  optInSmsAnnouncements: boolean;
  optInSmsAttendance: boolean;
  optInSmsEmergency: boolean;
  optOutReason?: string | null;
  optOutAt?: Date | string | null;
  updatedAt: Date | string;
}

export interface AnnouncementRecord {
  id: string;
  organizationId: string;
  title: string;
  content: string;
  targetType: AnnouncementTarget;
  targetId: string;
  targetLabel: string;
  priority: AnnouncementPriority;
  channels: DeliveryChannel;
  status: AnnouncementStatus;
  requiresTwoParty: boolean;
  firstApproverId?: string | null;
  firstApproverName?: string | null;
  secondApproverId?: string | null;
  secondApproverName?: string | null;
  scheduledFor?: Date | string | null;
  publishedAt?: Date | string | null;
  authorId?: string | null;
  authorName?: string | null;
  targetRecipientCount: number;
  readCount: number;
  createdAt: Date | string;
  updatedAt: Date | string;
}

export interface CommunicationTemplateItem {
  id: string;
  title: string;
  category: string;
  contentTemplate: string;
  defaultPriority: AnnouncementPriority;
  suggestedChannel: DeliveryChannel;
  description: string;
}

export interface SmsDeliveryItem {
  id: string;
  recipientPhone: string;
  recipientName: string;
  announcementTitle: string;
  channel: "sms";
  segments: number;
  cost: number;
  status: "delivered" | "sent" | "failed" | "duplicate_prevented" | "simulated";
  sentAt: Date | string;
}

// ZOD SCHEMAS
export const announcementInputSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  content: z.string().trim().min(5, "Content must be at least 5 characters").max(2000),
  targetType: z.enum(["school", "grade", "class"]).default("school"),
  targetId: z.string().default("all"),
  priority: z.enum(["normal", "urgent", "emergency"]).default("normal"),
  channels: z.enum(["in_app", "sms", "both"]).default("in_app"),
  scheduledFor: z.string().optional(),
});

export type AnnouncementInput = z.infer<typeof announcementInputSchema>;

export const emergencyBroadcastInputSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(200),
  content: z.string().trim().min(10, "Emergency content must provide actionable detail").max(2000),
  targetType: z.enum(["school", "grade", "class"]).default("school"),
  targetId: z.string().default("all"),
  channels: z.enum(["in_app", "sms", "both"]).default("both"),
  firstApproverId: z.string().min(1, "First approver is required"),
  secondApproverId: z.string().min(1, "Second approver is required"),
  securityConfirmation: z.literal(true, {
    message: "You must confirm authorization under institutional safety protocol.",
  }),
});

export type EmergencyBroadcastInput = z.infer<typeof emergencyBroadcastInputSchema>;

export const guardianConsentInputSchema = z.object({
  guardianId: z.string().min(1),
  phone: z.string().trim().min(7, "Invalid phone number"),
  optInSmsAnnouncements: z.boolean(),
  optInSmsAttendance: z.boolean(),
  optInSmsEmergency: z.boolean(),
  optOutReason: z.string().trim().optional(),
});

export type GuardianConsentInput = z.infer<typeof guardianConsentInputSchema>;

// LOGIC & UTILITIES

/**
 * Checks whether an SMS dispatch is permitted according to guardian consent preferences.
 * Institutional emergency dispatches can override non-emergency opt-outs when isEmergencyOverride is enabled.
 */
export function canDispatchSms(
  consent: {
    optInSmsAnnouncements: boolean;
    optInSmsAttendance: boolean;
    optInSmsEmergency: boolean;
  } | null | undefined,
  category: CommunicationCategory,
  isEmergencyOverride = false
): { allowed: boolean; reason?: string } {
  // If emergency override is triggered for campus safety, permit dispatch
  if (isEmergencyOverride) {
    return { allowed: true, reason: "Campus safety emergency override active" };
  }

  // If no consent record found yet, default to permissible under institutional onboarding
  if (!consent) {
    return { allowed: true, reason: "Default institutional consent active" };
  }

  if (category === "emergency") {
    if (!consent.optInSmsEmergency) {
      return { allowed: false, reason: "Guardian opted out of emergency SMS alerts" };
    }
    return { allowed: true };
  }

  if (category === "attendance") {
    if (!consent.optInSmsAttendance) {
      return { allowed: false, reason: "Guardian opted out of attendance alerts" };
    }
    return { allowed: true };
  }

  if (category === "announcements") {
    if (!consent.optInSmsAnnouncements) {
      return { allowed: false, reason: "Guardian opted out of general announcement SMS" };
    }
    return { allowed: true };
  }

  return { allowed: true };
}

/**
 * Normalizes phone numbers by stripping non-digits and leading US country code 1 if present.
 */
export function normalizePhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Generates a deterministic idempotency key for dispatch deduplication.
 * Prevents identical messages from firing within a time window (e.g. 30 minutes).
 */
export function generateDispatchIdempotencyKey(
  announcementId: string,
  recipientPhone: string,
  timestampWindowMs = 1800000 // 30 minutes
): string {
  const cleanPhone = normalizePhoneNumber(recipientPhone);
  const timeBlock = Math.floor(Date.now() / timestampWindowMs);
  return `idemp_${announcementId}_${cleanPhone}_${timeBlock}`;
}

/**
 * Verifies if an SMS dispatch would be a duplicate within the given window.
 */
export function isDuplicateDispatch(
  recentDispatches: Array<{ phone: string; announcementId?: string; sentAt: Date | string }>,
  phone: string,
  announcementId: string,
  windowMinutes = 30
): boolean {
  const cleanPhone = normalizePhoneNumber(phone);
  const cutoff = Date.now() - windowMinutes * 60 * 1000;

  return recentDispatches.some((d) => {
    const itemPhone = normalizePhoneNumber(d.phone);
    const itemTime = new Date(d.sentAt).getTime();
    return (
      itemPhone === cleanPhone &&
      d.announcementId === announcementId &&
      itemTime >= cutoff
    );
  });
}

/**
 * Renders parameterized communication templates by substituting variable tokens {{variable}}.
 */
export function renderCommunicationTemplate(
  template: string,
  variables: Record<string, string | number>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(variables, key)) {
      return String(variables[key]);
    }
    return `{{${key}}}`;
  });
}

/**
 * Calculates GSM-7 segment count and estimated telecommunications transit cost.
 * Standard GSM SMS: 1 segment <= 160 chars; multi-segment is 153 chars/segment.
 */
export function calculateSmsSegments(
  content: string,
  costPerSegment = 0.015
): {
  characters: number;
  segments: number;
  estimatedCost: number;
} {
  const characters = content.length;
  if (characters === 0) {
    return { characters: 0, segments: 0, estimatedCost: 0 };
  }

  let segments = 1;
  if (characters > 160) {
    segments = Math.ceil(characters / 153);
  }

  const estimatedCost = Number((segments * costPerSegment).toFixed(4));
  return { characters, segments, estimatedCost };
}

/**
 * Calculates read receipt penetration metrics.
 */
export function calculateReadRate(
  totalTargeted: number,
  totalRead: number
): {
  readCount: number;
  targetCount: number;
  percentage: number;
} {
  const readCount = Math.max(0, totalRead);
  const targetCount = Math.max(0, totalTargeted);
  const percentage = targetCount > 0 ? Math.min(100, Math.round((readCount / targetCount) * 100)) : 0;
  return { readCount, targetCount, percentage };
}

/**
 * Enforces the Four-Eyes principle for institutional emergency broadcasts.
 * First and second approver must be distinct registered personnel.
 */
export function validateEmergencyApproval(
  firstApproverId: string | null | undefined,
  secondApproverId: string | null | undefined
): { valid: boolean; error?: string } {
  if (!firstApproverId || !firstApproverId.trim()) {
    return { valid: false, error: "Initiating approver (First Officer) is required." };
  }

  if (!secondApproverId || !secondApproverId.trim()) {
    return { valid: false, error: "Second confirming approver is required for two-party authorization." };
  }

  if (firstApproverId === secondApproverId) {
    return {
      valid: false,
      error: "Four-Eyes Principle Violated: The initiator cannot approve their own emergency broadcast.",
    };
  }

  return { valid: true };
}

// DEFAULT TEMPLATES
export const DEFAULT_COMMUNICATION_TEMPLATES: CommunicationTemplateItem[] = [
  {
    id: "tpl-01",
    title: "Unexcused Absence Alert",
    category: "Attendance",
    contentTemplate:
      "Klassa Alert: {{student_name}} was marked absent from {{class_name}} on {{date}}. If this is an error or excused absence, please reply or submit an excuse via the portal.",
    defaultPriority: "urgent",
    suggestedChannel: "sms",
    description: "Automated notice dispatched to registered guardians upon period absence.",
  },
  {
    id: "tpl-02",
    title: "Official Report Cards Published",
    category: "Academics",
    contentTemplate:
      "Academic Notice: Official {{term_name}} report cards for {{student_name}} have been certified and published. View grades and teacher remarks on your Klassa portal: {{portal_link}}.",
    defaultPriority: "normal",
    suggestedChannel: "both",
    description: "Dispatched upon principal sign-off of academic term grade dossiers.",
  },
  {
    id: "tpl-03",
    title: "Campus Inclement Weather Closure",
    category: "Emergency & Safety",
    contentTemplate:
      "EMERGENCY NOTICE: Northfield Academy campus is CLOSED on {{date}} due to {{reason}}. Distance learning schedules are active. All extracurricular events canceled.",
    defaultPriority: "emergency",
    suggestedChannel: "both",
    description: "Rapid broadcast for weather closures, power disruptions, or road hazards.",
  },
  {
    id: "tpl-04",
    title: "Parent-Teacher Conference Invitation",
    category: "Events",
    contentTemplate:
      "School Notice: Term conferences will take place on {{date}}. Please log into the Klassa Guardian Portal to select your advisory slot for {{student_name}}.",
    defaultPriority: "normal",
    suggestedChannel: "in_app",
    description: "Standard scheduling notice for guardian-faculty consultations.",
  },
  {
    id: "tpl-05",
    title: "Field Trip Consent Authorization",
    category: "Permissions",
    contentTemplate:
      "Action Required: A permission slip has been issued for {{student_name}}'s upcoming excursion to {{destination}} on {{date}}. Please review and sign electronically by {{deadline}}.",
    defaultPriority: "urgent",
    suggestedChannel: "both",
    description: "Dispatched to acquire guardian authorization for off-campus excursions.",
  },
];

// INITIAL SEED DATA FOR PREVIEW / DEMO
export const INITIAL_ANNOUNCEMENTS: AnnouncementRecord[] = [
  {
    id: "anc-01",
    organizationId: "org-northfield",
    title: "Term 1 Final Examination Schedule Released",
    content:
      "The comprehensive timetable for Term 1 midterm and final examinations has been posted. Morning examination sessions commence promptly at 08:30. Students are required to report in full uniform with required stationery.",
    targetType: "school",
    targetId: "all",
    targetLabel: "Entire Northfield Academy",
    priority: "normal",
    channels: "both",
    status: "published",
    requiresTwoParty: false,
    authorId: "usr-admin-1",
    authorName: "Sarah Jenkins (Registrar)",
    targetRecipientCount: 142,
    readCount: 128,
    publishedAt: "2026-03-10T08:00:00Z",
    createdAt: "2026-03-09T14:30:00Z",
    updatedAt: "2026-03-10T08:00:00Z",
  },
  {
    id: "anc-02",
    organizationId: "org-northfield",
    title: "Severe Weather Warning: Early Dismissal Protocol at 13:00",
    content:
      "EMERGENCY BROADCAST: National Weather Service has issued a flash winter blizzard warning. All classes will conclude at 13:00 today. School buses will depart early. Afternoon sports and aftercare are suspended.",
    targetType: "school",
    targetId: "all",
    targetLabel: "Entire Northfield Academy",
    priority: "emergency",
    channels: "both",
    status: "published",
    requiresTwoParty: true,
    firstApproverId: "usr-admin-1",
    firstApproverName: "Sarah Jenkins (Registrar)",
    secondApproverId: "usr-principal-1",
    secondApproverName: "Dr. Arthur Vance (Headmaster)",
    authorId: "usr-admin-1",
    authorName: "Sarah Jenkins (Registrar)",
    targetRecipientCount: 142,
    readCount: 139,
    publishedAt: "2026-02-18T10:15:00Z",
    createdAt: "2026-02-18T10:05:00Z",
    updatedAt: "2026-02-18T10:15:00Z",
  },
  {
    id: "anc-03",
    organizationId: "org-northfield",
    title: "Grade 10 STEM Laboratory Equipment Safety Review",
    content:
      "Grade 10 chemistry and physics students must complete their online safety protocol review prior to next Monday's experimental series. Protective eyewear must be inspected by homeroom teachers.",
    targetType: "grade",
    targetId: "grade-10",
    targetLabel: "Grade 10 Cohort",
    priority: "urgent",
    channels: "in_app",
    status: "published",
    requiresTwoParty: false,
    authorId: "usr-science-lead",
    authorName: "Marcus Brody (Science Dept Lead)",
    targetRecipientCount: 38,
    readCount: 31,
    publishedAt: "2026-03-14T09:00:00Z",
    createdAt: "2026-03-13T16:20:00Z",
    updatedAt: "2026-03-14T09:00:00Z",
  },
  {
    id: "anc-04",
    organizationId: "org-northfield",
    title: "Class 10-A Parent-Teacher Evening Logistics",
    content:
      "Reminding all guardians of Class 10-A students that individual consultations will run from 16:30 to 19:00 in Room 204. Refreshments provided by the PTA in the central courtyard.",
    targetType: "class",
    targetId: "class-10a",
    targetLabel: "Class 10-A",
    priority: "normal",
    channels: "in_app",
    status: "published",
    requiresTwoParty: false,
    authorId: "usr-admin-1",
    authorName: "Elena Rostova (Class Advisor)",
    targetRecipientCount: 22,
    readCount: 19,
    publishedAt: "2026-03-16T11:00:00Z",
    createdAt: "2026-03-16T10:30:00Z",
    updatedAt: "2026-03-16T11:00:00Z",
  },
  {
    id: "anc-05",
    organizationId: "org-northfield",
    title: "Spring Break Facility Maintenance & Gate Access Draft",
    content:
      "Notice regarding campus access restrictions during the upcoming spring maintenance window. Contractors will be servicing air filtration in the North Wing.",
    targetType: "school",
    targetId: "all",
    targetLabel: "Entire Northfield Academy",
    priority: "normal",
    channels: "in_app",
    status: "draft",
    requiresTwoParty: false,
    authorId: "usr-admin-1",
    authorName: "Sarah Jenkins (Registrar)",
    targetRecipientCount: 142,
    readCount: 0,
    createdAt: "2026-03-18T14:00:00Z",
    updatedAt: "2026-03-18T14:00:00Z",
  },
];

export const INITIAL_GUARDIAN_CONSENTS: GuardianConsentRecord[] = [
  {
    id: "cst-01",
    guardianId: "grd-001",
    guardianName: "David Warren",
    studentName: "Amelia Warren",
    phone: "+1 555-019-2831",
    optInSmsAnnouncements: true,
    optInSmsAttendance: true,
    optInSmsEmergency: true,
    updatedAt: "2026-01-10T09:00:00Z",
  },
  {
    id: "cst-02",
    guardianId: "grd-002",
    guardianName: "Helena Rostova",
    studentName: "Lucas Vance",
    phone: "+1 555-019-4829",
    optInSmsAnnouncements: false,
    optInSmsAttendance: true,
    optInSmsEmergency: true,
    optOutReason: "Prefers email/app notifications for general circulars to save mobile alerts",
    optOutAt: "2026-02-01T11:20:00Z",
    updatedAt: "2026-02-01T11:20:00Z",
  },
  {
    id: "cst-03",
    guardianId: "grd-003",
    guardianName: "Claire Zhang",
    studentName: "Chloe Zhang",
    phone: "+1 555-019-7712",
    optInSmsAnnouncements: true,
    optInSmsAttendance: true,
    optInSmsEmergency: true,
    updatedAt: "2026-01-12T14:00:00Z",
  },
  {
    id: "cst-04",
    guardianId: "grd-004",
    guardianName: "Tariq Mansour",
    studentName: "Zayd Mansour",
    phone: "+1 555-019-3304",
    optInSmsAnnouncements: false,
    optInSmsAttendance: false,
    optInSmsEmergency: true,
    optOutReason: "Guardian overseas roaming charges; emergency only",
    optOutAt: "2026-02-14T08:15:00Z",
    updatedAt: "2026-02-14T08:15:00Z",
  },
  {
    id: "cst-05",
    guardianId: "grd-005",
    guardianName: "Fiona Gallagher",
    studentName: "Liam Gallagher",
    phone: "+1 555-019-9941",
    optInSmsAnnouncements: true,
    optInSmsAttendance: true,
    optInSmsEmergency: true,
    updatedAt: "2026-01-15T16:45:00Z",
  },
];

export const INITIAL_SMS_DELIVERY_LOGS: SmsDeliveryItem[] = [
  {
    id: "sms-log-01",
    recipientPhone: "+1 555-019-2831",
    recipientName: "David Warren",
    announcementTitle: "Severe Weather Warning: Early Dismissal Protocol at 13:00",
    channel: "sms",
    segments: 2,
    cost: 0.03,
    status: "delivered",
    sentAt: "2026-02-18T10:15:12Z",
  },
  {
    id: "sms-log-02",
    recipientPhone: "+1 555-019-4829",
    recipientName: "Helena Rostova",
    announcementTitle: "Severe Weather Warning: Early Dismissal Protocol at 13:00",
    channel: "sms",
    segments: 2,
    cost: 0.03,
    status: "delivered",
    sentAt: "2026-02-18T10:15:13Z",
  },
  {
    id: "sms-log-03",
    recipientPhone: "+1 555-019-7712",
    recipientName: "Claire Zhang",
    announcementTitle: "Severe Weather Warning: Early Dismissal Protocol at 13:00",
    channel: "sms",
    segments: 2,
    cost: 0.03,
    status: "delivered",
    sentAt: "2026-02-18T10:15:15Z",
  },
  {
    id: "sms-log-04",
    recipientPhone: "+1 555-019-3304",
    recipientName: "Tariq Mansour",
    announcementTitle: "Severe Weather Warning: Early Dismissal Protocol at 13:00",
    channel: "sms",
    segments: 2,
    cost: 0.03,
    status: "delivered",
    sentAt: "2026-02-18T10:15:16Z",
  },
  {
    id: "sms-log-05",
    recipientPhone: "+1 555-019-2831",
    recipientName: "David Warren",
    announcementTitle: "Term 1 Final Examination Schedule Released",
    channel: "sms",
    segments: 1,
    cost: 0.015,
    status: "delivered",
    sentAt: "2026-03-10T08:00:22Z",
  },
];
