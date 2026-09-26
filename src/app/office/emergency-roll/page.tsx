import { getOfficeData } from "@/lib/office-data";
import { PrintReportButton } from "@/components/print-report-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function EmergencyRollPage() {
  const date = new Date().toISOString().slice(0, 10);
  const data = await getOfficeData(date);
  const year = data.years.find(row => row.isCurrent);
  const classes = data.classes.filter(row => row.academicYearId === year?.id);
  return <main className="mx-auto max-w-5xl space-y-8 p-6 text-slate-900 print:max-w-none print:p-0">
    <div className="flex items-center justify-between gap-4 print:hidden"><Link href="/?section=attendance" className="text-sm text-blue-800 underline">Back to office</Link><PrintReportButton /></div>
    <header><p className="text-sm font-semibold">{data.school.name}</p><h1 className="text-2xl font-bold">Emergency roll sheets</h1><p className="text-sm">Prepared {date}. Verify every student against the live register during an evacuation.</p></header>
    {classes.map(klass => { const pupils = data.enrollments.filter(row => row.classId === klass.id && row.status === "active")
      .map(row => data.students.find(student => student.id === row.studentId)).filter((row): row is NonNullable<typeof row> => !!row);
      return <section key={klass.id} className="break-after-page"><h2 className="mb-3 border-b-2 border-slate-900 pb-2 text-xl font-bold">{klass.name} · {pupils.length} students</h2>
        <table className="w-full border-collapse text-left text-sm"><thead><tr><th className="border p-2">Student</th><th className="border p-2">Number</th><th className="border p-2">Present</th><th className="border p-2">Notes</th></tr></thead><tbody>{pupils.map(student =>
          <tr key={student.id}><td className="border p-2">{student.firstName} {student.lastName}</td><td className="border p-2">{student.studentNumber}</td><td className="border p-2">□</td><td className="border p-2">{data.medicalAlerts.filter(alert => alert.studentId === student.id).map(alert => alert.directiveSummary).join("; ")}{data.restrictions.some(row => row.studentId === student.id && row.isEnforced && row.prohibitPickup && row.effectiveDate <= date && (!row.expirationDate || row.expirationDate >= date)) ? " · Pickup restriction: verify with office" : ""}</td></tr>)}</tbody></table>
        <p className="mt-4 text-sm">Accounted for: ______ / {pupils.length} · Checked by: ____________________ · Time: __________</p>
      </section>; })}
    {!classes.length && <p>No current classes are available.</p>}
  </main>;
}
