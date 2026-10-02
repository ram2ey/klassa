import { createHash } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { academicYears, auditEvents, classes, enrollments, gradeLevels, organizations, students, terms } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";

type Actor = Awaited<ReturnType<typeof requireStaff>>;
const id = z.uuid();
const rolloverInput = z.object({ sourceYearId: id, targetYearId: id,
  placements: z.array(z.discriminatedUnion("outcome", [
    z.object({ studentId: id, outcome: z.literal("move"), classId: id }),
    z.object({ studentId: id, outcome: z.literal("graduate") }),
    z.object({ studentId: id, outcome: z.literal("withdraw") }),
  ])).max(5000) });
export type RolloverInput = z.input<typeof rolloverInput>;
export class RolloverError extends Error {}

function admin(actor: Actor) {
  if (actor.role !== "school_admin") throw new RolloverError("School administrator access required.");
}

export async function getSchoolRolloverPreview(actor: Actor, targetYearId: string) {
  admin(actor);
  const targetId = id.parse(targetYearId);
  const org = actor.organizationId;
  const [source] = await db.select().from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true)));
  const [target] = await db.select().from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.id, targetId)));
  if (!source || !target || source.id === target.id || target.startsOn <= source.endsOn) throw new RolloverError("Choose a later academic year.");
  const [grades, targetClasses, sourceClasses, currentEnrollments, studentRows, sourceTerms] = await Promise.all([
    db.select().from(gradeLevels).where(eq(gradeLevels.organizationId, org)).orderBy(gradeLevels.position),
    db.select().from(classes).where(and(eq(classes.organizationId, org), eq(classes.academicYearId, target.id))),
    db.select().from(classes).where(and(eq(classes.organizationId, org), eq(classes.academicYearId, source.id))),
    db.select().from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.academicYearId, source.id), eq(enrollments.status, "active"))),
    db.select({ id: students.id, firstName: students.firstName, lastName: students.lastName,
      studentNumber: students.studentNumber }).from(students).where(eq(students.organizationId, org)),
    db.select({ id: terms.id, isLocked: terms.isLocked }).from(terms).where(and(eq(terms.organizationId, org), eq(terms.academicYearId, source.id))),
  ]);
  const proposals = currentEnrollments.map(enrollment => {
    const student = studentRows.find(item => item.id === enrollment.studentId);
    const sourceClass = sourceClasses.find(item => item.id === enrollment.classId);
    const gradeIndex = grades.findIndex(item => item.id === sourceClass?.gradeLevelId);
    const nextGrade = gradeIndex < 0 ? undefined : grades[gradeIndex + 1];
    const suggestedClass = targetClasses.find(item => item.gradeLevelId === nextGrade?.id);
    return { studentId: enrollment.studentId, studentName: student ? `${student.firstName} ${student.lastName}` : "Student",
      studentNumber: student?.studentNumber ?? "", sourceClassName: sourceClass?.name ?? "Unassigned",
      suggestedClassId: suggestedClass?.id ?? null, terminalGrade: gradeIndex === grades.length - 1 };
  });
  return { source: { id: source.id, name: source.name }, target: { id: target.id, name: target.name },
    allTermsLocked: sourceTerms.length > 0 && sourceTerms.every(term => term.isLocked),
    targetClasses: targetClasses.map(item => ({ id: item.id, name: item.name,
      gradeName: grades.find(grade => grade.id === item.gradeLevelId)?.name ?? "Grade" })), proposals };
}

