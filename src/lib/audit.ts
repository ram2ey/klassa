import { isDemoMode } from "@/lib/runtime-config";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";

export const AuditActions = {
  STUDENT_CREATED: "student.created",
  STUDENT_UPDATED: "student.updated",
  STUDENT_STATUS_CHANGED: "student.status_changed",
  GUARDIAN_CREATED: "guardian.created",
  GUARDIAN_LINKED: "guardian.linked",
  CSV_IMPORT_EXECUTED: "import.executed",
  STAFF_INVITED: "staff.invited",
  ACADEMIC_YEAR_CREATED: "academic_year.created",
  CLASS_CREATED: "class.created",
  SUBJECT_CREATED: "subject.created",
  ASSESSMENT_CREATED: "assessment.created",
  ASSESSMENT_PUBLISHED: "assessment.published",
  GRADE_RECORDED: "grade.recorded",
  GRADE_CORRECTED: "grade.corrected",
  REPORT_CARD_GENERATED: "report_card.generated",
  REPORT_CARD_PUBLISHED: "report_card.published",
  ANNOUNCEMENT_CREATED: "announcement.created",
  ANNOUNCEMENT_PUBLISHED: "announcement.published",
  EMERGENCY_BROADCAST_INITIATED: "emergency_broadcast.initiated",
  EMERGENCY_BROADCAST_CONFIRMED: "emergency_broadcast.confirmed",
  GUARDIAN_CONSENT_UPDATED: "guardian_consent.updated",
  SENSITIVE_CASE_CREATED: "sensitive_case.created",
  SENSITIVE_CASE_UPDATED: "sensitive_case.updated",
  SENSITIVE_NOTE_ADDED: "sensitive_note.added",
  SENSITIVE_RECORD_DECRYPTED: "sensitive_record.decrypted",
  NEED_TO_KNOW_ALERT_CREATED: "need_to_know.created",
  NEED_TO_KNOW_ALERT_RESOLVED: "need_to_know.resolved",
  COURT_RESTRICTION_LOGGED: "court_restriction.logged",
  DISCLOSURE_PACKAGE_EXPORTED: "disclosure_package.exported",
  GDPR_PORTABILITY_EXPORTED: "gdpr.portability_exported",
  GDPR_STUDENT_ANONYMIZED: "gdpr.student_anonymized",
  GDPR_RECTIFICATION_APPLIED: "gdpr.rectification_applied",
  GDPR_PROCESSING_RESTRICTED: "gdpr.processing_restricted",
  RESTORE_DRILL_EXECUTED: "restore_drill.executed",
  ORGANIZATION_PROVISIONED: "organization.provisioned",
  RATE_LIMIT_EXCEEDED: "rate_limit.exceeded",
} as const;

export type AuditAction = (typeof AuditActions)[keyof typeof AuditActions] | string;

export interface LogAuditParams {
  organizationId: string;
  actorUserId?: string | null;
  action: AuditAction;
  entityType: string;
  entityId: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditRecord {
  id: string;
  organizationId: string;
  actorUserId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  requestId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

// In-memory fallback log for preview/evaluation when running without active Postgres
const fallbackAuditLogs: AuditRecord[] = [
  {
    id: "aud-001",
    organizationId: "org-northfield",
    actorUserId: "usr-admin-1",
    action: AuditActions.STUDENT_UPDATED,
    entityType: "student",
    entityId: "ST-2026-0142",
    requestId: "req-init-1",
    metadata: { targetName: "Amelia Warren", changes: { phone: "updated" } },
    createdAt: new Date(Date.now() - 12 * 60 * 1000),
  },
  {
    id: "aud-002",
    organizationId: "org-northfield",
    actorUserId: "usr-staff-1",
    action: AuditActions.STUDENT_CREATED,
    entityType: "student",
    entityId: "ST-2026-0126",
    requestId: "req-init-2",
    metadata: { targetName: "Elias Martin", grade: "Grade 5" },
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
  },
  {
    id: "aud-003",
    organizationId: "org-northfield",
    actorUserId: "usr-admin-1",
    action: AuditActions.CSV_IMPORT_EXECUTED,
    entityType: "import_job",
    entityId: "job-2026-09-18",
    requestId: "req-init-3",
    metadata: { rowCount: 36, status: "completed" },
    createdAt: new Date(Date.now() - 72 * 60 * 60 * 1000),
  },
];

export async function logAuditEvent(params: LogAuditParams, database: Pick<typeof db, "insert"> = db): Promise<AuditRecord> {
  if (isDemoMode()) {
    const record: AuditRecord = { ...params, id: crypto.randomUUID(), actorUserId: params.actorUserId ?? null,
      requestId: params.requestId ?? null, metadata: params.metadata ?? {}, createdAt: new Date() };
    fallbackAuditLogs.unshift(record);
    return record;
  }
  // A rejected insert must reject the enclosing operation; never fall back to memory.
  const [inserted] = await database.insert(auditEvents).values({
    organizationId: params.organizationId, actorUserId: params.actorUserId ?? null,
    action: params.action, entityType: params.entityType, entityId: params.entityId,
    requestId: params.requestId, metadata: params.metadata ?? {},
  }).returning();
  if (!inserted) throw new Error("Audit write failed.");
  return { ...inserted, metadata: (inserted.metadata as Record<string, unknown>) ?? {} };
}

export function getAuditTrail(): AuditRecord[] {
  if (!isDemoMode()) throw new Error("Live audit reads require an authenticated tenant-scoped query.");
  return [...fallbackAuditLogs];
}
