import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { academicYears, classes, organizations, reportCards, reportCardSubjectGrades, students, subjects, teacherClassAssignments, terms } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { PrintReportButton } from "@/components/print-report-button";

export const dynamic = "force-dynamic";

export default async function ReportCardPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requireStaff(["school_admin", "teacher"]);
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound();
  const org = actor.organizationId;
  const [card] = await db.select().from(reportCards).where(and(eq(reportCards.id, id), eq(reportCards.organizationId, org)));
  if (!card) notFound();
  if (actor.role === "teacher") {
    const [classRow, assignments] = await Promise.all([
      db.select({ homeroomTeacherId: classes.homeroomTeacherId }).from(classes).where(and(eq(classes.id, card.classId), eq(classes.organizationId, org))).then(rows => rows[0]),
      db.select({ id: teacherClassAssignments.id }).from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org),
        eq(teacherClassAssignments.classId, card.classId), eq(teacherClassAssignments.teacherId, actor.userId), eq(teacherClassAssignments.isPrimaryHomeroom, true))),
    ]);
    if (classRow?.homeroomTeacherId !== actor.userId && !assignments.length) notFound();
  }
  const [school, student, term, year, results, subjectRows] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, org)).then(rows => rows[0]),
    db.select().from(students).where(and(eq(students.id, card.studentId), eq(students.organizationId, org))).then(rows => rows[0]),
    db.select().from(terms).where(and(eq(terms.id, card.termId), eq(terms.organizationId, org))).then(rows => rows[0]),
    db.select().from(academicYears).where(and(eq(academicYears.id, card.academicYearId), eq(academicYears.organizationId, org))).then(rows => rows[0]),
    db.select().from(reportCardSubjectGrades).where(and(eq(reportCardSubjectGrades.organizationId, org), eq(reportCardSubjectGrades.reportCardId, card.id))),
    db.select().from(subjects).where(eq(subjects.organizationId, org)),
  ]);
  if (!school || !student || !term || !year) notFound();
  return <main className="mx-auto max-w-3xl bg-white p-6 text-slate-900 print:max-w-none print:p-0">
    <div className="mb-8 flex items-center justify-between gap-4 print:hidden"><Link href="/?section=reports" className="text-sm font-semibold text-blue-700">← Back to report cards</Link><PrintReportButton /></div>
    <header className="border-b-2 border-slate-900 pb-6"><p className="text-xs font-bold uppercase tracking-[.2em]">{school.name}</p><h1 className="mt-3 text-3xl font-bold">Student report card</h1><p className="mt-2 text-sm text-slate-600">{year.name} · {term.name} · Version {card.version}</p></header>
    <dl className="mt-8 grid grid-cols-2 gap-5 text-sm"><div><dt className="text-slate-500">Student</dt><dd className="font-semibold">{student.firstName} {student.lastName}</dd></div><div><dt className="text-slate-500">Student number</dt><dd className="font-semibold">{student.studentNumber}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="font-semibold capitalize">{card.status}</dd></div><div><dt className="text-slate-500">Published</dt><dd className="font-semibold">{card.publishedAt?.toLocaleDateString("en-GB") ?? "Not published"}</dd></div></dl>
    <table className="mt-8 w-full border-collapse text-left text-sm"><caption className="mb-3 text-left text-lg font-bold">Subject results</caption><thead><tr className="border-b border-slate-900"><th className="py-2">Subject</th><th className="py-2 text-right">Score</th><th className="py-2 text-right">Grade</th></tr></thead><tbody>{results.map(result => <tr key={result.id} className="border-b border-slate-200"><td className="py-3">{subjectRows.find(subject => subject.id === result.subjectId)?.name ?? "Subject"}</td><td className="py-3 text-right">{result.scorePercentage}%</td><td className="py-3 text-right">{result.letterGrade}</td></tr>)}</tbody></table>
    <dl className="mt-8 grid grid-cols-2 gap-5 border-t border-slate-300 pt-5 text-sm"><div><dt className="text-slate-500">Overall score</dt><dd className="text-xl font-bold">{card.overallPercentage ?? "—"}%</dd></div><div><dt className="text-slate-500">GPA</dt><dd className="text-xl font-bold">{card.gpa ?? "—"}</dd></div><div><dt className="text-slate-500">Attendance rate</dt><dd className="font-semibold">{card.attendanceRate ?? "—"}%</dd></div><div><dt className="text-slate-500">Attendance</dt><dd className="font-semibold">{card.daysPresent} present · {card.daysAbsent} absent · {card.daysLate} late</dd></div></dl>
    {(card.teacherRemarks || card.principalRemarks) && <section className="mt-8 border-t border-slate-300 pt-5 text-sm"><h2 className="font-bold">Remarks</h2>{card.teacherRemarks && <p className="mt-2 whitespace-pre-wrap">{card.teacherRemarks}</p>}{card.principalRemarks && <p className="mt-2 whitespace-pre-wrap">{card.principalRemarks}</p>}</section>}
    <footer className="mt-12 border-t border-slate-300 pt-3 text-xs text-slate-500">Generated from the school records. Draft and approved copies are for internal review.</footer>
  </main>;
}
