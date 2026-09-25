import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  responses: [] as unknown[][],
  account: vi.fn(), guardian: vi.fn(), staff: vi.fn(),
}));

vi.mock("@/lib/action-access", () => ({
  requireAccount: mocks.account, requireGuardian: mocks.guardian, requireStaff: mocks.staff,
}));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => {
  const rows = mocks.responses.shift() ?? [];
  return { then: (resolve: (value: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
    limit: async () => rows };
} }) }) } }));

import ReportCardPage from "./page";

const id = "11111111-1111-4111-8111-111111111111";
const card = { id, organizationId: "school-a", studentId: "student-a", classId: "class-a",
  termId: "term-a", academicYearId: "year-a", status: "published", version: 1,
  daysPresent: 0, daysAbsent: 0, daysLate: 0 };
const params = { params: Promise.resolve({ id }) };
const details = [[{ id: "school-a", name: "School A" }], [{ id: "student-a", firstName: "Ada", lastName: "Lee", studentNumber: "100" }],
  [{ id: "term-a", name: "Autumn" }], [{ id: "year-a", name: "2026" }], [], []];

beforeEach(() => {
  mocks.responses = [];
  mocks.account.mockReset().mockResolvedValue({ user: { role: null, isPlatformAdmin: false } });
  mocks.guardian.mockReset().mockResolvedValue({ guardians: [{ id: "guardian-a", organizationId: "school-a" }] });
  mocks.staff.mockReset();
});

describe("printable report card access", () => {
  it("opens a published report for a guardian with a legal link", async () => {
    mocks.responses = [[card], [{ id: "legal-link" }], ...details];
    await expect(ReportCardPage(params)).resolves.toHaveProperty("type", "main");
    expect(mocks.staff).not.toHaveBeenCalled();
  });

  it("denies a guardian without legal responsibility", async () => {
    mocks.responses = [[card], []];
    await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("denies draft and approved reports to guardians", async () => {
    for (const status of ["draft", "approved"]) {
      mocks.responses = [[{ ...card, status }]];
      await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
      expect(mocks.responses).toHaveLength(0);
    }
  });

  it("denies a report from another school before checking student links", async () => {
    mocks.responses = [[{ ...card, organizationId: "school-b" }]];
    await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.responses).toHaveLength(0);
  });

  it("preserves staff access to an internal report in their school", async () => {
    mocks.account.mockResolvedValue({ user: { role: "school_admin", isPlatformAdmin: false } });
    mocks.staff.mockResolvedValue({ role: "school_admin", organizationId: "school-a", userId: "admin" });
    mocks.responses = [[{ ...card, status: "draft" }], ...details];
    await expect(ReportCardPage(params)).resolves.toHaveProperty("type", "main");
    expect(mocks.guardian).not.toHaveBeenCalled();
  });

  it("denies staff from another school", async () => {
    mocks.account.mockResolvedValue({ user: { role: "school_admin", isPlatformAdmin: false } });
    mocks.staff.mockResolvedValue({ role: "school_admin", organizationId: "school-b", userId: "admin" });
    mocks.responses = [[card]];
    await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
