import { z } from "zod";

const id = z.uuid();
const request = { requestId: id };
const reason = z.string().trim().min(4, "Enter a reason of at least four characters.").max(500);
const score = z.number().min(0).max(100).refine(n => Number.isInteger(Math.round(n * 100)) && Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Use at most two decimal places.").nullable();
const amount = z.number().int().min(1).max(100_000_000_000);
const pupils = z.array(id).min(1).max(500).refine(ids => new Set(ids).size === ids.length, "A pupil was selected twice.");

export const mvpCommandSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("class_subjects"), ...request, classId: id, subjectIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length) }),
  z.object({ kind: z.literal("term_weights"), ...request, termId: id, classworkWeight: z.number().int().min(1).max(99) }),
  z.object({ kind: z.literal("marks"), ...request, classId: id, termId: id, subjectId: id,
    rows: z.array(z.object({ studentId: id, classworkScore: score, examScore: score, remark: z.string().trim().max(500) })).min(1).max(500),
    correctionReason: z.string().trim().max(500).default("") }),
  z.object({ kind: z.literal("reports"), ...request, classId: id, termId: id, studentIds: pupils,
    publish: z.boolean(), teacherRemarks: z.string().trim().max(5000).default(""), principalRemarks: z.string().trim().max(5000).default("") }),
  z.object({ kind: z.literal("attendance"), ...request, classId: id, date: z.iso.date(), submit: z.boolean(),
    rows: z.array(z.object({ studentId: id, status: z.enum(["present", "absent", "late", "excused"]) })).min(1).max(500), correctionReason: z.string().trim().max(500).default("") }),
  z.object({ kind: z.literal("fee_definition"), ...request, classId: id, termId: id, name: z.string().trim().min(2).max(120), amountPesewas: amount }),
  z.object({ kind: z.literal("fee_apply"), ...request, definitionId: id, studentIds: pupils }),
  z.object({ kind: z.literal("fee_entry"), ...request, studentId: id, termId: id.optional(), entryKind: z.enum(["opening", "adjustment"]),
    amountPesewas: z.number().int().min(-100_000_000_000).max(100_000_000_000).refine(n => n !== 0), reason, date: z.iso.date() }),
  z.object({ kind: z.literal("payment"), ...request, studentId: id, amountPesewas: amount, date: z.iso.date(), method: z.enum(["cash", "mobile_money", "bank"]), reference: z.string().trim().max(120).default("") }),
  z.object({ kind: z.literal("payment_void"), ...request, paymentId: id, reason }),
]);
export type MvpCommand = z.input<typeof mvpCommandSchema>;
export type MvpInput = MvpCommand extends infer C ? C extends MvpCommand ? Omit<C, "requestId"> : never : never;

/** Decimal text is converted once to integer pesewas; never multiply a float. */
export function parsePesewas(value: string): number {
  const match = /^(-?)(\d{1,9})(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) throw new Error("Enter a cedi amount with at most two decimal places.");
  return (match[1] ? -1 : 1) * (Number(match[2]) * 100 + Number((match[3] ?? "").padEnd(2, "0")));
}
export function formatCedis(pesewas: number): string {
  return new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(pesewas / 100);
}
export function termTotal(classwork: number | null, exam: number | null, weight: number): string | null {
  if (classwork === null || exam === null) return null;
  // Scores in hundredths multiplied by integer percentage weights.
  return (Math.round((Math.round(classwork * 100) * weight + Math.round(exam * 100) * (100 - weight)) / 100) / 100).toFixed(2);
}
export function accountBalance(entries: { amountPesewas: number }[], payments: { amountPesewas: number; voidedAt: Date | string | null }[]): number {
  return entries.reduce((sum, entry) => sum + entry.amountPesewas, 0) - payments.filter(p => !p.voidedAt).reduce((sum, p) => sum + p.amountPesewas, 0);
}

export function canonicalMvpLocation(section = "overview", tab = ""): { section: string; tab: string } {
  const setup = ["staff", "classes", "subjects", "academic", "audit"];
  if (setup.includes(section)) return { section: "settings", tab: section };
  if (section === "guardians") return { section: "students", tab: "contacts" };
  if (section === "imports") return { section: "students", tab: "pupils" };
  if (["gradebook", "reports"].includes(section)) return { section: "marks", tab: section === "reports" ? "reports" : "marks" };
  if (["overview", "students", "attendance", "marks", "fees", "settings"].includes(section)) return { section, tab };
  return { section: "overview", tab: "" };
}
