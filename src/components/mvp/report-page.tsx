import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { db } from "@/db";
import { academicYears, classes, organizations, reportCards, reportCardSubjectGrades, students, subjects, teacherClassAssignments, terms } from "@/db/schema";
import { requireStaff } from "@/lib/action-access";
import { PrintReportButton } from "@/components/print-report-button";
import { formatGMTDate } from "@/lib/timezone";

export default async function ReportCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const actor = await requireStaff(["school_admin", "office_staff", "teacher"]);
  const org = actor.organizationId;
  const [card] = await db.select().from(reportCards).where(and(eq(reportCards.id, id), eq(reportCards.organizationId, org)));
  if (!card || card.organizationId !== org || (actor.role === "office_staff" && card.status !== "published")) notFound();
  const [school, pupil, term, year, klass, results, subjectRows] = await Promise.all([
    db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, org)).then(r => r[0]),
    db.select({ firstName: students.firstName, lastName: students.lastName, studentNumber: students.studentNumber }).from(students).where(and(eq(students.id, card.studentId), eq(students.organizationId, org))).then(r => r[0]),
    db.select().from(terms).where(and(eq(terms.id, card.termId), eq(terms.organizationId, org))).then(r => r[0]),
    db.select().from(academicYears).where(and(eq(academicYears.id, card.academicYearId), eq(academicYears.organizationId, org))).then(r => r[0]),
    db.select().from(classes).where(and(eq(classes.id, card.classId), eq(classes.organizationId, org))).then(r => r[0]),
    db.select().from(reportCardSubjectGrades).where(and(eq(reportCardSubjectGrades.organizationId, org), eq(reportCardSubjectGrades.reportCardId, card.id))),
    db.select({ id: subjects.id, name: subjects.name }).from(subjects).where(eq(subjects.organizationId, org)),
  ]);
  if (!school || !pupil || !term || !year || !klass) notFound();
  if (actor.role === "teacher" && klass.homeroomTeacherId !== actor.userId) {
    const assignments = await db.select({ id: teacherClassAssignments.id }).from(teacherClassAssignments).where(and(eq(teacherClassAssignments.organizationId, org), eq(teacherClassAssignments.classId, klass.id), eq(teacherClassAssignments.teacherId, actor.userId), eq(teacherClassAssignments.isPrimaryHomeroom, true)));
    if (!assignments.length) notFound();
  }
  return <main className="mx-auto max-w-4xl space-y-6 bg-surface p-8 text-ink print:max-w-none print:p-0">
    <div className="flex items-center justify-between print:hidden"><Link href="/?section=marks&tab=reports" className="text-primary underline">Back to reports</Link><PrintReportButton /></div>
    <header className="border-b-2 border-ink pb-5"><p className="font-semibold">{school.name}</p><h1 className="mt-2 text-3xl font-bold">Pupil term report</h1><p className="mt-2 text-sm text-secondary">{year.name} · {term.name} · Version {card.version}{card.status !== "published" ? " · DRAFT — for review" : ""}</p></header>
    <dl className="grid gap-4 text-sm sm:grid-cols-2">{[["Pupil", `${pupil.firstName} ${pupil.lastName}`], ["Pupil number", pupil.studentNumber], ["Class", klass.name], ["Published", card.publishedAt ? formatGMTDate(card.publishedAt) : "Not yet published"]].map(([label, value]) => <div key={label}><dt className="text-secondary">{label}</dt><dd className="mt-1 font-semibold">{value}</dd></div>)}</dl>
    <div className="overflow-x-auto"><table className="w-full border-collapse text-left text-sm"><caption className="mb-3 text-left font-bold">Subject results</caption><thead><tr className="border-b border-ink">{["Subject", "Classwork /100", "Exam /100", "Weighting", "Total /100", "Remark"].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead><tbody>{results.map(r => <tr key={r.id} className="border-b border-line"><td className="p-2">{r.subjectName ?? subjectRows.find(s => s.id === r.subjectId)?.name ?? "Subject"}</td><td className="p-2">{r.classworkScore ?? "—"}</td><td className="p-2">{r.examScore ?? "—"}</td><td className="p-2">{r.classworkWeight !== null ? `${r.classworkWeight}% / ${100 - r.classworkWeight}%` : "—"}</td><td className="p-2 font-semibold">{r.scorePercentage}</td><td className="p-2">{r.comments || "—"}</td></tr>)}</tbody></table></div>
    <section className="border-t border-line pt-4"><h2 className="font-bold">Attendance recorded this term</h2><p className="mt-2 text-sm">{card.daysPresent} present · {card.daysAbsent} absent · {card.daysLate} late · {card.daysExcused} excused</p></section>
    {(card.teacherRemarks || card.principalRemarks) && <section className="border-t border-line pt-4"><h2 className="font-bold">Remarks</h2>{card.teacherRemarks && <p className="mt-2 whitespace-pre-wrap text-sm">{card.teacherRemarks}</p>}{card.principalRemarks && <p className="mt-2 whitespace-pre-wrap text-sm">{card.principalRemarks}</p>}</section>}
    <footer className="border-t border-line pt-4 text-xs text-secondary">{card.status === "published" ? "Published school report. Results are preserved as issued." : "Draft report for staff review."}</footer>
  </main>;
}
