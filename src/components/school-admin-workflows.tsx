"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSchoolWorkflowAction } from "@/app/actions/school-workflow-actions";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import type { SchoolWorkflowData } from "@/lib/school-workflow-data";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";
import { formatGMTDateTime } from "@/lib/timezone";
import { EmergencySmsBroadcast } from "@/components/emergency-sms-broadcast";
import { TeacherBehaviourPanel } from "@/components/teacher-behaviour-panel";

const field = "min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "min-h-11 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50";
const today = () => new Date().toISOString().slice(0, 10);
const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const amount = (value: FormDataEntryValue | null) => Number(value ?? 0);
const string = (value: FormDataEntryValue | null) => String(value ?? "");

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border border-slate-200 bg-white p-5"><h2 className="text-base font-bold">{title}</h2>{children}</section>;
}
function Select({ name, label, options, value, onChange, required = true }: { name: string; label: string; options: { value: string; label: string }[]; value?: string; onChange?: (value: string) => void; required?: boolean }) {
  return <label className="block text-sm font-medium">{label}<select name={name} className={`${field} mt-1`} required={required} value={onChange ? value : undefined} onChange={onChange ? event => onChange(event.target.value) : undefined} defaultValue={onChange ? undefined : value ?? ""}><option value="">Choose {label.toLowerCase()}</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
function Input({ name, label, type = "text", required = true, min, max, defaultValue }: { name: string; label: string; type?: string; required?: boolean; min?: number; max?: number; defaultValue?: string | number }) {
  return <label className="block text-sm font-medium">{label}<input className={`${field} mt-1`} name={name} type={type} required={required} min={min} max={max} defaultValue={defaultValue} /></label>;
}

export function SchoolAdminWorkflows({ section, date, base, data }: { section: string; date: string; base: SchoolAdminData; data: SchoolWorkflowData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [revealed, setRevealed] = useState<{ caseId: string; notes: string[] } | null>(null);
  const [classId, setClassId] = useState(base.classes.find(item => item.academicYearId === base.years.find(year => year.isCurrent)?.id)?.id ?? "");
  const [assessmentId, setAssessmentId] = useState(data.assessments[0]?.id ?? "");
  const [targetType, setTargetType] = useState<"school" | "grade" | "class">("school");
  const [targetId, setTargetId] = useState("");
  const [editingAnnouncementId, setEditingAnnouncementId] = useState<string | null>(null);
  const year = base.years.find(row => row.isCurrent);
  const classes = base.classes.filter(row => row.academicYearId === year?.id);
  const classOptions = classes.map(row => ({ value: row.id, label: row.name }));
  const subjectOptions = base.subjects.map(row => ({ value: row.id, label: row.name }));
  const studentOptions = base.students.map(row => ({ value: row.id, label: `${row.firstName} ${row.lastName}` }));
  const termOptions = base.terms.filter(row => row.academicYearId === year?.id).map(row => ({ value: row.id, label: row.name }));
  const roster = base.enrollments.filter(row => row.classId === classId && row.academicYearId === year?.id && row.status === "active")
    .map(row => base.students.find(student => student.id === row.studentId)).filter((student): student is NonNullable<typeof student> => !!student);
  const currentAssessment = data.assessments.find(row => row.id === assessmentId);
  const editingAnnouncement = data.announcements.find(row => row.id === editingAnnouncementId);
  const gradeRoster = base.enrollments.filter(row => row.classId === currentAssessment?.classId && row.academicYearId === currentAssessment?.academicYearId && row.status === "active")
    .map(row => base.students.find(student => student.id === row.studentId)).filter((student): student is NonNullable<typeof student> => !!student);
  const name = (id: string) => { const row = base.students.find(student => student.id === id); return row ? `${row.firstName} ${row.lastName}` : "Unknown student"; };
  const subject = (id: string) => base.subjects.find(row => row.id === id)?.name ?? "Unknown subject";
  const send = (input: WorkflowCommand) => start(async () => {
    setMessage("");
    const result = await saveSchoolWorkflowAction(input);
    if (!result.success) { setMessage(result.error); return; }
    if (input.kind === "sensitive_access") setRevealed({ caseId: input.caseId, notes: result.notes ?? [] });
    setMessage(input.kind === "announcement_publish" ? "Announcement published in the family and staff portals."
      : input.kind === "announcement_archive" ? "Announcement archived and removed from portal views."
      : input.kind === "announcement_update" ? "Draft updated." : input.kind === "announcement" && input.status === "published"
        ? "Announcement published in the family and staff portals." : input.kind === "announcement" ? "Draft saved." : "Saved successfully.");
    if (input.kind === "announcement_update") { setEditingAnnouncementId(null); setTargetType("school"); setTargetId(""); }
    router.refresh();
  });
  const submit = (event: React.FormEvent<HTMLFormElement>, make: (form: FormData) => WorkflowCommand) => {
    event.preventDefault();
    send(make(new FormData(event.currentTarget)));
  };
  const exportAttendance = () => {
    const session = data.sessions.find(row => row.classId === classId);
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const rows = [["studentNumber", "studentName", "date", "class", "status", "reason"], ...roster.map(student => {
      const record = data.records.find(row => row.sessionId === session?.id && row.studentId === student.id);
      return [student.studentNumber, `${student.firstName} ${student.lastName}`, date, classes.find(row => row.id === classId)?.name ?? "",
        record?.status ?? "unmarked", record?.reason ?? ""];
    })];
    const blob = new Blob([rows.map(row => row.map(escape).join(",")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `attendance-${date}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  return <div className="space-y-6">
    {message && <p role="status" className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
    {section === "attendance" && <>
      <Box title="Morning roll call"><div className="grid gap-4 sm:grid-cols-2">
        <Select name="classId" label="Class" options={classOptions} value={classId} onChange={setClassId} />
        <form onSubmit={event => { event.preventDefault(); const chosen = string(new FormData(event.currentTarget).get("date")); router.push(`/?section=attendance&date=${encodeURIComponent(chosen)}`); }}><label className="text-sm">Date<input className={`${field} mt-1`} type="date" name="date" defaultValue={date} /></label><button className={`${secondary} mt-2`} type="submit">Load date</button></form>
      </div>
        {!year && <p className="text-sm text-amber-700">Set a current academic year first.</p>}
        {roster.length === 0 && <p className="text-sm text-slate-500">Choose a class with active students.</p>}
        <div className="divide-y divide-slate-100">{roster.map(student => {
          const session = data.sessions.find(row => row.classId === classId);
          const record = data.records.find(row => row.sessionId === session?.id && row.studentId === student.id);
          return <form key={student.id} className="grid items-end gap-2 py-3 md:grid-cols-[1fr_160px_1fr_1fr_auto]" onSubmit={event => submit(event, form => ({ kind: "attendance", classId, sessionDate: date, studentId: student.id,
            status: string(form.get("status")) as "present", reason: string(form.get("reason")), correctionReason: string(form.get("correctionReason")) }))}>
            <strong className="text-sm">{student.firstName} {student.lastName}</strong>
            <Select name="status" label="Status" options={["present", "absent", "late", "excused"].map(value => ({ value, label: words(value) }))} value={record?.status ?? "present"} />
            <Input name="reason" label="Reason" required={false} defaultValue={record?.reason ?? ""} />
            <Input name="correctionReason" label="Correction reason" required={false} />
            <button className={button} disabled={pending || session?.status === "locked"}>Save</button>
          </form>;
        })}</div>
        {roster.length > 0 && <div className="flex flex-wrap gap-2"><button className={secondary} disabled={pending} onClick={() => send({ kind: "attendance_submit", classId, sessionDate: date })}>Submit roll call</button><button className={secondary} type="button" onClick={exportAttendance}>Export CSV</button></div>}
      </Box>
    </>}
    {section === "gradebook" && <>
      <div className="grid gap-6 xl:grid-cols-2"><Box title="Assessment categories"><form className="space-y-3" onSubmit={event => submit(event, form => ({ kind: "category", academicYearId: year!.id, subjectId: string(form.get("subjectId")), name: string(form.get("name")), weight: amount(form.get("weight")) }))}>
        <Select name="subjectId" label="Subject" options={subjectOptions} /><Input name="name" label="Category name" /><Input name="weight" label="Weight" type="number" min={1} max={100} defaultValue={25} /><button className={button} disabled={pending || !year}>Add category</button>
      </form><ul className="space-y-2 text-sm">{data.categories.filter(row => row.academicYearId === year?.id).map(row => <li key={row.id}>{subject(row.subjectId ?? "")} · {row.name} · {row.weight}%</li>)}</ul></Box>
      <Box title="Create assessment"><form className="space-y-3" onSubmit={event => submit(event, form => ({ kind: "assessment", classId: string(form.get("classId")), termId: string(form.get("termId")), subjectId: string(form.get("subjectId")), categoryId: string(form.get("categoryId")), title: string(form.get("title")), maxScore: amount(form.get("maxScore")), dateDue: string(form.get("dateDue")) }))}>
        <Select name="classId" label="Class" options={classOptions} /><Select name="termId" label="Term" options={termOptions} /><Select name="subjectId" label="Subject" options={subjectOptions} />
        <Select name="categoryId" label="Category" options={data.categories.filter(row => row.academicYearId === year?.id).map(row => ({ value: row.id, label: `${subject(row.subjectId ?? "")} · ${row.name}` }))} />
        <Input name="title" label="Title" /><Input name="maxScore" label="Maximum score" type="number" min={1} max={1000} defaultValue={100} /><Input name="dateDue" label="Due date" type="date" defaultValue={today()} /><button className={button} disabled={pending}>Create assessment</button>
      </form></Box></div>
      <Box title="Enter grades"><Select name="assessmentId" label="Assessment" options={data.assessments.map(row => ({ value: row.id, label: `${row.title} · ${subject(row.subjectId)} · ${words(row.status)}` }))} value={assessmentId} onChange={setAssessmentId} />
        {currentAssessment && <><p className="text-sm text-slate-500">Maximum score: {currentAssessment.maxScore}. Published grade changes require a correction reason.</p>
          <div className="divide-y divide-slate-100">{gradeRoster.map(student => { const grade = data.grades.find(row => row.assessmentId === assessmentId && row.studentId === student.id); return <form key={student.id} className="grid items-end gap-3 py-3 md:grid-cols-[1fr_130px_1fr_1fr_auto]" onSubmit={event => submit(event, form => ({ kind: "grade_entry", assessmentId, studentId: student.id, score: amount(form.get("score")), feedback: string(form.get("feedback")), correctionReason: string(form.get("correctionReason")) }))}>
              <strong className="text-sm">{student.firstName} {student.lastName}</strong><Input name="score" label="Score" type="number" min={0} max={currentAssessment.maxScore} defaultValue={grade?.score ?? ""} /><Input name="feedback" label="Feedback" required={false} defaultValue={grade?.feedback ?? ""} /><Input name="correctionReason" label="Correction reason" required={false} /><button className={button} disabled={pending}>Save</button>
            </form>; })}</div>
          {gradeRoster.length > 0 && currentAssessment.status === "draft" && <button className={secondary} disabled={pending} onClick={() => send({ kind: "assessment_publish", assessmentId })}>Publish assessment and grades</button>}
        </>}
      </Box>
    </>}
    {section === "reports" && <>
      <Box title="Generate report card"><p className="text-sm text-slate-600">Creates a new version from published grades and submitted attendance.</p><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={event => submit(event, form => ({ kind: "report_generate", studentId: string(form.get("studentId")), termId: string(form.get("termId")) }))}>
        <Select name="studentId" label="Student" options={studentOptions} /><Select name="termId" label="Term" options={termOptions} /><button className={button} disabled={pending}>Generate</button>
      </form></Box>
      <Box title="Report cards"><div className="space-y-4">{data.reports.map(card => <article key={card.id} className="border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-semibold">{name(card.studentId)} · {base.terms.find(row => row.id === card.termId)?.name ?? "Term"} · Version {card.version}</h3><p className="text-sm text-slate-600">{words(card.status)} · Overall {card.overallPercentage ?? "—"}% · GPA {card.gpa ?? "—"} · Attendance {card.attendanceRate ?? "—"}%</p></div><div className="flex gap-2">{card.status === "draft" && <button className={secondary} disabled={pending} onClick={() => send({ kind: "report_status", reportCardId: card.id, status: "approved" })}>Approve</button>}{card.status === "approved" && <button className={button} disabled={pending} onClick={() => send({ kind: "report_status", reportCardId: card.id, status: "published" })}>Publish</button>}</div></div>
          <ul className="mt-3 text-sm">{data.reportSubjects.filter(row => row.reportCardId === card.id).map(row => <li key={row.id}>{subject(row.subjectId)}: {row.scorePercentage}% ({row.letterGrade})</li>)}</ul><Link className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700" href={`/reports/${card.id}`}>Open printable report card</Link></article>)}{data.reports.length === 0 && <p className="text-sm text-slate-500">No report cards yet.</p>}</div></Box>
    </>}
    {section === "communications" && <>
      <EmergencySmsBroadcast
        grades={base.grades}
        classes={base.classes}
        dispatches={data.dispatches}
        onDispatch={async (cmd) => {
          const res = await saveSchoolWorkflowAction(cmd);
          if (res.success) {
            router.refresh();
            return { success: true, recipientCount: res.recipientCount };
          }
          return { success: false, error: res.error };
        }}
        schoolName={base.school.name}
      />
      <Box title={editingAnnouncement ? "Edit announcement draft" : "Create in-app announcement"}><form key={editingAnnouncement?.id ?? "new-announcement"} className="space-y-3" onSubmit={event => submit(event, form => editingAnnouncement ? ({ kind: "announcement_update", announcementId: editingAnnouncement.id, title: string(form.get("title")), content: string(form.get("content")), targetType, targetId: targetType === "school" ? "all" : string(form.get("targetId")), priority: string(form.get("priority")) as "normal" | "important" }) : ({ kind: "announcement", title: string(form.get("title")), content: string(form.get("content")), targetType, targetId: targetType === "school" ? "all" : string(form.get("targetId")), priority: string(form.get("priority")) as "normal" | "important", status: string(form.get("status")) as "draft" | "published" }))}>
        <Input name="title" label="Title" defaultValue={editingAnnouncement?.title} /><label className="block text-sm font-medium">Message<textarea className={`${field} mt-1 min-h-28`} name="content" required defaultValue={editingAnnouncement?.content ?? ""} /></label>
        <Select name="targetType" label="Audience" options={[{ value: "school", label: "Whole school" }, { value: "grade", label: "Grade" }, { value: "class", label: "Class" }]} value={targetType} onChange={value => { setTargetType(value as typeof targetType); setTargetId(""); }} />
        {targetType !== "school" && <Select name="targetId" label={words(targetType)} options={targetType === "grade" ? base.grades.map(row => ({ value: row.id, label: row.name })) : classOptions} value={targetId} onChange={setTargetId} />}
        <Select name="priority" label="Priority" options={[{ value: "normal", label: "Normal" }, { value: "important", label: "Important" }]} value={editingAnnouncement?.priority ?? "normal"} />
        {!editingAnnouncement && <Select name="status" label="Save as" options={[{ value: "draft", label: "Draft" }, { value: "published", label: "Publish now" }]} value="draft" />}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={pending}>{editingAnnouncement ? "Save draft" : "Save announcement"}</button>{editingAnnouncement && <button type="button" className={secondary} disabled={pending} onClick={() => { setEditingAnnouncementId(null); setTargetType("school"); setTargetId(""); }}>Cancel edit</button>}</div>
      </form></Box>
      <Box title="Announcements"><div className="space-y-3">{data.announcements.map(row => { const audience = row.targetType === "school" ? "Whole school" : row.targetType === "grade" ? base.grades.find(item => item.id === row.targetId)?.name ?? "Grade removed" : base.classes.find(item => item.id === row.targetId)?.name ?? "Class removed"; return <article key={row.id} className="border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{row.title}</h3><p className="mt-1 text-xs text-slate-600">{words(row.status)} · Audience: {audience} · {words(row.priority)}</p>{row.publishedAt && <p className="mt-1 text-xs text-slate-500">Published {formatGMTDateTime(row.publishedAt)}</p>}</div><div className="flex flex-wrap gap-2">{row.status === "draft" && <><button type="button" className={secondary} disabled={pending} onClick={() => { setEditingAnnouncementId(row.id); setTargetType(row.targetType); setTargetId(row.targetId); }}>Edit draft</button><button type="button" className={button} disabled={pending} onClick={() => send({ kind: "announcement_publish", announcementId: row.id })}>Publish</button></>}{row.status !== "archived" && <button type="button" className={secondary} disabled={pending} onClick={() => { if (window.confirm(`Archive “${row.title}”? It will no longer appear in staff or family portal notices.`)) send({ kind: "announcement_archive", announcementId: row.id }); }}>Archive</button>}</div></div><p className="mt-3 whitespace-pre-wrap text-sm">{row.content}</p></article>; })}{data.announcements.length === 0 && <p className="text-sm text-slate-500">No announcements yet.</p>}</div></Box>
    </>}
    {section === "sensitive" && <>
      <Box title="Create sensitive case"><p className="text-sm text-slate-600">Case metadata is visible to school administrators. Note text is encrypted and requires a logged access reason to open.</p><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_case", studentId: string(form.get("studentId")), caseNumber: string(form.get("caseNumber")), area: string(form.get("area")) as "safeguarding", confidentialityTier: string(form.get("tier")) as "confidential", title: string(form.get("title")) }))}>
        <Select name="studentId" label="Student" options={studentOptions} /><Input name="caseNumber" label="Case number" /><Select name="area" label="Area" options={["safeguarding", "health_medical", "special_needs", "disciplinary"].map(value => ({ value, label: words(value) }))} /><Select name="tier" label="Confidentiality" options={["standard_sensitive", "confidential", "strictly_confidential"].map(value => ({ value, label: words(value) }))} /><Input name="title" label="Case title" /><button className={button} disabled={pending}>Create case</button>
      </form></Box>
      <Box title="Cases"><div className="space-y-4">{data.cases.map(row => <article key={row.id} className="space-y-3 border border-slate-200 p-4"><div><h3 className="font-semibold">{row.caseNumber} · {row.title}</h3><p className="text-sm text-slate-600">{name(row.studentId)} · {words(row.area)} · {words(row.status)} · {data.notes.filter(note => note.caseId === row.id).length} encrypted notes</p></div>
        <form className="space-y-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_note", caseId: row.id, note: string(form.get("note")) }))}><label className="block text-sm font-medium">Add encrypted note<textarea className={`${field} mt-1 min-h-24`} name="note" required /></label><button className={secondary} disabled={pending}>Add note</button></form>
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_access", caseId: row.id, accessReason: string(form.get("accessReason")) }))}><div className="min-w-60 flex-1"><Input name="accessReason" label="Reason for viewing notes" /></div><button className={secondary} disabled={pending}>Open notes</button></form>
        {revealed?.caseId === row.id && <div className="border border-amber-200 bg-amber-50 p-3"><div className="flex justify-between"><strong className="text-sm">Decrypted notes</strong><button type="button" className="text-sm underline" onClick={() => setRevealed(null)}>Close</button></div>{revealed.notes.map((note, index) => <p key={index} className="mt-2 whitespace-pre-wrap text-sm">{note}</p>)}{revealed.notes.length === 0 && <p className="mt-2 text-sm">No notes.</p>}</div>}
        <form className="flex flex-wrap items-end gap-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_case_status", caseId: row.id, status: string(form.get("status")) as "open", reason: string(form.get("reason")) }))}><Select name="status" label="Case status" options={["open", "under_review", "monitoring", "closed"].map(value => ({ value, label: words(value) }))} value={row.status} /><Input name="reason" label="Reason for change" /><button className={secondary} disabled={pending}>Update status</button></form>
      </article>)}{data.cases.length === 0 && <p className="text-sm text-slate-500">No sensitive cases yet.</p>}</div></Box>
      <Box title="Need-to-know directives"><p className="text-sm text-slate-600">Record a limited action for staff without exposing encrypted case notes.</p><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => {
        const caseId = string(form.get("caseId"));
        return { kind: "need_to_know", caseId, studentId: data.cases.find(row => row.id === caseId)?.studentId ?? "",
          category: string(form.get("category")), severity: string(form.get("severity")) as "routine",
          directiveSummary: string(form.get("directiveSummary")), actionRequired: string(form.get("actionRequired")) };
      })}><Select name="caseId" label="Case" options={data.cases.map(row => ({ value: row.id, label: `${row.caseNumber} · ${name(row.studentId)}` }))} /><Input name="category" label="Category" />
        <Select name="severity" label="Severity" options={["routine", "urgent", "critical"].map(value => ({ value, label: words(value) }))} /><Input name="directiveSummary" label="Short directive" />
        <label className="block text-sm font-medium sm:col-span-2">Action required<textarea className={`${field} mt-1 min-h-24`} name="actionRequired" required /></label><button className={button} disabled={pending || !data.cases.length}>Create directive</button>
      </form><div className="space-y-2">{data.alerts.map(row => <article key={row.id} className="flex flex-wrap items-start justify-between gap-3 border border-slate-200 p-3 text-sm"><div><strong>{name(row.studentId)} · {row.directiveSummary}</strong><p className="mt-1">{row.actionRequired}</p><p className="mt-1 text-xs text-slate-500">{words(row.severity)} · {row.isActive ? "Active" : "Resolved"}</p></div>{row.isActive && <button className={secondary} disabled={pending} onClick={() => { const reason = window.prompt("Reason for resolving this directive"); if (reason) send({ kind: "need_to_know_resolve", alertId: row.id, reason }); }}>Resolve</button>}</article>)}</div></Box>
      <Box title="Court restrictions"><p className="text-sm text-slate-600">Document an order and the actions it prohibits. Verify the original order before changing enforcement.</p><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => ({ kind: "court_restriction", studentId: string(form.get("studentId")), restrictedPersonName: string(form.get("person")),
        orderType: string(form.get("orderType")) as "restraining_order", docketNumber: string(form.get("docket")), issuingCourt: string(form.get("court")),
        summary: string(form.get("summary")), effectiveDate: string(form.get("effectiveDate")), expirationDate: string(form.get("expirationDate")),
        prohibitPickup: form.has("pickup"), prohibitDisclosure: form.has("disclosure"), prohibitDirectContact: form.has("contact") }))}>
        <Select name="studentId" label="Student" options={studentOptions} /><Input name="person" label="Restricted person" /><Select name="orderType" label="Order type" options={["restraining_order", "custody_restriction", "prohibited_contact", "non_disclosure"].map(value => ({ value, label: words(value) }))} /><Input name="docket" label="Docket number" /><Input name="court" label="Issuing court" /><Input name="effectiveDate" label="Effective date" type="date" /><Input name="expirationDate" label="Expiration date" type="date" required={false} />
        <label className="block text-sm font-medium sm:col-span-2">Order summary<textarea className={`${field} mt-1 min-h-24`} name="summary" required /></label>
        <div className="flex flex-wrap gap-4 text-sm sm:col-span-2"><label><input type="checkbox" name="pickup" defaultChecked /> Prohibit pickup</label><label><input type="checkbox" name="disclosure" defaultChecked /> Prohibit disclosure</label><label><input type="checkbox" name="contact" defaultChecked /> Prohibit direct contact</label></div><button className={button} disabled={pending}>Record restriction</button>
      </form><div className="space-y-2">{data.restrictions.map(row => <article key={row.id} className="flex flex-wrap items-start justify-between gap-3 border border-slate-200 p-3 text-sm"><div><strong>{name(row.studentId)} · {row.restrictedPersonName}</strong><p>{words(row.orderType)} · {row.issuingCourt} · {row.docketNumber}</p><p className="mt-1">{row.summary}</p><p className="mt-1 text-xs text-slate-500">{row.isEnforced ? "Enforced" : "Inactive"} · Effective {row.effectiveDate}{row.expirationDate ? ` to ${row.expirationDate}` : ""}</p></div><button className={secondary} disabled={pending} onClick={() => { const reason = window.prompt(`Reason to ${row.isEnforced ? "deactivate" : "reactivate"} this restriction`); if (reason) send({ kind: "court_restriction_status", restrictionId: row.id, isEnforced: !row.isEnforced, reason }); }}>{row.isEnforced ? "Deactivate" : "Reactivate"}</button></article>)}</div></Box>
      <Box title="Recent sensitive access"><ul className="space-y-2 text-sm">{data.accessLogs.map(row => <li key={row.id}>{data.cases.find(item => item.id === row.caseId)?.caseNumber ?? "Case"} · {row.action} · {row.accessReason}</li>)}</ul></Box>
    </>}
    {section === "behaviour" && (
      <TeacherBehaviourPanel
        classes={classes}
        students={base.students}
        enrollments={base.enrollments}
        behaviours={data.behaviours ?? []}
        defaultDate={date}
        pending={pending}
        onSave={send}
        isAdmin={true}
      />
    )}
  </div>;
}

