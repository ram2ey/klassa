import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFeeReceipt } from "@/lib/mvp-print-data";
import { formatCedis } from "@/lib/mvp-policy";
import { PrintReportButton } from "@/components/print-report-button";

export const dynamic = "force-dynamic";
export default async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const receipt = await getFeeReceipt(id);
  if (!receipt) notFound();
  const { payment, pupil, school } = receipt;
  const details = [["Receipt", payment.receiptNumber], ["Pupil", `${pupil.firstName} ${pupil.lastName}`], ["Pupil number", pupil.studentNumber], ["Payment date", payment.paymentDate], ["Method", payment.method.replaceAll("_", " ")], ["Reference", payment.reference || "—"], ["Amount received", formatCedis(payment.amountPesewas)], ["Balance immediately after payment", `${formatCedis(Math.abs(payment.balanceAfterPesewas))}${payment.balanceAfterPesewas < 0 ? " credit" : " owed"}`]];
  return <main className="mx-auto max-w-2xl space-y-6 bg-surface p-8 text-ink print:p-0"><div className="flex justify-between print:hidden"><Link href="/?section=fees" className="text-primary underline">Back to Fees</Link><PrintReportButton /></div><header className="border-b-2 border-ink pb-5"><p className="font-semibold">{school.name}</p><h1 className="mt-2 text-3xl font-bold">Payment receipt{payment.voidedAt ? " — VOID" : ""}</h1></header>
    {payment.voidedAt && <p className="border-2 border-danger p-4 font-semibold">VOID: {payment.voidReason}. This receipt does not count as a payment.</p>}
    <dl className="grid gap-5 sm:grid-cols-2">{details.map(([label, value]) => <div key={label}><dt className="text-sm text-secondary">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl><p className="border-t border-line pt-4 text-xs text-secondary">Amounts in Ghana cedis. Later charges or payments may change the current account balance.</p></main>;
}
