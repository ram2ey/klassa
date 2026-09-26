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
const studentId1 = "00000000-0000-4000-8000-000000000002";
const studentId2 = "00000000-0000-4000-8000-000000000003";
const guardianId1 = "00000000-0000-4000-8000-000000000004";
const guardianId2 = "00000000-0000-4000-8000-000000000005";
const gradeId = "00000000-0000-4000-8000-000000000006";
const classId = "00000000-0000-4000-8000-000000000007";

const adminActor = {
  organizationId: org,
  userId: "admin-1",
  name: "Principal Anderson",
  role: "school_admin" as const,
};

const officeActor = {
  organizationId: org,
  userId: "office-1",
  name: "Reception Desk",
  role: "office_staff" as const,
};

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset();
  mocks.commit.mockClear();
  mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async (query) => {
    if (query.includes('from "organizations"')) return [[org, "Northfield Academy"]];
    return [];
  });
});

describe("emergency parent SMS broadcast workflows", () => {
  it("rejects unauthorized roles from sending emergency SMS broadcasts", async () => {
    const teacherActor = {
      organizationId: org,
      userId: "teacher-1",
      name: "Class Teacher",
      role: "teacher" as const,
    };

    await expect(
      saveSchoolWorkflow(teacherActor, {
        kind: "emergency_sms_broadcast",
        scope: "whole_school",
        targetId: "all",
        severity: "lockdown",
        message: "Emergency lockdown active.",
      })
    ).rejects.toThrow("Teachers cannot change this school record");

    const nurseActor = {
      organizationId: org,
      userId: "nurse-1",
      name: "School Nurse",
      role: "health_nurse" as const,
    };

    await expect(
      saveSchoolWorkflow(nurseActor, {
        kind: "emergency_sms_broadcast",
        scope: "whole_school",
        targetId: "all",
        severity: "lockdown",
        message: "Emergency lockdown active.",
      })
    ).rejects.toThrow("cannot change this school record");
  });

  it("lets school admin broadcast to whole school and logs audit trail", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org, "Northfield Academy"]];
      if (query.includes('from "students"')) {
        return [
          [studentId1, "active"],
          [studentId2, "active"],
        ];
      }
      if (query.includes('from "student_guardians"')) {
        return [
          [studentId1, guardianId1, "John", "Doe", "+44 7700 900077"],
          [studentId2, guardianId2, "Jane", "Smith", "07700 900088"],
        ];
      }
      if (query.startsWith('insert into "sms_dispatches"')) {
        return [["sms-disp-1"]];
      }
      if (query.startsWith('insert into "audit_events"')) {
        return [["audit-1"]];
      }
      return [];
    });

    const result = await saveSchoolWorkflow(adminActor, {
      kind: "emergency_sms_broadcast",
      scope: "whole_school",
      targetId: "all",
      severity: "lockdown",
      message: "[Northfield] Precautionary campus lockdown in effect. All students safe.",
    });

    expect(result.entityId).toBeDefined();
    expect(result.recipientCount).toBe(2);
    expect(mocks.commit).toHaveBeenCalledOnce();

    const dispatchCalls = mocks.execute.mock.calls.filter(([query]) =>
      query.startsWith('insert into "sms_dispatches"')
    );
    expect(dispatchCalls).toHaveLength(2);

    const auditCall = mocks.execute.mock.calls.find(([query]) =>
      query.startsWith('insert into "audit_events"')
    );
    expect(auditCall).toBeDefined();
  });

  it("lets office staff broadcast to a specific grade", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org, "Northfield Academy"]];
      if (query.includes('from "classes"')) {
        return [[classId]];
      }
      if (query.includes('from "enrollments"')) {
        return [[studentId1]];
      }
      if (query.includes('from "student_guardians"')) {
        return [[studentId1, guardianId1, "Alice", "Vance", "+354 555 1234"]];
      }
      if (query.startsWith('insert into "sms_dispatches"')) {
        return [["sms-disp-1"]];
      }
      if (query.startsWith('insert into "audit_events"')) {
        return [["audit-1"]];
      }
      return [];
    });

    const result = await saveSchoolWorkflow(officeActor, {
      kind: "emergency_sms_broadcast",
      scope: "grade",
      targetId: gradeId,
      severity: "weather_alert",
      message: "[Northfield] Grade 10 field excursion delayed due to highway weather.",
    });

    expect(result.recipientCount).toBe(1);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });

  it("fails gracefully if no active students found in selected scope", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org, "Northfield Academy"]];
      if (query.includes('from "students"')) return [];
      return [];
    });

    await expect(
      saveSchoolWorkflow(adminActor, {
        kind: "emergency_sms_broadcast",
        scope: "whole_school",
        targetId: "all",
        severity: "school_closure",
        message: "School closed today due to snow.",
      })
    ).rejects.toThrow("No active students found");

    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("fails if guardians in scope have no registered phone numbers", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org, "Northfield Academy"]];
      if (query.includes('from "students"')) return [[studentId1, "active"]];
      if (query.includes('from "student_guardians"')) {
        return [[studentId1, guardianId1, "No", "Phone", ""]];
      }
      return [];
    });

    await expect(
      saveSchoolWorkflow(adminActor, {
        kind: "emergency_sms_broadcast",
        scope: "whole_school",
        targetId: "all",
        severity: "urgent_alert",
        message: "Urgent bus delay for all routes.",
      })
    ).rejects.toThrow("No guardians with registered phone numbers were found");

    expect(mocks.rollback).toHaveBeenCalledOnce();
  });
});
