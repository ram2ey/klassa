import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { courtRestrictions, emergencyBroadcasts, guardians, smsDispatches, studentGuardians } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";
import { normalizePhoneNumber } from "@/lib/sms";

type Actor = Awaited<ReturnType<typeof requireStaff>>;

export async function getPendingEmergencyBroadcasts(actor: Actor) {
  if (actor.role !== "school_admin" && actor.role !== "office_staff") throw new Error("Staff approval required.");
  return db.select().from(emergencyBroadcasts).where(and(eq(emergencyBroadcasts.organizationId, actor.organizationId),
    eq(emergencyBroadcasts.status, "pending")));
}

export async function approveEmergencyBroadcast(actor: Actor, rawId: string) {
  if (actor.role !== "school_admin" && actor.role !== "office_staff") throw new Error("Staff approval required.");
  const id = z.uuid().parse(rawId);
  return db.transaction(async tx => {
    const [broadcast] = await tx.select().from(emergencyBroadcasts).where(and(eq(emergencyBroadcasts.id, id),
      eq(emergencyBroadcasts.organizationId, actor.organizationId))).for("update");
    if (!broadcast || broadcast.status !== "pending") throw new Error("Broadcast has already been reviewed.");
    if (broadcast.requestedBy === actor.userId) throw new Error("A different staff member must approve this broadcast.");
    const studentIds = broadcast.studentIds;
    if (!studentIds.length) throw new Error("Broadcast has no student recipients.");
    const links = await tx.select({ studentId: studentGuardians.studentId, guardianId: guardians.id,
      name: guardians.firstName, surname: guardians.lastName, phone: guardians.phone,
      verifiedAt: guardians.phoneVerifiedAt }).from(studentGuardians)
      .innerJoin(guardians, and(eq(guardians.id, studentGuardians.guardianId), eq(guardians.organizationId, actor.organizationId)))
      .where(and(eq(studentGuardians.organizationId, actor.organizationId),
        inArray(studentGuardians.studentId, studentIds), eq(studentGuardians.hasLegalResponsibility, true)));
    const orders = await tx.select().from(courtRestrictions).where(and(eq(courtRestrictions.organizationId, actor.organizationId),
      inArray(courtRestrictions.studentId, studentIds), eq(courtRestrictions.isEnforced, true),
      or(eq(courtRestrictions.prohibitDirectContact, true), eq(courtRestrictions.prohibitDisclosure, true))));
    const today = new Date().toISOString().slice(0, 10);
    const eligible = new Map<string, typeof links[number]>();
    for (const link of links) {
      if (!link.verifiedAt || !link.phone) continue;
      const phone = normalizePhoneNumber(link.phone);
      if (!/^\+233\d{9}$/.test(phone)) continue;
      if (orders.some(order => order.studentId === link.studentId && (!order.restrictedGuardianId || order.restrictedGuardianId === link.guardianId) &&
        order.effectiveDate <= today && (!order.expirationDate || order.expirationDate >= today))) continue;
      eligible.set(link.guardianId, link);
    }
    if (!eligible.size) throw new Error("No verified, eligible guardian numbers remain. Review the recipient list.");
    const now = new Date();
    for (const link of eligible.values()) {
      await tx.insert(smsDispatches).values({ organizationId: actor.organizationId,
        guardianId: link.guardianId, studentId: link.studentId, recipientPhone: normalizePhoneNumber(link.phone!),
        recipientName: `${link.name} ${link.surname}`, message: broadcast.message,
        purpose: "emergency", idempotencyKey: `broadcast:${broadcast.id}:guardian:${link.guardianId}`,
        status: "queued", sentAt: now }).onConflictDoNothing({ target: smsDispatches.idempotencyKey });
    }
    await tx.update(emergencyBroadcasts).set({ status: "approved", approvedBy: actor.userId, approvedAt: now,
      recipientCount: eligible.size, updatedAt: now }).where(eq(emergencyBroadcasts.id, id));
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: "emergency_broadcast.approved", entityType: "sms_broadcast", entityId: id,
      metadata: { requesterId: broadcast.requestedBy, queuedCount: eligible.size, reason: broadcast.reason } }, tx);
    return { queuedCount: eligible.size };
  });
}
