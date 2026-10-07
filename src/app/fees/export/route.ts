import { requireStaff } from "@/lib/action-access";
import { getMvpData } from "@/lib/mvp-data";
function escapeCSVField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export const dynamic = "force-dynamic";
export async function GET() {
  const actor = await requireStaff(["school_admin", "office_staff"]);
  const data = await getMvpData(actor, "fees", new Date().toISOString().slice(0, 10));
  const rows = [["Pupil number", "Pupil", "Balance owed (GHS)", "Credit (GHS)"], ...data.pupils.map(p => {
    const amount = data.balances.find(b => b.studentId === p.id)?.amountPesewas ?? 0;
    return [p.studentNumber, `${p.firstName} ${p.lastName}`, (Math.max(0, amount) / 100).toFixed(2), (Math.max(0, -amount) / 100).toFixed(2)];
  })];
  return new Response(rows.map(row => row.map(escapeCSVField).join(",")).join("\r\n"), { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="pupil-balances.csv"', "Cache-Control": "private, no-store" } });
}
