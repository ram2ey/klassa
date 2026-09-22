import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { academicYears, classes, enrollments, gradeLevels, students } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { AuditActions, logAuditEvent } from "@/lib/audit";
import { studentInputSchema, type StudentInput } from "@/lib/validation/student";

const rosterRoles = ["school_admin", "office_staff"] as const;

export async function listLiveStudents() {
  const actor = await requireStaff([...rosterRoles]);
  return db.select({
    id: students.id, studentNumber: students.studentNumber,
    firstName: students.firstName, lastName: students.lastName,
    dateOfBirth: students.dateOfBirth, status: students.status,
  }).from(students).where(eq(students.organizationId, actor.organizationId))
    .orderBy(students.lastName, students.firstName);
}

export async function createLiveStudent(input: StudentInput) {
  const actor = await requireStaff([...rosterRoles]);
  const value = studentInputSchema.parse(input);
  return db.transaction(async (tx) => {
    // Resolve enrollment within this school; never accept arbitrary foreign IDs.
    const matches = await tx.select({ classId: classes.id, yearId: academicYears.id })
      .from(classes)
      .innerJoin(gradeLevels, and(eq(classes.gradeLevelId, gradeLevels.id), eq(gradeLevels.organizationId, actor.organizationId)))
      .innerJoin(academicYears, and(eq(classes.academicYearId, academicYears.id), eq(academicYears.organizationId, actor.organizationId)))
      .where(and(eq(classes.organizationId, actor.organizationId), eq(classes.name, value.className),
        eq(gradeLevels.name, value.gradeLevel), eq(academicYears.isCurrent, true)));
    if (matches.length !== 1) throw new Error("Select an existing class and grade in the school's current academic year.");
    const [student] = await tx.insert(students).values({
      organizationId: actor.organizationId, studentNumber: value.studentNumber,
      firstName: value.firstName, middleName: value.middleName, lastName: value.lastName,
      preferredName: value.preferredName, dateOfBirth: value.dateOfBirth, status: "pending",
    }).returning();
    await tx.insert(enrollments).values({
      organizationId: actor.organizationId, studentId: student.id,
      academicYearId: matches[0].yearId, classId: matches[0].classId,
      startsOn: new Date().toISOString().slice(0, 10), status: "pending",
    });
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: AuditActions.STUDENT_CREATED, entityType: "student", entityId: student.id }, tx);
    return { success: true as const, student: {
      id: student.studentNumber, firstName: student.firstName, lastName: student.lastName,
      initials: `${student.firstName[0]}${student.lastName[0]}`.toUpperCase(),
      grade: value.gradeLevel, className: value.className, guardians: 0,
      status: "Pending" as const, updated: "Just now", dateOfBirth: student.dateOfBirth,
    } };
  });
}

export async function updateLiveStudentStatus(studentNumber: string, status: "Active" | "Pending") {
  const actor = await requireStaff([...rosterRoles]);
  const number = z.string().trim().min(1).max(50).parse(studentNumber);
  const nextStatus = z.enum(["Active", "Pending"]).parse(status) === "Active" ? "active" : "pending";
  return db.transaction(async (tx) => {
    const [student] = await tx.update(students).set({ status: nextStatus, updatedAt: new Date() })
      .where(and(eq(students.organizationId, actor.organizationId), eq(students.studentNumber, number)))
      .returning({ id: students.id });
    if (!student) throw new Error("Student not found.");
    await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId,
      action: AuditActions.STUDENT_STATUS_CHANGED, entityType: "student", entityId: student.id,
      metadata: { newStatus: nextStatus } }, tx);
    return { success: true as const };
  });
}
