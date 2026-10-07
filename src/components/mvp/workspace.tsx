"use client";

import Link from "next/link";
import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Banknote, CalendarCheck, GraduationCap, LayoutDashboard, NotebookPen, Settings } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { Button } from "@/components/ui/button";
import { saveMvpAction } from "@/app/actions/mvp-actions";
import type { MvpData } from "@/lib/mvp-data";
import { formatCedis, parsePesewas, termTotal, type MvpInput } from "@/lib/mvp-policy";

export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return <section className="ui-card overflow-hidden"><h2 className="border-b border-line-subtle px-5 py-4 text-base font-semibold">{title}</h2><div className="space-y-4 p-5">{children}</div></section>;
}
export function Field({ label, name, type = "text", required = true, value, min, max, step }: { label: string; name: string; type?: string; required?: boolean; value?: string; min?: number; max?: number; step?: string }) {
  return <label className="block text-sm font-medium">{label}<input className="ui-field mt-1 w-full" name={name} type={type} defaultValue={value} required={required} min={min} max={max} step={step} /></label>;
}
export function Choice({ label, name, items, value, onChange }: { label: string; name: string; items: { id: string; name: string }[]; value?: string; onChange?: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<select aria-label={label} className="ui-field mt-1 w-full" name={name} required value={onChange ? value : undefined} defaultValue={onChange ? undefined : value ?? ""} onChange={onChange ? e => onChange(e.target.value) : undefined}>
    {!onChange && <option value="">Choose {label.toLowerCase()}</option>}{items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select></label>;
}
export function Table({ caption, headers, children }: { caption: string; headers: string[]; children: ReactNode }) {
  return <div className="overflow-x-auto"><table className="w-full min-w-[560px] text-left text-sm"><caption className="sr-only">{caption}</caption><thead><tr className="border-b border-line">{headers.map(h => <th key={h} scope="col" className="px-3 py-3 font-semibold">{h}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}
export function useMvpSave() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const request = useRef<{ payload: string; id: string } | null>(null);
  function run(input: MvpInput, onSaved?: (result: { entityId: string; ids?: string[] }) => void) {
    const payload = JSON.stringify(input);
    if (request.current?.payload !== payload) request.current = { payload, id: crypto.randomUUID() };
    const requestId = request.current.id;
    setError(""); setMessage("");
    start(async () => {
      try {
        const result = await saveMvpAction({ ...input, requestId });
        if (!result.success) { setError(result.error); return; }
        request.current = null;
        setMessage(result.message);
        onSaved?.(result);
      } catch { setError("The change could not be saved. Retry with the same details."); }
    });
  }
  return { pending, run, setError, feedback: <>{error && <p role="alert" className="rounded-control border border-danger bg-danger-subtle p-3 text-sm">{error}</p>}{message && <p role="status" className="rounded-control border border-line bg-surface-subtle p-3 text-sm">{message}</p>}</> };
}
const name = (p: MvpData["pupils"][number]) => `${p.firstName} ${p.lastName}`;
const today = () => new Date().toISOString().slice(0, 10);
const text = (f: FormData, key: string) => String(f.get(key) ?? "");

export function MvpWorkspace({ data, section, tab, date, children }: { data: MvpData; section: string; tab: string; date: string; children?: ReactNode }) {
  const admin = data.actor.role === "school_admin";
  const teacher = data.actor.role === "teacher";
  const items = [
    { id: "overview", label: "Home", icon: LayoutDashboard },
    { id: "students", label: teacher ? "My classes" : "Pupils", icon: GraduationCap },
    { id: "attendance", label: "Attendance", icon: CalendarCheck },
    ...((admin || teacher) ? [{ id: "marks", label: "Marks & Reports", icon: NotebookPen }] : []),
    ...(!teacher ? [{ id: "fees", label: "Fees", icon: Banknote }] : []),
    ...(admin ? [{ id: "settings", label: "Settings", icon: Settings }] : []),
  ];
  const links = section === "students" && !teacher ? [{ id: "pupils", label: "Pupils" }, { id: "contacts", label: "Guardian contacts" }]
    : section === "settings" ? [{ id: "school", label: "School" }, { id: "staff", label: "Staff" }, { id: "classes", label: "Classes & grades" }, { id: "subjects", label: "Subjects" }, { id: "academic", label: "Years & terms" }, { id: "audit", label: "Audit history" }]
    : section === "marks" ? [{ id: "marks", label: "Term marks" }, { id: "reports", label: "Reports" }] : [];
  return <WorkspaceShell schoolName={data.school.name} academicYear={data.currentYear?.name ?? "Set up the academic year"} actorName={data.actor.name}
    roleLabel={admin ? "Administrator" : teacher ? "Teacher" : "Office staff"} navigationLabel="School navigation" activeId={section} contentId="mvp-content"
    groups={[{ label: "School", items: items.map(i => ({ id: i.id, label: i.label, href: `/?section=${i.id}`, icon: <i.icon size={20} /> })) }]}>
    <div className="space-y-5"><div><p className="text-xs font-medium text-secondary">{data.school.name}</p><h1 className="mt-1 text-2xl font-bold">{items.find(i => i.id === section)?.label ?? "Home"}</h1></div>
      {links.length > 0 && <nav aria-label={`${section} views`} className="flex gap-2 overflow-x-auto border-b border-line-subtle">{links.map(l => <Link key={l.id} href={`/?section=${section}&tab=${l.id}`} aria-current={tab === l.id || (!tab && l === links[0]) ? "page" : undefined} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-medium ${tab === l.id || (!tab && l === links[0]) ? "border-primary text-primary" : "border-transparent text-secondary"}`}>{l.label}</Link>)}</nav>}
      {section === "overview" && <Home data={data} date={date} />}
      {section === "students" && teacher && <Panel title="Assigned class rosters"><Table caption="My pupils" headers={["Pupil", "Number", "Class", "Release / access flags"]}>{data.pupils.map(p => <tr key={p.id} className="border-b border-line-subtle"><td className="p-3">{name(p)}</td><td className="p-3">{p.studentNumber}</td><td className="p-3">{data.classes.find(c => c.id === p.classId)?.name}</td><td className="p-3">{data.restrictions.some(r => r.studentId === p.id) ? "Check restrictions with the office" : "—"}</td></tr>)}</Table>{!data.pupils.length && <p className="text-sm text-secondary">Your administrator will assign your classes here.</p>}</Panel>}
      {section === "attendance" && <Attendance key={date} data={data} date={date} />}
      {section === "marks" && (tab === "reports" ? <Reports data={data} /> : <Marks data={data} />)}
      {section === "fees" && <Fees data={data} />}
      {children}
      {section === "settings" && ["classes", "academic"].includes(tab) && <AcademicSettings data={data} tab={tab} />}
    </div>
  </WorkspaceShell>;
}

function Home({ data, date }: { data: MvpData; date: string }) {
  const teacher = data.actor.role === "teacher";
  const active = data.pupils.filter(p => p.status === "active");
  const attendanceClasses = data.classes.filter(c => data.homeroomIds.includes(c.id) && active.some(p => p.classId === c.id));
  const missing = attendanceClasses.filter(c => !data.sessions.some(s => s.classId === c.id && s.status !== "in_progress")).length;
  const term = data.terms.find(t => t.startsOn <= date && t.endsOn >= date) ?? data.terms.find(t => !t.isLocked);
  const toPublish = term ? active.filter(p => {
    const offered = data.classSubjects.filter(c => c.classId === p.classId);
    const marks = data.marks.filter(m => m.studentId === p.id && m.termId === term.id);
    const complete = offered.length > 0 && offered.every(s => marks.some(m => m.subjectId === s.subjectId && m.classworkScore !== null && m.examScore !== null));
    const latest = data.reports.find(r => r.studentId === p.id && r.termId === term.id);
    return complete && (!latest || latest.status !== "published" || marks.some(m => latest.publishedAt && new Date(m.updatedAt) > new Date(latest.publishedAt)));
  }).length : 0;
  const tiles = [{ label: "Active pupils", value: String(active.length), section: "students" }, { label: "Registers to submit", value: String(missing), section: "attendance" },
    ...(data.actor.role !== "office_staff" ? [{ label: "Reports to publish", value: String(toPublish), section: "marks&tab=reports" }] : []),
    ...(!teacher ? [{ label: "Fees outstanding", value: formatCedis(data.balances.reduce((sum, b) => sum + Math.max(0, b.amountPesewas), 0)), section: "fees" }] : [])];
  return <><p className="text-sm text-secondary">Daily registers for {date}{term ? ` · ${term.name}` : ""}</p><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{tiles.map(t => <Link key={t.label} href={`/?section=${t.section}`} className="ui-card p-5 hover:border-primary"><p className="text-sm text-secondary">{t.label}</p><p className="mt-3 text-2xl font-bold">{t.value}</p></Link>)}</div>
    {data.actor.role === "school_admin" && <Panel title="School setup"><ol className="grid gap-3 text-sm sm:grid-cols-2">{[
      [!!data.currentYear, "Set the academic year and terms", "academic"], [data.classes.length > 0, "Add grades and classes", "classes"],
      [data.classSubjects.length > 0, "Choose class subjects and teachers", "classes"], [active.length > 0, "Enrol or import pupils and contacts", "pupils"],
    ].map(([done, label, target]) => <li key={String(label)}><Link className="underline decoration-line underline-offset-4" href={target === "pupils" ? "/?section=students" : `/?section=settings&tab=${target}`}>{done ? "✓" : "○"} {label}</Link></li>)}</ol></Panel>}
  </>;
}

function Attendance({ data, date }: { data: MvpData; date: string }) {
  const router = useRouter();
  const save = useMvpSave();
  const choices = data.classes.filter(c => data.actor.role !== "teacher" || data.homeroomIds.includes(c.id));
  const [classId, setClassId] = useState(choices[0]?.id ?? "");
  const session = data.sessions.find(s => s.classId === classId);
  const roster = data.pupils.filter(p => p.classId === classId && p.status === "active");
  if (!choices.length) return <Panel title="Daily register"><p>No classes are available for daily attendance. Your administrator must assign a class teacher.</p></Panel>;
  return <Panel title="Daily register"><div className="grid gap-4 sm:grid-cols-2"><Choice label="Class" name="attendanceClass" items={choices} value={classId} onChange={setClassId} /><form onSubmit={e => { e.preventDefault(); router.push(`/?section=attendance&date=${text(new FormData(e.currentTarget), "date")}`); }} className="flex items-end gap-2"><Field label="Date" name="date" type="date" value={date} /><Button type="submit" variant="secondary">Load date</Button></form></div>
    <p className="text-sm text-secondary">{session ? session.status === "submitted" ? "Submitted — changes require a reason." : session.status === "locked" ? "Locked" : "Draft" : "Not yet recorded"}</p>
    {save.feedback}<form key={`${classId}:${session?.id ?? "new"}:${date}`} onSubmit={e => {
      e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null);
      save.run({ kind: "attendance", classId, date, submit: text(f, "intent") === "submit", rows: roster.map(p => ({ studentId: p.id, status: text(f, p.id) as "present" | "absent" | "late" | "excused" })), correctionReason: text(f, "correctionReason") });
    }} className="space-y-4"><Table caption="Daily attendance" headers={["Pupil", "Number", "Attendance"]}>{roster.map(p => <tr key={p.id} className="border-b border-line-subtle"><td className="p-3">{name(p)}</td><td className="p-3">{p.studentNumber}</td><td className="p-3"><select aria-label={`Attendance for ${name(p)}`} name={p.id} required defaultValue={data.records.find(r => r.studentId === p.id && r.sessionId === session?.id)?.status ?? ""} className="ui-field"><option value="">Choose status</option>{["present", "absent", "late", "excused"].map(s => <option key={s} value={s}>{s[0].toUpperCase() + s.slice(1)}</option>)}</select></td></tr>)}</Table>
      {session?.status === "submitted" && <Field label="Correction reason" name="correctionReason" />}
      <div className="flex flex-wrap gap-3"><Button type="submit" name="intent" value="submit" disabled={save.pending || !roster.length || session?.status === "locked"}>{session?.status === "submitted" ? "Save corrections" : "Submit daily register"}</Button>{data.actor.role !== "office_staff" && session?.status !== "submitted" && <Button type="submit" name="intent" value="draft" variant="secondary" disabled={save.pending || !roster.length || session?.status === "locked"}>Save draft</Button>}</div>
      {!roster.length && <p className="text-sm text-secondary">Enrol active pupils in this class first.</p>}
    </form></Panel>;
}

function Marks({ data }: { data: MvpData }) {
  const save = useMvpSave();
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [termId, setTermId] = useState(data.terms.find(t => !t.isLocked)?.id ?? data.terms[0]?.id ?? "");
  const offered = data.subjects.filter(s => data.classSubjects.some(c => c.classId === classId && c.subjectId === s.id));
  const [chosenSubject, setSubject] = useState("");
  const subjectId = offered.some(s => s.id === chosenSubject) ? chosenSubject : offered[0]?.id ?? "";
  const term = data.terms.find(t => t.id === termId);
  const roster = data.pupils.filter(p => p.classId === classId && p.status === "active");
  const [edits, setEdits] = useState<Record<string, { classwork: string; exam: string; remark: string }>>({});
  const key = (id: string) => `${classId}:${termId}:${subjectId}:${id}`;
  const values = (id: string) => { const m = data.marks.find(m => m.studentId === id && m.termId === termId && m.subjectId === subjectId); return edits[key(id)] ?? { classwork: m?.classworkScore ?? "", exam: m?.examScore ?? "", remark: m?.remark ?? "" }; };
  if (!data.classes.length || !data.terms.length) return <Panel title="Term marks"><p>Add classes and terms, then assign teachers in Settings.</p></Panel>;
  return <Panel title="Term marks"><div className="grid gap-4 sm:grid-cols-3"><Choice label="Class" name="marksClass" items={data.classes} value={classId} onChange={setClassId} /><Choice label="Term" name="marksTerm" items={data.terms} value={termId} onChange={setTermId} /><Choice label="Subject" name="marksSubject" items={offered} value={subjectId} onChange={setSubject} /></div>
    <p className="text-sm text-secondary">Enter both scores out of 100. Classwork {term?.classworkWeight ?? 40}% · Exam {100 - (term?.classworkWeight ?? 40)}%. A blank score is unfinished; zero is a valid mark.</p>{save.feedback}
    <form key={`${classId}:${termId}:${subjectId}`} className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null); save.run({ kind: "marks", classId, termId, subjectId,
      rows: roster.map(p => { const v = values(p.id); return { studentId: p.id, classworkScore: v.classwork === "" ? null : Number(v.classwork), examScore: v.exam === "" ? null : Number(v.exam), remark: v.remark }; }), correctionReason: text(f, "correctionReason") }, () => setEdits({})); }}>
      <Table caption="Term marks sheet" headers={["Pupil", "Classwork /100", "Exam /100", "Total", "Remark"]}>{roster.map(p => { const v = values(p.id); return <tr key={p.id} className="border-b border-line-subtle"><td className="p-3">{name(p)}</td>{(["classwork", "exam"] as const).map(field => <td key={field} className="p-3"><input aria-label={`${field === "classwork" ? "Classwork" : "Exam"} for ${name(p)}`} className="ui-field w-24" type="number" min="0" max="100" step="0.01" value={v[field]} onChange={e => setEdits({ ...edits, [key(p.id)]: { ...v, [field]: e.target.value } })} /></td>)}<td className="p-3 font-semibold">{termTotal(v.classwork === "" ? null : Number(v.classwork), v.exam === "" ? null : Number(v.exam), term?.classworkWeight ?? 40) ?? "—"}</td><td className="p-3"><input aria-label={`Remark for ${name(p)}`} maxLength={500} className="ui-field w-52" value={v.remark} onChange={e => setEdits({ ...edits, [key(p.id)]: { ...v, remark: e.target.value } })} /></td></tr>; })}</Table>
      <Field label="Correction reason (required after report publication)" name="correctionReason" required={false} />
      <Button type="submit" disabled={save.pending || !subjectId || !roster.length || term?.isLocked}>Save term marks</Button>
      {!offered.length && <p className="text-sm text-secondary">Choose the subjects for this class in Settings, or ask your administrator to assign your subject.</p>}
      {term?.isLocked && <p className="text-sm text-secondary">This term is closed and locked.</p>}
    </form></Panel>;
}

function Reports({ data }: { data: MvpData }) {
  const save = useMvpSave();
  const choices = data.classes.filter(c => data.homeroomIds.includes(c.id));
  const [classId, setClassId] = useState(choices[0]?.id ?? "");
  const [termId, setTermId] = useState(data.terms.find(t => !t.isLocked)?.id ?? data.terms[0]?.id ?? "");
  const [selected, setSelected] = useState<string[]>([]);
  const roster = data.pupils.filter(p => p.classId === classId && p.status === "active");
  const offered = data.classSubjects.filter(s => s.classId === classId);
  const complete = (id: string) => offered.length > 0 && offered.every(s => data.marks.some(m => m.studentId === id && m.termId === termId && m.subjectId === s.subjectId && m.classworkScore !== null && m.examScore !== null));
  if (!choices.length || !data.terms.length) return <Panel title="Term reports"><p>Class teachers prepare reports. An administrator publishes them once marks are complete.</p></Panel>;
  return <Panel title="Term reports"><div className="grid gap-4 sm:grid-cols-2"><Choice label="Class" name="reportsClass" items={choices} value={classId} onChange={id => { setClassId(id); setSelected([]); }} /><Choice label="Term" name="reportsTerm" items={data.terms} value={termId} onChange={id => { setTermId(id); setSelected([]); }} /></div>{save.feedback}
    <form className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null); save.run({ kind: "reports", classId, termId, studentIds: selected, publish: text(f, "intent") === "publish", teacherRemarks: text(f, "teacherRemarks"), principalRemarks: text(f, "principalRemarks") }); }}>
      <Button type="button" variant="secondary" onClick={() => setSelected(roster.filter(p => complete(p.id)).map(p => p.id))}>Select pupils with complete marks</Button>
      <Table caption="Report publication" headers={["Select", "Pupil", "Marks", "Latest report"]}>{roster.map(p => { const card = data.reports.find(r => r.studentId === p.id && r.termId === termId); return <tr key={p.id} className="border-b border-line-subtle"><td className="p-3"><input type="checkbox" aria-label={`Select report for ${name(p)}`} checked={selected.includes(p.id)} disabled={!complete(p.id)} onChange={e => setSelected(e.target.checked ? [...selected, p.id] : selected.filter(id => id !== p.id))} /></td><td className="p-3">{name(p)}</td><td className="p-3">{complete(p.id) ? "Complete" : "Missing scores"}</td><td className="p-3">{card ? <Link className="text-primary underline" href={`/reports/${card.id}`} target="_blank">{card.status} · Version {card.version} · View / print</Link> : "Not prepared"}</td></tr>; })}</Table>
      <Field label="Teacher remarks for selected reports (optional)" name="teacherRemarks" required={false} />{data.actor.role === "school_admin" && <Field label="Administrator remarks for selected reports (optional)" name="principalRemarks" required={false} />}
      <div className="flex flex-wrap gap-3"><Button type="submit" name="intent" value="draft" variant="secondary" disabled={save.pending || !selected.length || data.terms.find(t => t.id === termId)?.isLocked}>Prepare report previews</Button>{data.actor.role === "school_admin" && <Button type="submit" name="intent" value="publish" disabled={save.pending || !selected.length || data.terms.find(t => t.id === termId)?.isLocked}>Publish {selected.length || "selected"} reports</Button>}</div>
      <p className="text-sm text-secondary">Preview before publishing. Corrections create a new report version; issued reports keep their original results.</p>
    </form></Panel>;
}

function AcademicSettings({ data, tab }: { data: MvpData; tab: string }) {
  const save = useMvpSave();
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  return <Panel title={tab === "classes" ? "Subjects offered by each class" : "Term weighting"}>{save.feedback}{tab === "classes" ? <form key={classId} className="space-y-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null); save.run({ kind: "class_subjects", classId, subjectIds: f.getAll("subjects").map(String) }); }}>
    <Choice label="Class" name="classId" items={data.classes} value={classId} onChange={setClassId} /><fieldset><legend className="mb-3 text-sm font-medium">Subjects required on reports</legend><div className="grid gap-3 sm:grid-cols-3">{data.subjects.map(s => <label key={s.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="subjects" value={s.id} defaultChecked={data.classSubjects.some(c => c.classId === classId && c.subjectId === s.id)} />{s.name}</label>)}</div></fieldset><p className="text-sm text-secondary">Choose subjects before entering marks. Subject teacher permissions are assigned in the class settings above.</p><Button type="submit" disabled={save.pending || !classId || !data.subjects.length}>Save class subjects</Button>
  </form> : <form className="grid gap-4 sm:grid-cols-3" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null); save.run({ kind: "term_weights", termId: text(f, "termId"), classworkWeight: Number(text(f, "weight")) }); }}><Choice label="Term" name="termId" items={data.terms.map(t => ({ id: t.id, name: `${t.name}: ${t.classworkWeight}% classwork / ${100 - t.classworkWeight}% exam` }))} /><Field label="Classwork weight (%)" name="weight" type="number" value="40" min={1} max={99} step="1" /><div className="self-end"><Button type="submit" disabled={save.pending}>Save weighting</Button></div><p className="text-sm text-secondary sm:col-span-3">Exam weight is the remainder to 100%. Weights are fixed after the first marks are saved.</p></form>}</Panel>;
}

function Fees({ data }: { data: MvpData }) {
  const save = useMvpSave();
  const admin = data.actor.role === "school_admin";
  const [query, setQuery] = useState("");
  const pupils = data.pupils.filter(p => `${name(p)} ${p.studentNumber}`.toLowerCase().includes(query.toLowerCase()));
  const [studentId, setStudentId] = useState(data.pupils[0]?.id ?? "");
  const [definitionId, setDefinitionId] = useState("");
  const [reviewed, setReviewed] = useState<string[]>([]);
  const definition = data.definitions.find(d => d.id === definitionId);
  const eligible = definition ? data.pupils.filter(p => p.status === "active" && p.classId === definition.classId && !data.entries.some(e => e.studentId === p.id && e.definitionId === definition.id)) : [];
  const selectedPupil = data.pupils.find(p => p.id === studentId);
  const payments = data.payments.filter(p => p.studentId === studentId);
  const [receipt, setReceipt] = useState("");
  const [voidId, setVoidId] = useState("");
  function money(input: MvpInput) { save.run(input); }
  function withAmount(f: FormData, action: (n: number) => void) { try { action(parsePesewas(text(f, "amount"))); } catch (e) { save.setError(e instanceof Error ? e.message : "Check the amount."); } }
  return <div className="space-y-5">{save.feedback}{receipt && <p><Link href={`/fees/receipts/${receipt}`} target="_blank" className="font-semibold text-primary underline">View / print the payment receipt</Link></p>}
    <Panel title="Pupil fee accounts"><label className="block text-sm font-medium">Search pupils<input className="ui-field mt-1 w-full sm:max-w-md" value={query} onChange={e => setQuery(e.target.value)} placeholder="Name or pupil number" /></label>
      <p><Link href="/fees/export" className="text-sm font-semibold text-primary underline">Download balances CSV</Link></p>
      <Table caption="Pupil balances" headers={["Pupil", "Number", "Balance", "Account"]}>{pupils.map(p => { const amount = data.balances.find(b => b.studentId === p.id)?.amountPesewas ?? 0; return <tr key={p.id} className="border-b border-line-subtle"><td className="p-3">{name(p)}</td><td className="p-3">{p.studentNumber}</td><td className="p-3 font-semibold">{amount < 0 ? `${formatCedis(-amount)} credit` : formatCedis(amount)}</td><td className="p-3"><Button type="button" variant="secondary" onClick={() => { setStudentId(p.id); document.getElementById("pupil-payment")?.scrollIntoView({ behavior: "smooth" }); }}>Open account</Button> <Link href={`/fees/students/${p.id}`} target="_blank" className="text-primary underline">Statement</Link></td></tr>; })}</Table>
    </Panel>
    <div id="pupil-payment"><Panel title="Record a payment"><Choice label="Pupil account" name="paymentPupil" items={data.pupils.map(p => ({ id: p.id, name: `${name(p)} · ${p.studentNumber}` }))} value={studentId} onChange={setStudentId} />
      <p className="text-sm text-secondary">{selectedPupil ? name(selectedPupil) : "Choose a pupil"} · Balance {formatCedis(data.balances.find(b => b.studentId === studentId)?.amountPesewas ?? 0)}</p>
      <form key={studentId} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); withAmount(f, amountPesewas => save.run({ kind: "payment", studentId, amountPesewas, date: text(f, "date"), method: text(f, "method") as "cash" | "mobile_money" | "bank", reference: text(f, "reference") }, r => { setReceipt(r.entityId); form.reset(); })); }}>
        <Field label="Amount received (GH₵)" name="amount" type="number" min={0.01} step="0.01" /><Field label="Payment date" name="date" type="date" value={today()} /><Choice label="Payment method" name="method" items={[{ id: "cash", name: "Cash" }, { id: "mobile_money", name: "Mobile money" }, { id: "bank", name: "Bank" }]} /><Field label="Reference (optional)" name="reference" required={false} /><Button type="submit" disabled={save.pending || !studentId}>Record payment</Button>
      </form>
      <Table caption="Pupil payments" headers={["Receipt", "Date", "Amount", "Status", "Actions"]}>{payments.map(p => <tr key={p.id} className="border-b border-line-subtle"><td className="p-3"><Link href={`/fees/receipts/${p.id}`} target="_blank" className="text-primary underline">{p.receiptNumber}</Link></td><td className="p-3">{p.paymentDate}</td><td className="p-3">{formatCedis(p.amountPesewas)}</td><td className="p-3">{p.voidedAt ? "Void" : "Recorded"}</td><td className="p-3">{admin && !p.voidedAt && <Button type="button" variant="secondary" onClick={() => setVoidId(p.id)}>Void payment</Button>}</td></tr>)}</Table>
      {voidId && <form className="flex flex-wrap items-end gap-3" onSubmit={e => { e.preventDefault(); save.run({ kind: "payment_void", paymentId: voidId, reason: text(new FormData(e.currentTarget), "reason") }, () => setVoidId("")); }}><Field label={`Reason to void ${data.payments.find(p => p.id === voidId)?.receiptNumber}`} name="reason" /><Button type="submit" disabled={save.pending}>Confirm void</Button><Button type="button" variant="secondary" onClick={() => setVoidId("")}>Cancel</Button></form>}
    </Panel></div>
    {admin && <><Panel title="Class fees"><form className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null); withAmount(f, amountPesewas => money({ kind: "fee_definition", classId: text(f, "classId"), termId: text(f, "termId"), name: text(f, "name"), amountPesewas })); }}><Choice label="Fee class" name="classId" items={data.classes} /><Choice label="Fee term" name="termId" items={data.terms} /><Field label="Fee name" name="name" /><Field label="Fee amount (GH₵)" name="amount" type="number" min={0.01} step="0.01" /><Button type="submit" disabled={save.pending}>Save class fee</Button></form>
      <div className="space-y-3 border-t border-line pt-4"><Choice label="Review class fee" name="definitionId" items={[{ id: "", name: "Choose a fee to review" }, ...data.definitions.map(d => ({ id: d.id, name: `${d.name} · ${data.classes.find(c => c.id === d.classId)?.name ?? "Previous class"} · ${data.terms.find(t => t.id === d.termId)?.name ?? "Previous term"} · ${formatCedis(d.amountPesewas)}` }))]} value={definitionId} onChange={id => { setDefinitionId(id); setReviewed([]); }} />
        {definition && <><p className="text-sm">{eligible.length} active pupils have not yet received this fee. Existing charges will stay unchanged.</p><Button type="button" variant="secondary" onClick={() => setReviewed(eligible.map(p => p.id))}>Select all {eligible.length} pupils</Button><fieldset className="grid gap-2 sm:grid-cols-3"><legend className="sr-only">Review recipients</legend>{eligible.map(p => <label key={p.id} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={reviewed.includes(p.id)} onChange={e => setReviewed(e.target.checked ? [...reviewed, p.id] : reviewed.filter(id => id !== p.id))} />{name(p)}</label>)}</fieldset><p className="font-semibold">Apply {reviewed.length} charges · {formatCedis(reviewed.length * definition.amountPesewas)}</p><Button type="button" disabled={save.pending || !reviewed.length} onClick={() => save.run({ kind: "fee_apply", definitionId, studentIds: reviewed }, () => setReviewed([]))}>Apply reviewed charges</Button></>}
      </div></Panel>
      <Panel title="Opening debt or individual adjustment"><p className="text-sm text-secondary">For {selectedPupil ? name(selectedPupil) : "the selected pupil account"}. Enter a positive opening debt once. Adjustments can be positive charges or negative discounts; explain the change.</p>
        <form key={studentId} className="grid gap-4 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); const f = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null); withAmount(f, amountPesewas => money({ kind: "fee_entry", studentId, entryKind: text(f, "entryKind") as "opening" | "adjustment", amountPesewas, reason: text(f, "reason"), date: text(f, "date") })); }}><Choice label="Entry type" name="entryKind" items={[{ id: "opening", name: "Opening debt" }, { id: "adjustment", name: "Adjustment / discount" }]} /><Field label="Account amount (GH₵)" name="amount" type="number" step="0.01" /><Field label="Entry date" name="date" type="date" value={today()} /><Field label="Reason" name="reason" /><Button type="submit" disabled={save.pending || !studentId}>Save account entry</Button></form>
      </Panel></>}
  </div>;
}
