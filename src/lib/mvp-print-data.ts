import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { feeEntries, feePayments, organizations, students } from "@/db/schema";
import { requireStaff } from "./action-access";
import { accountBalance } from "./mvp-policy";

export async function getFeeStatement(studentId: string) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  const org = actor.organizationId;
  const [school, pupil, entries, payments] = await Promise.all([
    db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, org)).then(r => r[0]),
    db.select({ id: students.id, studentNumber: students.studentNumber, firstName: students.firstName, lastName: students.lastName }).from(students).where(and(eq(students.organizationId, org), eq(students.id, studentId))).then(r => r[0]),
    db.select().from(feeEntries).where(and(eq(feeEntries.organizationId, org), eq(feeEntries.studentId, studentId))).orderBy(feeEntries.createdAt),
    db.select().from(feePayments).where(and(eq(feePayments.organizationId, org), eq(feePayments.studentId, studentId))).orderBy(feePayments.createdAt),
  ]);
  if (!school || !pupil) return null;
  return { school, pupil, entries, payments, balancePesewas: accountBalance(entries, payments) };
}
export async function getFeeReceipt(paymentId: string) {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  const [payment] = await db.select().from(feePayments).where(and(eq(feePayments.organizationId, actor.organizationId), eq(feePayments.id, paymentId)));
  if (!payment) return null;
  const account = await getFeeStatement(payment.studentId);
  return account ? { payment, school: account.school, pupil: account.pupil } : null;
}
