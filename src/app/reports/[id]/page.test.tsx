
import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ responses: [] as unknown[][], staff: vi.fn() }));
vi.mock("@/lib/action-access", () => ({ requireStaff: mocks.staff }));
vi.mock("next/navigation", () => ({ notFound: () => { throw new Error("NEXT_NOT_FOUND"); } }));
vi.mock("@/db", () => ({ db: { select: () => ({ from: () => ({ where: () => {
  const rows = mocks.responses.shift() ?? [];
  return { then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve), limit: async () => rows };
} }) }) } }));
import ReportCardPage from "./page";
const id = "11111111-1111-4111-8111-111111111111";
const card = { id, organizationId: "school-a", studentId: "student-a", classId: "class-a", termId: "term-a", academicYearId: "year-a", status: "published", version: 1, daysPresent: 1, daysAbsent: 0, daysLate: 0, daysExcused: 0 };
const params = { params: Promise.resolve({ id }) };
const details = [[{ name: "School A" }], [{ firstName: "Ada", lastName: "Lee", studentNumber: "100" }], [{ name: "Term 1" }], [{ name: "2026" }], [{ id: "class-a", name: "4A", homeroomTeacherId: "teacher-a" }], [], []];
beforeEach(() => { mocks.responses = []; mocks.staff.mockReset().mockResolvedValue({ role: "school_admin", organizationId: "school-a", userId: "admin" }); });
describe("staff printable report access", () => {
  it("opens an administrator's draft and published reports", async () => {
    for (const status of ["draft", "published"]) {
      mocks.responses = [[{ ...card, status }], ...details];
      await expect(ReportCardPage(params)).resolves.toHaveProperty("type", "main");
    }
  });
  it("denies parent access through staff authorization", async () => {
    mocks.staff.mockRejectedValue(new Error("School staff access required"));
    await expect(ReportCardPage(params)).rejects.toThrow("School staff");
    expect(mocks.responses).toEqual([]);
  });
  it("denies office access to a draft", async () => {
    mocks.staff.mockResolvedValue({ role: "office_staff", organizationId: "school-a", userId: "office" });
    mocks.responses = [[{ ...card, status: "draft" }]];
    await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("denies another school's report", async () => {
    mocks.responses = [[{ ...card, organizationId: "school-b" }]];
    await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
  it("allows only the class teacher to read full draft reports", async () => {
    mocks.staff.mockResolvedValue({ role: "teacher", organizationId: "school-a", userId: "teacher-a" });
    mocks.responses = [[card], ...details];
    await expect(ReportCardPage(params)).resolves.toHaveProperty("type", "main");
    mocks.staff.mockResolvedValue({ role: "teacher", organizationId: "school-a", userId: "unassigned" });
    mocks.responses = [[card], ...details, []];
    await expect(ReportCardPage(params)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
