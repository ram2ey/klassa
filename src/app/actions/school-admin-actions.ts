"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireStaff } from "@/lib/action-access";
import { db } from "@/db";
import { and, count, eq } from "drizzle-orm";
import { classes, organizationMemberships, organizations, sessions, teacherClassAssignments, users } from "@/db/schema";
import { logAuditEvent } from "@/lib/audit";
import { bulkUpdateSchoolStudents, saveSchoolRecord } from "@/lib/school-admin-service";
import { SchoolAdminError, type BulkStudentUpdate, type SchoolCommand } from "@/lib/school-admin-policy";
import { importSchoolStudents } from "@/lib/school-student-import";

export async function saveSchoolRecordAction(input: SchoolCommand) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await saveSchoolRecord(actor, input);
    revalidatePath("/");
    revalidatePath("/platform");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check your form entries." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    const cause = error instanceof Error ? error.cause : undefined;
    if ((cause && typeof cause === "object" && "code" in cause && cause.code === "23505") ||
      (typeof error === "object" && error && "code" in error && error.code === "23505")) {
      return { success: false as const, error: "This subject code or record already exists in your school." };
    }
    return { success: false as const, error: "The change could not be saved. Check your connection and try again." };
  }
}

export async function bulkUpdateSchoolStudentsAction(input: BulkStudentUpdate) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await bulkUpdateSchoolStudents(actor, input);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof z.ZodError) return { success: false as const, error: error.issues[0]?.message ?? "Check your selections." };
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    return { success: false as const, error: "The bulk update could not be saved. Refresh the directory and try again." };
  }
}

export async function importStudentsAction(csvText: string) {
  const actor = await requireStaff(["school_admin"]);
  try {
    const result = await importSchoolStudents(actor, csvText);
    revalidatePath("/");
    return { success: true as const, ...result };
  } catch (error) {
    if (error instanceof SchoolAdminError) return { success: false as const, error: error.message };
    return { success: false as const, error: "Import failed. Check the file and try again." };
  }
}

export async function removeSchoolStaffAccessAction(membershipId: string) {
  const actor = await requireStaff(["school_admin"]);
  const parsed = z.uuid().safeParse(membershipId);
  if (!parsed.success) return { success: false as const, error: "Choose a valid staff account." };
  try {
    await db.transaction(async tx => {
      const [school] = await tx.select({ id: organizations.id }).from(organizations)
        .where(eq(organizations.id, actor.organizationId)).for("update");
      if (!school) throw new Error("School not found.");
      const [member] = await tx.select().from(organizationMemberships)
        .where(and(eq(organizationMemberships.id, parsed.data), eq(organizationMemberships.organizationId, actor.organizationId))).limit(1);
      if (!member) throw new Error("Staff member not found.");
      if (member.userId === actor.userId) throw new Error("Ask another school administrator to remove your access.");
      if (member.role === "school_admin") {
        const [admins] = await tx.select({ total: count() }).from(organizationMemberships)
          .where(and(eq(organizationMemberships.organizationId, actor.organizationId), eq(organizationMemberships.role, "school_admin")));
        if ((admins?.total ?? 0) <= 1) throw new Error("This is the last school administrator. Add another administrator before removing access.");
      }
      await tx.delete(organizationMemberships).where(and(eq(organizationMemberships.id, member.id), eq(organizationMemberships.organizationId, actor.organizationId)));
      await tx.update(classes).set({ homeroomTeacherId: null, updatedAt: new Date() })
        .where(and(eq(classes.organizationId, actor.organizationId), eq(classes.homeroomTeacherId, member.userId)));
      await tx.delete(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, actor.organizationId), eq(teacherClassAssignments.teacherId, member.userId)));
      await tx.update(sessions).set({ activeOrganizationId: null, updatedAt: new Date() })
        .where(and(eq(sessions.userId, member.userId), eq(sessions.activeOrganizationId, actor.organizationId)));
      const [nextMembership] = await tx.select({ organizationId: organizationMemberships.organizationId }).from(organizationMemberships)
        .where(eq(organizationMemberships.userId, member.userId)).limit(1);
      await tx.update(users).set({ organizationId: nextMembership?.organizationId ?? null, updatedAt: new Date() })
        .where(and(eq(users.id, member.userId), eq(users.organizationId, actor.organizationId)));
      await logAuditEvent({ organizationId: actor.organizationId, actorUserId: actor.userId, action: "account.staff_access_removed",
        entityType: "user", entityId: member.userId, metadata: { role: member.role } }, tx);
    });
    revalidatePath("/");
    return { success: true as const };
  } catch (error) {
    return { success: false as const, error: error instanceof Error ? error.message : "Staff access could not be removed." };
  }
}
