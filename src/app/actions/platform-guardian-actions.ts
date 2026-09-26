"use server";

import { and, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { guardians, organizations, studentGuardians, students } from "@/db/schema";
import { requirePlatformAdmin } from "@/lib/action-access";

export async function searchPlatformGuardiansAction(rawQuery: string) {
  const admin = await requirePlatformAdmin();
  if (!admin.twoFactorEnabled) throw new Error("Multi-factor authentication is required.");
  const query = z.string().trim().min(2).max(100).parse(rawQuery);
  const pattern = `%${query.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
  const rows = await db.select({ id: guardians.id, organizationId: guardians.organizationId,
    schoolName: organizations.name, firstName: guardians.firstName, lastName: guardians.lastName,
    email: guardians.email, phone: guardians.phone, userId: guardians.userId,
    linkedStudents: sql<number>`count(distinct ${studentGuardians.studentId})` })
    .from(guardians).innerJoin(organizations, eq(organizations.id, guardians.organizationId))
    .leftJoin(studentGuardians, and(eq(studentGuardians.guardianId, guardians.id),
      eq(studentGuardians.organizationId, guardians.organizationId)))
    .leftJoin(students, and(eq(students.id, studentGuardians.studentId),
      eq(students.organizationId, guardians.organizationId)))
    .where(or(ilike(guardians.firstName, pattern), ilike(guardians.lastName, pattern),
      ilike(guardians.email, pattern), ilike(guardians.phone, pattern)))
    .groupBy(guardians.id, organizations.name).limit(50);
  return rows;
}
