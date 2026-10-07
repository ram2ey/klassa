import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getFeeStatement } from "@/lib/mvp-print-data";
import { formatCedis } from "@/lib/mvp-policy";
import { PrintReportButton } from "@/components/print-report-button";

export const dynamic = "force-dynamic";
export default async function Statement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await getFeeStatement(id);
  if (!account) notFound();
  const { school, pupil, entries, payments, balancePesewas } = account;
  const rows = [...entries.map(e => ({ id: e.id, date: e.entryDate, label: e.label, detail: e.reason, charge: e.amountPesewas, payment: 0, receiptId: "", stamp: e.createdAt })),
    ...payments.map(p => ({ id: p.id, date: p.paymentDate, label: `${p.receiptNumber}${p.voidedAt ? " (VOID)" : ""}`, detail: p.voidedAt ? p.voidReason : p.reference, charge: 0, payment: p.voidedAt ? 0 : p.amountPesewas, receiptId: p.id, stamp: p.createdAt }))].sort((a, b) => a.date.localeCompare(b.date) || a.stamp.getTime() - b.stamp.getTime());
  return <main className="mx-auto max-w-4xl space-y-6 bg-surface p-8 text-ink print:p-0"><div className="flex justify-between print:hidden"><Link href="/?section=fees" className="text-primary underline">Back to Fees</Link><PrintReportButton /></div><header className="border-b-2 border-ink pb-5"><p className="font-semibold">{school.name}</p><h1 className="mt-2 text-3xl font-bold">Pupil fee statement</h1><p className="mt-2">{pupil.firstName} {pupil.lastName} · {pupil.studentNumber}</p></header><p className="text-xl font-bold">{balancePesewas < 0 ? "Credit" : "Amount owed"}: {formatCedis(Math.abs(balancePesewas))}</p>
    <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Charges and payments</caption><thead><tr className="border-b border-ink">{["Date", "Entry", "Reason / reference", "Charge / adjustment", "Payment"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{rows.map(r => <tr key={r.id} className="border-b border-line"><td className="p-2">{r.date}</td><td className="p-2">{r.receiptId ? <Link href={`/fees/receipts/${r.receiptId}`} className="underline">{r.label}</Link> : r.label}</td><td className="p-2">{r.detail || "—"}</td><td className="p-2">{r.charge ? formatCedis(r.charge) : "—"}</td><td className="p-2">{r.payment ? formatCedis(r.payment) : "—"}</td></tr>)}</tbody></table></div><footer className="text-xs text-secondary">Ghana cedis · Prepared {new Date().toISOString().slice(0, 10)}. Void payments are retained and excluded from the balance.</footer></main>;
}
