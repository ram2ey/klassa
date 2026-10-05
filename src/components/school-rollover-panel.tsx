"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveSchoolRolloverAction, previewSchoolRolloverAction } from "@/app/actions/school-rollover-actions";
import type { SchoolAdminData } from "@/lib/school-admin-data";

type Preview = Extract<Awaited<ReturnType<typeof previewSchoolRolloverAction>>, { success: true }>["preview"];
type Choice = { outcome: "move" | "graduate" | "withdraw"; classId: string };

export function SchoolRolloverPanel({ data }: { data: SchoolAdminData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [targetYearId, setTargetYearId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [choices, setChoices] = useState<Record<string, Choice>>({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const source = data.years.find(year => year.isCurrent);
  const targets = data.years.filter(year => source && year.id !== source.id && year.startsOn > source.endsOn);
  function loadPreview() {
    setError(""); setMessage("");
    start(async () => {
      const result = await previewSchoolRolloverAction(targetYearId);
      if (!result.success) { setPreview(null); setError(result.error); return; }
      setPreview(result.preview);
      setChoices(Object.fromEntries(result.preview.proposals.map(student => [student.studentId,
        student.suggestedClassId ? { outcome: "move", classId: student.suggestedClassId } :
          { outcome: student.terminalGrade ? "graduate" : "move", classId: "" }])));
    });
  }
  function approve() {
    if (!preview) return;
    setError(""); setMessage("");
    const placements = preview.proposals.map(student => {
      const choice = choices[student.studentId];
      return choice.outcome === "move" ? { studentId: student.studentId, outcome: "move" as const, classId: choice.classId } :
        { studentId: student.studentId, outcome: choice.outcome };
    });
    if (placements.some(item => item.outcome === "move" && !item.classId)) { setError("Choose a destination class for every moving student."); return; }
    if (!window.confirm(`Approve rollover of ${preview.proposals.length} students into ${preview.target.name}?`)) return;
    start(async () => {
      const result = await approveSchoolRolloverAction({ sourceYearId: preview.source.id, targetYearId: preview.target.id, placements });
      if (!result.success) { setError(result.error); return; }
      setMessage(result.alreadyApplied ? "This rollover was already applied." : `Rollover approved. ${result.moved} students moved.`);
      setPreview(null); router.refresh();
    });
  }
  return <section className="border border-line bg-surface">
    <div className="border-b border-line p-5"><h2 className="font-bold">Academic year rollover</h2><p className="mt-1 text-sm text-secondary">Close all current-year terms, review every placement, then approve once.</p></div>
    <div className="space-y-4 p-5">
      <div className="flex flex-wrap items-end gap-3"><label className="text-sm font-medium">Next academic year<select className="mt-1 block min-h-11 min-w-48 border border-line p-2" value={targetYearId} onChange={event => { setTargetYearId(event.target.value); setPreview(null); }}><option value="">Choose a year</option>{targets.map(year => <option key={year.id} value={year.id}>{year.name}</option>)}</select></label><button type="button" className="min-h-11 border border-primary px-4 font-semibold text-primary-hover disabled:opacity-50" disabled={pending || !targetYearId} onClick={loadPreview}>Preview placements</button></div>
      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{message && <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {preview && <><p className="text-sm">{preview.proposals.length} active students. {preview.allTermsLocked ? "All source terms are closed." : "Close all source terms before approval."}</p>
        <div className="max-h-96 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Student</th><th className="p-2">Current class</th><th className="p-2">Decision</th><th className="p-2">Destination class</th></tr></thead><tbody>{preview.proposals.map(student => { const choice = choices[student.studentId]; return <tr key={student.studentId} className="border-t border-line-subtle"><td className="p-2">{student.studentName} · {student.studentNumber}</td><td className="p-2">{student.sourceClassName}</td><td className="p-2"><select aria-label={`Decision for ${student.studentName}`} className="min-h-11 border border-line p-2" value={choice?.outcome ?? "move"} onChange={event => setChoices(current => ({ ...current, [student.studentId]: { outcome: event.target.value as Choice["outcome"], classId: current[student.studentId]?.classId ?? "" } }))}><option value="move">Move or repeat</option><option value="graduate">Graduate</option><option value="withdraw">Leave school</option></select></td><td className="p-2"><select aria-label={`Class for ${student.studentName}`} className="min-h-11 border border-line p-2" disabled={choice?.outcome !== "move"} value={choice?.classId ?? ""} onChange={event => setChoices(current => ({ ...current, [student.studentId]: { outcome: "move", classId: event.target.value } }))}><option value="">Choose class</option>{preview.targetClasses.map(klass => <option key={klass.id} value={klass.id}>{klass.gradeName} / {klass.name}</option>)}</select></td></tr>; })}</tbody></table></div>
        <button type="button" className="min-h-11 bg-primary px-4 font-semibold text-white disabled:opacity-50" disabled={pending || !preview.allTermsLocked} onClick={approve}>Approve rollover</button></>}
    </div>
  </section>;
}
