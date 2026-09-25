import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { announcements, classes, teacherClassAssignments } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";

export async function getStaffAnnouncements() {
  const actor = await requireStaff(["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"]);
  const org = actor.organizationId;
  const [rows, assignments, classRows] = await Promise.all([
    db.select().from(announcements).where(and(eq(announcements.organizationId, org), eq(announcements.status, "published"))).orderBy(desc(announcements.publishedAt)).limit(100),
    db.select().from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.teacherId, actor.userId))),
    db.select().from(classes).where(eq(classes.organizationId, org)),
  ]);
  const assignedClasses = new Set([...assignments.map(row => row.classId),
    ...classRows.filter(row => row.homeroomTeacherId === actor.userId).map(row => row.id)]);
  const assignedGrades = new Set(classRows.filter(row => assignedClasses.has(row.id)).map(row => row.gradeLevelId));
  const seesAll = actor.role !== "teacher";
  return rows.filter(row => row.targetType === "school" || seesAll ||
    (row.targetType === "class" && assignedClasses.has(row.targetId)) ||
    (row.targetType === "grade" && assignedGrades.has(row.targetId)));
}