export async function approveSchoolRollover(actor: Actor, raw: RolloverInput) {
  admin(actor);
  const input = rolloverInput.parse(raw);
  const fingerprint = createHash("sha256").update(JSON.stringify({ sourceYearId: input.sourceYearId,
    targetYearId: input.targetYearId, placements: [...input.placements].sort((a, b) => a.studentId.localeCompare(b.studentId)) })).digest("hex");
  const org = actor.organizationId;
  return db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update");
    if (!school) throw new RolloverError("School not found.");
    const [source] = await tx.select().from(academicYears).where(and(eq(academicYears.id, input.sourceYearId), eq(academicYears.organizationId, org)));
    const [target] = await tx.select().from(academicYears).where(and(eq(academicYears.id, input.targetYearId), eq(academicYears.organizationId, org)));
    if (!source || !target || source.id === target.id || target.startsOn <= source.endsOn) throw new RolloverError("Choose a later academic year.");
    const current = await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true)));
    const sourceEnrollments = await tx.select().from(enrollments).where(and(eq(enrollments.organizationId, org),
      eq(enrollments.academicYearId, source.id), eq(enrollments.status, "active")));
    const requested = new Map(input.placements.map(item => [item.studentId, item]));
    if (requested.size !== input.placements.length || requested.size !== sourceEnrollments.length ||
      sourceEnrollments.some(item => !requested.has(item.studentId))) throw new RolloverError("Review every active student exactly once before approving rollover.");
    const existing = await tx.select().from(enrollments).where(and(eq(enrollments.organizationId, org), eq(enrollments.academicYearId, target.id)));
    if (current.length === 1 && current[0].id === target.id) {
      const [receipt] = await tx.select({ metadata: auditEvents.metadata }).from(auditEvents).where(and(
        eq(auditEvents.organizationId, org), eq(auditEvents.action, "academic_year.rollover_approved"),
        eq(auditEvents.entityId, target.id))).orderBy(desc(auditEvents.createdAt)).limit(1);
      const receiptFingerprint = receipt?.metadata && typeof receipt.metadata === "object" && "fingerprint" in receipt.metadata
        ? receipt.metadata.fingerprint : null;
      if (receiptFingerprint === fingerprint && existing.length === input.placements.filter(item => item.outcome === "move").length &&
        input.placements.every(item => item.outcome !== "move" || existing.some(row => row.studentId === item.studentId && row.classId === item.classId))) {
        return { moved: existing.length, alreadyApplied: true };
      }
      throw new RolloverError("The target year is already current with different placements.");
    }
    if (current.length !== 1 || current[0].id !== source.id) throw new RolloverError("The source year is no longer current. Refresh the preview.");
    if (existing.length) throw new RolloverError("The target year already has enrollments. Resolve those placements before rollover.");
    const sourceTerms = await tx.select({ isLocked: terms.isLocked }).from(terms).where(and(eq(terms.organizationId, org), eq(terms.academicYearId, source.id)));
    if (!sourceTerms.length || sourceTerms.some(term => !term.isLocked)) throw new RolloverError("Close every source-year term before rollover.");
    const targetClasses = await tx.select({ id: classes.id }).from(classes).where(and(eq(classes.organizationId, org), eq(classes.academicYearId, target.id)));
    const targetClassIds = new Set(targetClasses.map(item => item.id));
    if (input.placements.some(item => item.outcome === "move" && !targetClassIds.has(item.classId))) {
      throw new RolloverError("Every moving student needs a class in the target year.");
    }
    const moving = input.placements.filter((item): item is Extract<typeof item, { outcome: "move" }> => item.outcome === "move");
    if (moving.length) await tx.insert(enrollments).values(moving.map(item => ({ organizationId: org,
      studentId: item.studentId, academicYearId: target.id, classId: item.classId, status: "active" as const, startsOn: target.startsOn })));
    await tx.update(enrollments).set({ endsOn: source.endsOn, updatedAt: new Date() })
      .where(and(eq(enrollments.organizationId, org), eq(enrollments.academicYearId, source.id),
        inArray(enrollments.studentId, input.placements.map(item => item.studentId))));
    const leaving = input.placements.filter(item => item.outcome !== "move");
    for (const item of leaving) await tx.update(students).set({ status: item.outcome === "graduate" ? "graduated" : "withdrawn",
      updatedAt: new Date() }).where(and(eq(students.id, item.studentId), eq(students.organizationId, org)));
    await tx.update(academicYears).set({ isCurrent: false, updatedAt: new Date() }).where(and(eq(academicYears.id, source.id), eq(academicYears.organizationId, org)));
    await tx.update(academicYears).set({ isCurrent: true, updatedAt: new Date() }).where(and(eq(academicYears.id, target.id), eq(academicYears.organizationId, org)));
    await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: "academic_year.rollover_approved",
      entityType: "academic_year", entityId: target.id,
      metadata: { sourceYearId: source.id, fingerprint, moved: moving.length, graduated: leaving.filter(item => item.outcome === "graduate").length,
        withdrawn: leaving.filter(item => item.outcome === "withdraw").length } }, tx);
    return { moved: moving.length, alreadyApplied: false };
  });
}
