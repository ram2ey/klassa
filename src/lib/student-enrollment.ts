import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { academicYears, classes, enrollments, guardians, organizations, sensitiveCases, studentGuardians, students } from "@/db/schema";
import { AuditActions, logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";
import { SchoolAdminError } from "@/lib/school-admin-policy";
import { allocateStudentNumbers } from "@/lib/student-number";

const relationship = z.enum(["parent", "guardian", "foster_carer", "other"]);
const concern = z.enum(["safeguarding", "health_medical", "special_needs", "disciplinary"]);
const guardianDetails = z.object({
  relationship,
  isPrimary: z.boolean(),
  hasLegalResponsibility: z.boolean(),
});

export const enrollmentInputSchema = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  dateOfBirth: z.iso.date(),
  classId: z.uuid(),
  status: z.enum(["pending", "active"]).default("pending"),
  guardians: z.array(z.discriminatedUnion("kind", [
    guardianDetails.extend({ kind: z.literal("existing"), guardianId: z.uuid() }),
    guardianDetails.extend({ kind: z.literal("new"), firstName: z.string().trim().min(1).max(100),
      lastName: z.string().trim().min(1).max(100), email: z.union([z.email().max(254), z.literal("")]),
      phone: z.string().trim().max(40) }),
  ])).max(6),
  concerns: z.array(concern).max(4),
}).superRefine((value, context) => {
  if (value.dateOfBirth > new Date().toISOString().slice(0, 10)) context.addIssue({ code: "custom", path: ["dateOfBirth"], message: "Date of birth cannot be in the future." });
  if (value.guardians.filter(item => item.isPrimary).length > 1) context.addIssue({ code: "custom", path: ["guardians"], message: "Choose only one primary contact." });
  const existingIds = value.guardians.filter(item => item.kind === "existing").map(item => item.guardianId);
  if (new Set(existingIds).size !== existingIds.length) context.addIssue({ code: "custom", path: ["guardians"], message: "Each existing guardian can be added once." });
  if (new Set(value.concerns).size !== value.concerns.length) context.addIssue({ code: "custom", path: ["concerns"], message: "Choose each concern once." });
});

export type EnrollmentInput = z.input<typeof enrollmentInputSchema>;

const concernTitles = {
  safeguarding: "Enrollment safeguarding referral",
  health_medical: "Enrollment health referral",
  special_needs: "Enrollment learning support referral",
  disciplinary: "Enrollment behaviour referral",
} as const;
const concernCodes = { safeguarding: "SG", health_medical: "HM", special_needs: "SN", disciplinary: "DI" } as const;

export async function enrollSchoolStudent(actor: Awaited<ReturnType<typeof requireStaff>>, raw: EnrollmentInput) {
  if (actor.role !== "school_admin" && actor.role !== "office_staff") throw new SchoolAdminError("School office access required.");
  const value = enrollmentInputSchema.parse(raw);
  const org = actor.organizationId;
  return db.transaction(async tx => {
    const [school] = await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, org)).for("update");
    if (!school) throw new SchoolAdminError("School not found.");
    const [year] = await tx.select({ id: academicYears.id }).from(academicYears)
      .where(and(eq(academicYears.organizationId, org), eq(academicYears.isCurrent, true)));
    if (!year) throw new SchoolAdminError("Set a current academic year first.");
    const [schoolClass] = await tx.select({ id: classes.id }).from(classes)
      .where(and(eq(classes.id, value.classId), eq(classes.organizationId, org), eq(classes.academicYearId, year.id)));
    if (!schoolClass) throw new SchoolAdminError("Choose a class in the current academic year.");
    const existingIds = value.guardians.filter(item => item.kind === "existing").map(item => item.guardianId);
    if (existingIds.length) {
      const found = await tx.select({ id: guardians.id }).from(guardians)
        .where(and(eq(guardians.organizationId, org), inArray(guardians.id, existingIds)));
      if (found.length !== existingIds.length) throw new SchoolAdminError("A selected guardian was not found in your school.");
    }
    const [studentNumber] = await allocateStudentNumbers(tx, org, 1);
    const [student] = await tx.insert(students).values({ organizationId: org, studentNumber,
      firstName: value.firstName, lastName: value.lastName, dateOfBirth: value.dateOfBirth, status: value.status }).returning({ id: students.id });
    await tx.insert(enrollments).values({ organizationId: org, studentId: student.id, academicYearId: year.id,
      classId: schoolClass.id, status: value.status, startsOn: new Date().toISOString().slice(0, 10) });
    for (const item of value.guardians) {
      let guardianId: string;
      if (item.kind === "new") {
        const [created] = await tx.insert(guardians).values({ organizationId: org, firstName: item.firstName,
          lastName: item.lastName, email: item.email || null, phone: item.phone || null }).returning({ id: guardians.id });
        guardianId = created.id;
        await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.GUARDIAN_CREATED,
          entityType: "guardian", entityId: guardianId, metadata: { source: "enrollment" } }, tx);
      } else guardianId = item.guardianId;
      await tx.insert(studentGuardians).values({ organizationId: org, studentId: student.id, guardianId,
        relationship: item.relationship, isPrimary: item.isPrimary, hasLegalResponsibility: item.hasLegalResponsibility });
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.GUARDIAN_LINKED,
        entityType: "student_guardian", entityId: student.id, metadata: { guardianId, source: "enrollment" } }, tx);
    }
    for (const area of value.concerns) {
      const [caseRow] = await tx.insert(sensitiveCases).values({ organizationId: org, studentId: student.id,
        caseNumber: `IN-${studentNumber}-${concernCodes[area]}`, area, title: concernTitles[area],
        confidentialityTier: "confidential" }).returning({ id: sensitiveCases.id });
      await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.SENSITIVE_CASE_CREATED,
        entityType: "sensitive_case", entityId: caseRow.id, metadata: { source: "enrollment", area } }, tx);
    }
    await logAuditEvent({ organizationId: org, actorUserId: actor.userId, action: AuditActions.STUDENT_CREATED,
      entityType: "student", entityId: student.id, metadata: { studentNumber, guardianCount: value.guardians.length,
        referralCount: value.concerns.length, source: "enrollment" } }, tx);
    return { studentId: student.id, studentNumber, guardianCount: value.guardians.length, referralCount: value.concerns.length };
  });
}
