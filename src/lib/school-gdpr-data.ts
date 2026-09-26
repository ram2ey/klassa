import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { gdprRequests, students } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

export async function getSchoolGdprData() {
  const actor = await requireStaff(["school_admin"]);
  const requests = await db.select({ id: gdprRequests.id, studentId: gdprRequests.studentId,
    requestType: gdprRequests.requestType, status: gdprRequests.status,
    requesterName: gdprRequests.requesterName, requesterRole: gdprRequests.requesterRole,
    requesterEmail: gdprRequests.requesterEmail, justification: gdprRequests.justification,
    safeguardingRedacted: gdprRequests.safeguardingRedacted, createdAt: gdprRequests.createdAt,
    processedAt: gdprRequests.processedAt, studentFirstName: students.firstName,
    studentLastName: students.lastName })
    .from(gdprRequests).innerJoin(students, and(eq(students.id, gdprRequests.studentId),
      eq(students.organizationId, gdprRequests.organizationId)))
    .where(eq(gdprRequests.organizationId, actor.organizationId))
    .orderBy(desc(gdprRequests.createdAt));
  return { requests };
}

export type SchoolGdprData = Awaited<ReturnType<typeof getSchoolGdprData>>;
