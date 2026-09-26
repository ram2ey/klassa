import { formatGMTDateTime } from "@/lib/timezone";
import type { PlatformRestoreDrillData } from "@/lib/platform-restore-drills";

const statusClass = { passed: "bg-emerald-50 text-emerald-800", partial: "bg-amber-50 text-amber-800",
  failed: "bg-red-50 text-red-800" } as const;

export function PlatformRestoreDrills({ data }: { data: PlatformRestoreDrillData }) {
  const latest = data.drills[0];
  return <section className="border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">Disaster recovery drills</h2><p className="mt-1 text-xs text-slate-500">Latest 50 recorded restore checks across schools. Results are entered after a drill; this view does not run a restore.</p></div>
    {latest ? <>
      <div className="grid gap-3 border-b border-slate-100 bg-slate-50 p-5 text-sm sm:grid-cols-3"><div><p className="text-xs text-slate-500">Latest drill</p><p className="mt-1 font-semibold">{formatGMTDateTime(latest.drillDate)}</p></div><div><p className="text-xs text-slate-500">School</p><p className="mt-1 font-semibold">{latest.schoolName}</p></div><div><p className="text-xs text-slate-500">Recorded result</p><span className={`mt-1 inline-block px-2 py-1 text-xs font-semibold capitalize ${statusClass[latest.status]}`}>{latest.status}</span></div></div>
      <ol className="divide-y divide-slate-100">{data.drills.map(drill => <li key={drill.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">{drill.schoolName}</h3><p className="mt-1 text-xs text-slate-500">{formatGMTDateTime(drill.drillDate)} · {drill.operatorName ?? "Operator not recorded"}</p></div><span className={`px-2 py-1 text-xs font-semibold capitalize ${statusClass[drill.status]}`}>{drill.status}</span></div>
        <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-slate-500">Checksum</dt><dd className={`mt-1 font-semibold ${drill.checksumVerified ? "text-emerald-800" : "text-red-800"}`}>{drill.checksumVerified ? "Verified" : "Not verified"}</dd></div><div><dt className="text-slate-500">Validated RPO</dt><dd className="mt-1 font-semibold">{Number(drill.rpoHoursValidated)} hours</dd></div><div><dt className="text-slate-500">Elapsed RTO</dt><dd className="mt-1 font-semibold">{drill.rtoMinutesElapsed} minutes</dd></div><div><dt className="text-slate-500">Reconciled rows</dt><dd className="mt-1 font-semibold">{drill.reconciledStudents} students · {drill.reconciledGuardians} guardians · {drill.reconciledCases} cases</dd></div></dl>
        <details className="mt-4 text-xs"><summary className="cursor-pointer font-semibold text-blue-700">Backup and verification details</summary><dl className="mt-3 space-y-2 border-l-2 border-slate-200 pl-3"><div><dt className="font-semibold">Backup file</dt><dd className="break-all text-slate-600">{drill.backupFilename}</dd></div><div><dt className="font-semibold">Backup size</dt><dd className="text-slate-600">{drill.backupSizeBytes.toLocaleString()} bytes</dd></div><div><dt className="font-semibold">SHA-256</dt><dd className="break-all font-mono text-slate-600">{drill.checksumSha256}</dd></div>{drill.notes && <div><dt className="font-semibold">Notes</dt><dd className="whitespace-pre-wrap text-slate-600">{drill.notes}</dd></div>}</dl></details>
      </li>)}</ol>
    </> : <p className="p-8 text-center text-sm text-slate-500">No restore drills have been recorded yet.</p>}
  </section>;
}
