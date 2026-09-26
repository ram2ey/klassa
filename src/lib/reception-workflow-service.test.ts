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
const yearId = "00000000-0000-4000-8000-000000000004";
const sessionId = "00000000-0000-4000-8000-000000000005";
const recordId = "00000000-0000-4000-8000-000000000006";
const logId = "00000000-0000-4000-8000-000000000007";

const officeActor = {
  organizationId: org,
  userId: "office-1",
  name: "Reception Staff",
  role: "office_staff" as const,
};

beforeEach(() => {
  vi.stubEnv("KLASSO_DEMO_MODE", "false");
  mocks.execute.mockReset();
  mocks.commit.mockClear();
  mocks.rollback.mockClear();
  mocks.execute.mockImplementation(async query => query.includes('from "organizations"') ? [[org]] : []);
});

describe("reception late-arrival and early-departure workflows", () => {
  it("rejects unauthorized roles from recording reception movements", async () => {
    const teacherActor = {
      organizationId: org,
      userId: "teacher-1",
      name: "Classroom Teacher",
      role: "teacher" as const,
    };
    await expect(
      saveSchoolWorkflow(teacherActor, {
        kind: "reception_log",
        studentId,
        logType: "late_arrival",
        logDate: "2026-09-26",
        timeString: "09:20",
        minutesLate: 20,
        reason: "Overslept",
        actorPersonName: "Self",
        relationship: "self",
        isExcused: false,
      })
    ).rejects.toThrow("cannot change this school record");
  });

  it("lets office staff record a late arrival and syncs submitted morning roll call", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "students"')) {
        return [[studentId, org, "ST-100", null, "Lucas", null, "Vance", null, "2012-05-10", "active", new Date(), new Date()]];
      }
      if (query.startsWith('insert into "reception_logs"')) {
        return [[logId, org, studentId, "late_arrival", "2026-09-26", "09:25", 25, "Medical appointment", "Jane Vance", "mother", true, officeActor.userId, null, new Date(), new Date()]];
      }
      if (query.includes('from "academic_years"')) return [[yearId]];
      if (query.includes('from "enrollments"')) return [[classId]];
      if (query.includes('from "attendance_sessions"')) return [[sessionId, "submitted"]];
      if (query.includes('from "attendance_records"')) return [[recordId, "absent"]];
      if (query.startsWith('update "attendance_records"')) return [[recordId]];
      if (query.startsWith('insert into "attendance_corrections"')) return [[recordId]];
      if (query.startsWith('insert into "audit_events"')) {
        return [[recordId, org, officeActor.userId, "reception.late_arrival", "reception_log", logId, null, {}, new Date()]];
      }
      return [];
    });

    const result = await saveSchoolWorkflow(officeActor, {
      kind: "reception_log",
      studentId,
      logType: "late_arrival",
      logDate: "2026-09-26",
      timeString: "09:25",
      minutesLate: 25,
      reason: "Medical appointment",
      actorPersonName: "Jane Vance",
      relationship: "mother",
      isExcused: true,
      remarks: "Brought doctor note",
    });

    expect(result.entityId).toBe(logId);
    expect(mocks.commit).toHaveBeenCalledOnce();

    const correctionCall = mocks.execute.mock.calls.find(([query]) =>
      query.startsWith('insert into "attendance_corrections"')
    );
    expect(correctionCall).toBeDefined();

    const auditCall = mocks.execute.mock.calls.find(([query]) =>
      query.startsWith('insert into "audit_events"')
    );
    expect(auditCall).toBeDefined();
  });

  it("blocks early departure pickup when matching an enforced court restriction", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "students"')) {
        return [[studentId, org, "ST-100", null, "Lucas", null, "Vance", null, "2012-05-10", "active", new Date(), new Date()]];
      }
      if (query.includes('from "court_restrictions"')) {
        return [[
          recordId, org, studentId, null, "Marcus Vance", "restraining_order", "CR-9099",
          "Family Court", "Prohibited contact and pickup", true, true, true,
          "2026-01-01", null, true, new Date(), new Date()
        ]];
      }
      return [];
    });

    await expect(
      saveSchoolWorkflow(officeActor, {
        kind: "reception_log",
        studentId,
        logType: "early_departure",
        logDate: "2026-09-26",
        timeString: "13:30",
        minutesLate: 0,
        reason: "Early pickup",
        actorPersonName: "Marcus Vance",
        relationship: "father",
        isExcused: false,
      })
    ).rejects.toThrow("COURT RESTRICTION ALERT");

    expect(mocks.commit).not.toHaveBeenCalled();
    expect(mocks.rollback).toHaveBeenCalledOnce();
  });

  it("permits authorized early departure and logs audit trail", async () => {
    mocks.execute.mockImplementation(async (query) => {
      if (query.includes('from "organizations"')) return [[org]];
      if (query.includes('from "students"')) {
        return [[studentId, org, "ST-100", null, "Lucas", null, "Vance", null, "2012-05-10", "active", new Date(), new Date()]];
      }
      if (query.includes('from "court_restrictions"')) return [];
      if (query.startsWith('insert into "reception_logs"')) {
        return [[logId, org, studentId, "early_departure", "2026-09-26", "13:30", 0, "Dentist appointment", "Jane Vance", "mother", true, officeActor.userId, null, new Date(), new Date()]];
      }
      if (query.startsWith('insert into "audit_events"')) {
        return [[recordId, org, officeActor.userId, "reception.early_departure", "reception_log", logId, null, {}, new Date()]];
      }
      return [];
    });

    const result = await saveSchoolWorkflow(officeActor, {
      kind: "reception_log",
      studentId,
      logType: "early_departure",
      logDate: "2026-09-26",
      timeString: "13:30",
      minutesLate: 0,
      reason: "Dentist appointment",
      actorPersonName: "Jane Vance",
      relationship: "mother",
      isExcused: true,
    });

    expect(result.entityId).toBe(logId);
    expect(mocks.commit).toHaveBeenCalledOnce();
  });
});
