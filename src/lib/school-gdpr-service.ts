import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { gdprRequests, students } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
export class SchoolGdprError extends Error {}
export const gdprRequestInput = z.object({ studentId: z.uuid(),
  requestType: z.enum(["export", "rectify", "anonymize", "restrict"]),
  requesterName: z.string().trim().min(2).max(180),
  requesterRole: z.enum(["guardian", "student", "representative", "other"]),
  requesterEmail: z.email().max(255), justification: z.string().trim().min(10).max(2000) });
export type GdprRequestInput = z.input<typeof gdprRequestInput>;
export const gdprDecisionInput = z.object({ requestId: z.uuid(),
  status: z.enum(["completed", "rejected"]), note: z.string().trim().min(10).max(2000) });
export type GdprDecisionInput = z.input<typeof gdprDecisionInput>;

function requireAdmin(actor: Actor) {
  if (actor.role !== "school_admin") throw new SchoolGdprError("School administrator access required.");
}

export async function createSchoolGdprRequest(actor: Actor, raw: GdprRequestInput) {
  requireAdmin(actor);
  const input = gdprRequestInput.parse(raw);
  return db.transaction(async tx => {
    const [student] = await tx.select({ id: students.id }).from(students).where(and(
      eq(students.id, input.studentId), eq(students.organizationId, actor.organizationId)));
    if (!student) throw new SchoolGdprError("Student was not found in your school.");
    const [created] = await tx.insert(gdprRequests).values({ organizationId: actor.organizationId,
      studentId: student.id, requestType: input.requestType, requesterName: input.requesterName,
      requesterRole: input.requesterRole, requesterEmail: input.requesterEmail,
      justification: input.justification, safeguardingRedacted: input.requestType === "export" })
      .returning({ id: gdprRequests.id });
    if (!created) throw new SchoolGdprError("The request could not be recorded.");
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: "privacy.request_recorded", entityType: "gdpr_request", entityId: created.id,
      metadata: { studentId: student.id, requestType: input.requestType } }, tx);
    return { requestId: created.id };
  });
}

export async function decideSchoolGdprRequest(actor: Actor, raw: GdprDecisionInput) {
  requireAdmin(actor);
  const input = gdprDecisionInput.parse(raw);
  return db.transaction(async tx => {
    const [request] = await tx.select().from(gdprRequests).where(and(
      eq(gdprRequests.id, input.requestId), eq(gdprRequests.organizationId, actor.organizationId))).for("update");
    if (!request) throw new SchoolGdprError("Request was not found in your school.");
    if (request.status === "completed" || request.status === "rejected") {
      throw new SchoolGdprError("This request has already been closed.");
    }
    if (input.status === "completed" && request.requestType === "anonymize") {
      throw new SchoolGdprError("An erasure request cannot be marked complete without an approved retention and dependency review.");
    }
    const now = new Date();
    await tx.update(gdprRequests).set({ status: input.status, processedAt: now,
      processedBy: actor.userId, actionEvidence: { decisionNote: input.note, recordedBy: actor.userId,
        recordedAt: now.toISOString(), actionPerformedInApp: false }, updatedAt: now })
      .where(and(eq(gdprRequests.id, request.id), eq(gdprRequests.organizationId, actor.organizationId)));
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: "privacy.decision_recorded", entityType: "gdpr_request", entityId: request.id,
      metadata: { studentId: request.studentId, requestType: request.requestType,
        status: input.status, note: input.note, actionPerformedInApp: false } }, tx);
    return { requestId: request.id, status: input.status };
  });
}
