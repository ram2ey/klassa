import { describe, expect, it } from "vitest";
import { accountBalance, canonicalMvpLocation, mvpCommandSchema, parsePesewas, termTotal } from "./mvp-policy";
import { requireDeferredFeature, requireMvpLegacyWorkflow } from "./mvp-release";

describe("MVP marks and fee rules", () => {
  it("calculates 40/60 totals, rounds fractional results and keeps missing scores separate from zero", () => {
    expect(termTotal(80, 75, 40)).toBe("77.00");
    expect(termTotal(92.99, 88.88, 40)).toBe("90.52");
    expect(termTotal(0, 0, 40)).toBe("0.00");
    expect(termTotal(null, 100, 40)).toBeNull();
    expect(termTotal(100, null, 40)).toBeNull();
    expect(termTotal(100, 0, 30)).toBe("30.00");
  });
  it("parses cedis without floating-point rounding", () => {
    expect(parsePesewas("0.29")).toBe(29);
    expect(parsePesewas("125.5")).toBe(12550);
    expect(parsePesewas("-40.25")).toBe(-4025);
    for (const bad of ["1.001", "NaN", "Infinity", "1e3", "", "GHS 10"]) expect(() => parsePesewas(bad)).toThrow();
  });
  it("includes opening debt, discounts, partial payments and credits while excluding void payments", () => {
    const entries = [{ amountPesewas: 10000 }, { amountPesewas: 45000 }, { amountPesewas: -5000 }];
    expect(accountBalance(entries, [{ amountPesewas: 20000, voidedAt: null }])).toBe(30000);
    expect(accountBalance(entries, [{ amountPesewas: 60000, voidedAt: null }])).toBe(-10000);
    expect(accountBalance(entries, [{ amountPesewas: 60000, voidedAt: "2026-10-07" }])).toBe(50000);
  });
  it("rejects nonpositive payments and marks with more than two decimals", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(mvpCommandSchema.safeParse({ kind: "payment", requestId: id, studentId: id, amountPesewas: 0, date: "2026-10-07", method: "cash" }).success).toBe(false);
    expect(mvpCommandSchema.safeParse({ kind: "marks", requestId: id, classId: id, termId: id, subjectId: id, rows: [{ studentId: id, classworkScore: 1.001, examScore: null, remark: "" }] }).success).toBe(false);
  });
  it("maps old bookmarks to the smaller workspace", () => {
    expect(canonicalMvpLocation("guardians")).toEqual({ section: "students", tab: "contacts" });
    expect(canonicalMvpLocation("academic")).toEqual({ section: "settings", tab: "academic" });
    expect(canonicalMvpLocation("reports")).toEqual({ section: "marks", tab: "reports" });
    expect(canonicalMvpLocation("behaviour")).toEqual({ section: "overview", tab: "" });
  });
  it("blocks deferred features and legacy assessment/report actions", () => {
    expect(() => requireDeferredFeature("Parent portal")).toThrow("staff-only");
    for (const kind of ["assessment", "report_status", "announcement", "behaviour_log", "reception_log", "sensitive_note"]) expect(() => requireMvpLegacyWorkflow(kind)).toThrow();
    expect(() => requireMvpLegacyWorkflow("attendance", "period_1")).toThrow();
    expect(() => requireMvpLegacyWorkflow("attendance", "morning_roll_call")).not.toThrow();
  });
});
