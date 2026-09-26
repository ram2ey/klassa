import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  classes,
  classTimetablePeriods,
  enrollments,
  subjects,
  users,
} from "@/db/schema";
import { AuditActions, logAuditEvent } from "@/lib/audit";
import type { requireStaff } from "@/lib/action-access";

export class TimetableError extends Error {}

export const dayOfWeekEnum = z.enum([
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
]);
export type DayOfWeek = z.infer<typeof dayOfWeekEnum>;

export const DAY_ORDER: Record<DayOfWeek, number> = {
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
};

export const PERIOD_LABELS: Record<string, string> = {
  morning_roll_call: "Morning Roll Call",
  period_1: "Period 1",
  period_2: "Period 2",
  period_3: "Period 3",
  period_4: "Period 4",
  period_5: "Period 5",
  period_6: "Period 6",
};

export function formatPeriodLabel(period: string): string {
  if (PERIOD_LABELS[period]) return PERIOD_LABELS[period];
  return period
    .replace(/[_-]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export const saveTimetablePeriodSchema = z.object({
  id: z.string().uuid().optional(),
  classId: z.string().uuid("Class ID is required"),
  dayOfWeek: dayOfWeekEnum,
  period: z.string().trim().min(1, "Period identifier is required").max(50),
  startTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Start time must be HH:MM (e.g. 08:30)"),
  endTime: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "End time must be HH:MM (e.g. 09:20)"),
  subjectId: z.string().uuid().optional().nullable(),
  teacherId: z.string().optional().nullable(),
  room: z.string().trim().max(80).optional().nullable(),
  building: z.string().trim().max(80).optional().nullable(),
});
export type SaveTimetablePeriodInput = z.infer<typeof saveTimetablePeriodSchema>;

export const deleteTimetablePeriodSchema = z.object({
  periodId: z.string().uuid(),
});
export type DeleteTimetablePeriodInput = z.infer<typeof deleteTimetablePeriodSchema>;

type StaffAccount = Awaited<ReturnType<typeof requireStaff>>;

export type TimetablePeriodItem = {
  id: string;
  classId: string;
  className?: string;
  dayOfWeek: DayOfWeek;
  period: string;
  periodLabel: string;
  startTime: string;
  endTime: string;
  subjectId?: string | null;
  subjectName?: string | null;
  subjectCode?: string | null;
  teacherId?: string | null;
  teacherName?: string | null;
  room?: string | null;
  building?: string | null;
};

export async function saveTimetablePeriod(
  actor: StaffAccount,
  raw: SaveTimetablePeriodInput
) {
  const input = saveTimetablePeriodSchema.parse(raw);

  if (input.startTime >= input.endTime) {
    throw new TimetableError("Start time must be earlier than end time.");
  }

  return db.transaction(async (tx) => {
    const [targetClass] = await tx
      .select({ id: classes.id, name: classes.name })
      .from(classes)
      .where(
        and(
          eq(classes.id, input.classId),
          eq(classes.organizationId, actor.organizationId)
        )
      )
      .limit(1);

    if (!targetClass) {
      throw new TimetableError("Target class not found in this school.");
    }

    if (input.subjectId) {
      const [subject] = await tx
        .select({ id: subjects.id })
        .from(subjects)
        .where(
          and(
            eq(subjects.id, input.subjectId),
            eq(subjects.organizationId, actor.organizationId)
          )
        )
        .limit(1);

      if (!subject) {
        throw new TimetableError("Assigned subject not found in this school.");
      }
    }

    let savedId: string;
    let isUpdate = false;

    if (input.id) {
      const [existing] = await tx
        .select({ id: classTimetablePeriods.id })
        .from(classTimetablePeriods)
        .where(
          and(
            eq(classTimetablePeriods.id, input.id),
            eq(classTimetablePeriods.organizationId, actor.organizationId)
          )
        )
        .limit(1);

      if (!existing) {
        throw new TimetableError("Timetable period record not found.");
      }

      await tx
        .update(classTimetablePeriods)
        .set({
          dayOfWeek: input.dayOfWeek,
          period: input.period,
          startTime: input.startTime,
          endTime: input.endTime,
          subjectId: input.subjectId ?? null,
          teacherId: input.teacherId ?? null,
          room: input.room ?? null,
          building: input.building ?? null,
          updatedAt: new Date(),
        })
        .where(eq(classTimetablePeriods.id, existing.id));

      savedId = existing.id;
      isUpdate = true;
    } else {
      // Check for slot conflict
      const [conflict] = await tx
        .select({ id: classTimetablePeriods.id })
        .from(classTimetablePeriods)
        .where(
          and(
            eq(classTimetablePeriods.classId, input.classId),
            eq(classTimetablePeriods.dayOfWeek, input.dayOfWeek),
            eq(classTimetablePeriods.period, input.period)
          )
        )
        .limit(1);

      if (conflict) {
        // Update the conflicting slot
        await tx
          .update(classTimetablePeriods)
          .set({
            startTime: input.startTime,
            endTime: input.endTime,
            subjectId: input.subjectId ?? null,
            teacherId: input.teacherId ?? null,
            room: input.room ?? null,
            building: input.building ?? null,
            updatedAt: new Date(),
          })
          .where(eq(classTimetablePeriods.id, conflict.id));

        savedId = conflict.id;
        isUpdate = true;
      } else {
        const [inserted] = await tx
          .insert(classTimetablePeriods)
          .values({
            organizationId: actor.organizationId,
            classId: input.classId,
            dayOfWeek: input.dayOfWeek,
            period: input.period,
            startTime: input.startTime,
            endTime: input.endTime,
            subjectId: input.subjectId ?? null,
            teacherId: input.teacherId ?? null,
            room: input.room ?? null,
            building: input.building ?? null,
          })
          .returning({ id: classTimetablePeriods.id });

        if (!inserted) {
          throw new TimetableError("Failed to create timetable period.");
        }
        savedId = inserted.id;
      }
    }

    await logAuditEvent(
      {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: isUpdate
          ? AuditActions.TIMETABLE_PERIOD_UPDATED
          : AuditActions.TIMETABLE_PERIOD_CREATED,
        entityType: "class_timetable_period",
        entityId: savedId,
        metadata: {
          classId: input.classId,
          dayOfWeek: input.dayOfWeek,
          period: input.period,
          startTime: input.startTime,
          endTime: input.endTime,
          subjectId: input.subjectId,
          room: input.room,
        },
      },
      tx
    );

    return { success: true, periodId: savedId };
  });
}

export async function deleteTimetablePeriod(
  actor: StaffAccount,
  raw: DeleteTimetablePeriodInput
) {
  const input = deleteTimetablePeriodSchema.parse(raw);

  return db.transaction(async (tx) => {
    const [period] = await tx
      .select({
        id: classTimetablePeriods.id,
        classId: classTimetablePeriods.classId,
        dayOfWeek: classTimetablePeriods.dayOfWeek,
        period: classTimetablePeriods.period,
      })
      .from(classTimetablePeriods)
      .where(
        and(
          eq(classTimetablePeriods.id, input.periodId),
          eq(classTimetablePeriods.organizationId, actor.organizationId)
        )
      )
      .limit(1);

    if (!period) {
      throw new TimetableError("Timetable period record not found.");
    }

    await tx
      .delete(classTimetablePeriods)
      .where(eq(classTimetablePeriods.id, period.id));

    await logAuditEvent(
      {
        organizationId: actor.organizationId,
        actorUserId: actor.userId,
        action: AuditActions.TIMETABLE_PERIOD_DELETED,
        entityType: "class_timetable_period",
        entityId: period.id,
        metadata: {
          classId: period.classId,
          dayOfWeek: period.dayOfWeek,
          period: period.period,
        },
      },
      tx
    );

    return { success: true };
  });
}

export async function getClassTimetable(
  classId: string,
  organizationId: string
): Promise<TimetablePeriodItem[]> {
  const rows = await db
    .select({
      id: classTimetablePeriods.id,
      classId: classTimetablePeriods.classId,
      dayOfWeek: classTimetablePeriods.dayOfWeek,
      period: classTimetablePeriods.period,
      startTime: classTimetablePeriods.startTime,
      endTime: classTimetablePeriods.endTime,
      subjectId: classTimetablePeriods.subjectId,
      subjectName: subjects.name,
      subjectCode: subjects.code,
      teacherId: classTimetablePeriods.teacherId,
      teacherName: users.name,
      room: classTimetablePeriods.room,
      building: classTimetablePeriods.building,
    })
    .from(classTimetablePeriods)
    .leftJoin(subjects, eq(subjects.id, classTimetablePeriods.subjectId))
    .leftJoin(users, eq(users.id, classTimetablePeriods.teacherId))
    .where(
      and(
        eq(classTimetablePeriods.classId, classId),
        eq(classTimetablePeriods.organizationId, organizationId)
      )
    )
    .orderBy(asc(classTimetablePeriods.startTime));

  return rows
    .map((row) => ({
      ...row,
      periodLabel: formatPeriodLabel(row.period),
    }))
    .sort((a, b) => {
      const dayDiff = DAY_ORDER[a.dayOfWeek] - DAY_ORDER[b.dayOfWeek];
      if (dayDiff !== 0) return dayDiff;
      return a.startTime.localeCompare(b.startTime);
    });
}

export async function getStudentTimetable(
  studentId: string,
  organizationId: string
): Promise<TimetablePeriodItem[]> {
  const [activePlacement] = await db
    .select({ classId: enrollments.classId })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.studentId, studentId),
        eq(enrollments.organizationId, organizationId),
        eq(enrollments.status, "active")
      )
    )
    .limit(1);

  if (!activePlacement?.classId) {
    return [];
  }

  return getClassTimetable(activePlacement.classId, organizationId);
}
