// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Sql } from "postgres";

const mocks = vi.hoisted(() => ({
  execute: vi.fn<(sql: string, params: unknown[]) => Promise<unknown[][]>>(),
  commit: vi.fn(),
  rollback: vi.fn(),
}));

vi.mock("@/db", async () => {
  const { drizzle } = await import("drizzle-orm/postgres-js");
  const client = {
    options: { parsers: {}, serializers: {} },
    unsafe(sql: string, params: unknown[]) {
      const result = mocks.execute(sql, params);
      return Object.assign(result, { values: () => result });
    },
    async begin<T>(operation: (connection: unknown) => Promise<T>): Promise<T> {
      try {
        const result = await operation(client);
        mocks.commit();
        return result;
      } catch (error) {
        mocks.rollback();
        throw error;
      }
    },
  };
  return { db: drizzle(client as unknown as Sql) };
});

import { saveSchoolWorkflow } from "@/lib/school-workflow-service";

const org = "00000000-0000-4000-8000-000000000001";
const studentId = "00000000-0000-4000-8000-000000000002";
const classId = "00000000-0000-4000-8000-000000000003";
const behaviourId = "00000000-0000-4000-8000-000000000004";
const enrollmentId = "00000000-0000-4000-8000-000000000005";

const teacherActor = {
  organizationId: org,
  userId: "teacher-1",
  name: "Classroom Teacher",
  role: "teacher" as const,
};

const adminActor = {
  organizationId: org,
  userId: "admin-1",
  name: "Principal Skinner",
  role: "school_admin" as const,
};

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset();
  mocks.commit.mockClear();
  mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => {
    if (query.includes('from "organizations"')) return [[org]];
    return [];
  });
});

const mockBehaviourRow = (type: "praise" | "incident", category: string, points: number) => [
  behaviourId,
  org,
  studentId,
  classId,
  teacherActor.userId,
  type,
  category,
  points,
  "Notes",
  true,
  "2026-09-26",
  new Date(),
  new Date(),
];

describe("teacher and admin behaviour conduct workflow", () => {
  it("rejects unauthorized roles from logging behaviour conduct", async () => {
    const officeActor = {
      organizationId: org,
      userId: "office-1",
      name: "Office Reception",
      role: "office_staff" as const,
    };
    await expect(
      saveSchoolWorkflow(officeActor, {
        kind: "behaviour_log",
        studentId,
        classId,
        type: "praise",
        category: "academic_excellence",
        points: 2,
        occurredAt: "2026-09-26",
      })
    ).rejects.toThrow("Office staff can only correct recorded attendance");
  });

  it("allows teacher to log praise merit points for enrolled student", async () => {
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.includes('from "organizations"')) return [[org]];
      // Teacher assignments check
      if (query.includes('from "teacher_class_assignments"')) return [[classId, null, teacherActor.userId, true]];
      // Class homeroom check
      if (query.includes('from "classes"')) return [[teacherActor.userId]];
      // Enrollment check for student in class
      if (query.includes('from "enrollments"')) return [[enrollmentId]];
      // Student existence check
      if (query.includes('from "students"')) return [[studentId]];
      // Insert studentBehaviours
      if (query.startsWith('insert into "student_behaviours"')) return [mockBehaviourRow("praise", "academic_excellence", 3)];
      // Insert audit_events
      if (query.startsWith('insert into "audit_events"')) return [["audit-1"]];
      return [];
    });

    const result = await saveSchoolWorkflow(teacherActor, {
      kind: "behaviour_log",
      studentId,
      classId,
      type: "praise",
      category: "academic_excellence",
      points: 3,
      description: "Solved advanced algebra challenge before the class",
      guardianVisible: true,
      occurredAt: "2026-09-26",
    });

    expect(result.entityId).toBe(behaviourId);
    expect(mocks.commit).toHaveBeenCalled();

    // Verify audit event query had praise_logged
    const auditCall = mocks.execute.mock.calls.find(call => call[0].startsWith('insert into "audit_events"'));
    expect(auditCall).toBeTruthy();
    expect(auditCall?.[1]).toContain("behaviour.praise_logged");
  });

  it("allows teacher to log incident sanctions and writes incident audit event", async () => {
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "teacher_class_assignments"')) return [[classId, null, teacherActor.userId, true]];
      if (query.includes('from "classes"')) return [[teacherActor.userId]];
      if (query.includes('from "enrollments"')) return [[enrollmentId]];
      if (query.includes('from "students"')) return [[studentId]];
      if (query.startsWith('insert into "student_behaviours"')) return [mockBehaviourRow("incident", "disruption", 1)];
      if (query.startsWith('insert into "audit_events"')) return [["audit-2"]];
      return [];
    });

    const result = await saveSchoolWorkflow(teacherActor, {
      kind: "behaviour_log",
      studentId,
      classId,
      type: "incident",
      category: "disruption",
      points: 1,
      description: "Repeatedly talked over instructions during group presentation",
      guardianVisible: true,
      occurredAt: "2026-09-26",
    });

    expect(result.entityId).toBe(behaviourId);
    const auditCall = mocks.execute.mock.calls.find(call => call[0].startsWith('insert into "audit_events"'));
    expect(auditCall?.[1]).toContain("behaviour.incident_logged");
  });

  it("blocks teacher if student is not actively enrolled in teacher class", async () => {
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "teacher_class_assignments"')) return [[classId, null, teacherActor.userId, true]];
      if (query.includes('from "classes"')) return [[teacherActor.userId]];
      if (query.includes('from "enrollments"')) return []; // No enrollment!
      return [];
    });

    await expect(
      saveSchoolWorkflow(teacherActor, {
        kind: "behaviour_log",
        studentId,
        classId,
        type: "praise",
        category: "helping_others",
        points: 1,
        occurredAt: "2026-09-26",
      })
    ).rejects.toThrow("Student is not actively enrolled in this class");
  });

  it("allows school_admin to log behaviour for any student across school", async () => {
    mocks.execute.mockImplementation(async (query, params) => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "students"')) return [[studentId]];
      if (query.includes('from "classes"')) return [[classId]];
      if (query.startsWith('insert into "student_behaviours"')) return [mockBehaviourRow("praise", "leadership", 5)];
      if (query.startsWith('insert into "audit_events"')) return [["audit-admin"]];
      return [];
    });

    const result = await saveSchoolWorkflow(adminActor, {
      kind: "behaviour_log",
      studentId,
      classId,
      type: "praise",
      category: "leadership",
      points: 5,
      description: "Head of School special recognition for community service",
      guardianVisible: true,
      occurredAt: "2026-09-26",
    });

    expect(result.entityId).toBe(behaviourId);
    expect(mocks.commit).toHaveBeenCalled();
  });
});

