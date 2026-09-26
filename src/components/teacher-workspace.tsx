"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Award, BookOpen, CalendarCheck, ChevronRight, ClipboardList, GraduationCap, LayoutDashboard, Megaphone, Menu, MessageSquare, X } from "lucide-react";
import { AccountSignOut } from "@/components/account-sign-out";
import { saveTeacherWorkflowAction } from "@/app/actions/teacher-actions";
import type { TeacherData } from "@/lib/teacher-data";
import { attendancePeriods, type AttendancePeriod, type WorkflowCommand } from "@/lib/school-workflow-policy";
import type { announcements } from "@/db/schema";
import { TeacherBehaviourPanel } from "@/components/teacher-behaviour-panel";
import { StudentAcademicDrawer } from "@/components/student-academic-drawer";
import { StaffInquiryList } from "@/components/staff-inquiry-list";

const tabs = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "classes", label: "My classes", icon: GraduationCap },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "gradebook", label: "Gradebook", icon: BookOpen },
  { id: "reports", label: "Report cards", icon: ClipboardList },
  { id: "behaviour", label: "Behaviour & praise", icon: Award },
  { id: "inquiries", label: "Inquiries", icon: MessageSquare },
  { id: "notices", label: "Notices", icon: Megaphone },
] as const;
const inputStyle = "mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600";
const primary = "min-h-11 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";
const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const str = (form: FormData, name: string) => String(form.get(name) ?? "");

function Field({ label, name, type = "text", defaultValue, required = true, min, max }: { label: string; name: string; type?: string; defaultValue?: string | number; required?: boolean; min?: number; max?: number }) {
  return <label className="block text-sm font-medium">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} min={min} max={max} className={inputStyle} /></label>;
}
function Select({ label, name, choices, value, onChange }: { label: string; name: string; choices: { id: string; name: string }[]; value?: string; onChange?: (value: string) => void }) {
  return <label className="block text-sm font-medium">{label}<select name={name} required className={inputStyle} value={onChange ? value : undefined} onChange={onChange ? event => onChange(event.target.value) : undefined} defaultValue={onChange ? undefined : value ?? ""}><option value="">Choose {label.toLowerCase()}</option>{choices.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>;
}
function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border border-slate-200 bg-white p-5"><h2 className="mb-4 text-lg font-bold">{title}</h2>{children}</section>;
}

function StudentSafety({ studentId, safety }: { studentId: string; safety: TeacherData["safety"] }) {
  const alerts = safety.alerts.filter(alert => alert.studentId === studentId);
  const pickupWarning = safety.pickupWarnings.includes(studentId);
  if (!alerts.length && !pickupWarning) return <span className="text-slate-500">No active directives</span>;
  return <div className="space-y-2">
    {pickupWarning && <p className="border-l-4 border-red-600 bg-red-50 p-2 font-semibold text-red-950">Pickup restriction: verify any release with the front office.</p>}
    {alerts.map(alert => <div key={alert.id} className="border-l-4 border-amber-500 bg-amber-50 p-2 text-amber-950">
      <p className="font-semibold">{words(alert.category)} · {words(alert.severity)}: {alert.directiveSummary}</p>
      <p className="mt-1 whitespace-pre-wrap">{alert.actionRequired}</p>
    </div>)}
  </div>;
}

function StudentContext({ studentId, data, onOpenProfile }: { studentId: string; data: TeacherData; onOpenProfile?: () => void }) {
  const contacts = data.guardianContacts?.filter(row => row.studentId === studentId) ?? [];
  const primary = contacts.find(row => row.isPrimary) ?? contacts[0];
  const marks = data.historyRecords?.filter(row => row.studentId === studentId) ?? [];
  const reports = data.publishedReports?.filter(row => row.studentId === studentId) ?? [];
  const present = marks.filter(row => row.status === "present").length;
  return <details className="mt-1 text-xs"><summary className="cursor-pointer text-blue-800">Contact and history</summary>
    <div className="mt-2 space-y-2 text-slate-700">
      <p>Primary contact: {primary?.guardian ? <>{primary.guardian.firstName} {primary.guardian.lastName} {primary.guardian.phone && <a href={`tel:${primary.guardian.phone}`} className="underline">{primary.guardian.phone}</a>} {primary.guardian.email && <a href={`mailto:${primary.guardian.email}`} className="underline">{primary.guardian.email}</a>}</> : "No linked guardian"}</p>
      <p>Recent morning attendance: {marks.length ? `${present}/${marks.length} present` : "No submitted marks"}</p>
      <p>Published reports: {reports.length ? reports.slice(0, 3).map(row => `${data.terms.find(term => term.id === row.termId)?.name ?? "Term"}: ${row.overallPercentage ?? "—"}%`).join(" · ") : "None"}</p>
      {onOpenProfile && <p><button type="button" onClick={onOpenProfile} className="font-semibold text-blue-700 hover:underline">Open full academic profile & trends →</button></p>}
    </div></details>;
}

function TeacherClassAnnouncement({ classes, pending, onSave }: { classes: TeacherData["classes"]; pending: boolean; onSave: (command: WorkflowCommand) => void }) {
  return <Card title="Publish a class notice"><p className="mb-3 text-sm text-slate-600">This notice appears in the selected class&apos;s guardian portal.</p>
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={event => {
      event.preventDefault(); const form = new FormData(event.currentTarget);
      onSave({ kind: "announcement", title: str(form, "title"), content: str(form, "content"),
        targetType: "class", targetId: str(form, "classId"), priority: "normal", status: "published" });
    }}><Select label="Class" name="classId" choices={classes.map(row => ({ id: row.id, name: row.name }))} />
      <Field label="Title" name="title" /><label className="block text-sm font-medium sm:col-span-2">Message<textarea name="content" required maxLength={10000} className={`${inputStyle} min-h-28`} /></label>
      <button className={primary} disabled={pending || !classes.length}>Publish to class</button></form>
  </Card>;
}

export function TeacherWorkspace({ data, notices, section, date }: { data: TeacherData; notices: (typeof announcements.$inferSelect)[]; section: string; date: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [classId, setClassId] = useState(data.classes[0]?.id ?? "");
  const [attendancePeriod, setAttendancePeriod] = useState<AttendancePeriod>("morning_roll_call");
  const [assessmentId, setAssessmentId] = useState(data.assessments[0]?.id ?? "");
  const [subjectId, setSubjectId] = useState("");
  const current = tabs.find(tab => tab.id === section) ?? tabs[0];
  const selectedClassId = data.classes.some(row => row.id === classId) ? classId : data.classes[0]?.id ?? "";
  const activeAssessmentId = data.assessments.some(row => row.id === assessmentId) ? assessmentId : data.assessments[0]?.id ?? "";
  const homeClasses = data.classes.filter(row => data.homeroomClassIds.includes(row.id));
  const attendanceClasses = attendancePeriod === "morning_roll_call" ? homeClasses : data.classes.filter(row =>
    data.homeroomClassIds.includes(row.id) || data.assignments.some(item => item.classId === row.id && item.subjectId !== null));
  const attendanceClassId = attendanceClasses.some(row => row.id === classId) ? classId : attendanceClasses[0]?.id ?? "";
  const attendanceSession = data.sessions.find(row => row.classId === attendanceClassId && row.period === attendancePeriod);
  const studentName = (id: string) => { const row = data.students.find(student => student.id === id); return row ? `${row.firstName} ${row.lastName}` : "Unknown student"; };
  const subjectName = (id: string) => data.subjects.find(row => row.id === id)?.name ?? "Subject";
  const roster = (id: string) => data.enrollments.filter(row => row.classId === id && row.status === "active")
    .map(row => data.students.find(student => student.id === row.studentId)).filter((student): student is NonNullable<typeof student> => !!student);
  const allowedSubjects = (id: string) => data.homeroomClassIds.includes(id) ? data.subjects : data.subjects.filter(subject =>
    data.assignments.some(item => item.classId === id && item.subjectId === subject.id));
  const [drawerStudentId, setDrawerStudentId] = useState<string | null>(null);
  const selectedAssessment = data.assessments.find(row => row.id === activeAssessmentId);
  const drawerStudent = drawerStudentId ? data.students.find(s => s.id === drawerStudentId) : null;
  const drawerStudentEnrollment = drawerStudent ? data.enrollments.find(e => e.studentId === drawerStudent.id && e.status === "active") : null;
  const drawerStudentClass = drawerStudentEnrollment ? data.classes.find(c => c.id === drawerStudentEnrollment.classId) : null;
  const drawerStudentGrade = drawerStudentClass ? data.gradeLevels.find(g => g.id === drawerStudentClass.gradeLevelId) : null;
  const drawerStudentPlacement = drawerStudentClass ? `${drawerStudentGrade?.name ? `${drawerStudentGrade.name} / ` : ""}${drawerStudentClass.name} · ${data.currentYear?.name ?? ""}` : undefined;
  const drawerStudentGuardians = drawerStudent ? (data.guardianContacts?.filter(c => c.studentId === drawerStudent.id) ?? []).map(c => ({ firstName: c.guardian?.firstName ?? "", lastName: c.guardian?.lastName ?? "", phone: c.guardian?.phone, email: c.guardian?.email, relationship: "guardian", isPrimary: c.isPrimary })) : [];
  const drawerStudentSafety = drawerStudent ? [ ...(data.safety.alerts.filter(a => a.studentId === drawerStudent.id).map(a => ({ type: "directive" as const, title: words(a.category), detail: `${words(a.severity)}: ${a.directiveSummary}` }))), ...(data.safety.pickupWarnings.filter(id => id === drawerStudent.id).map(() => ({ type: "pickup" as const, title: "Pickup restriction", detail: "Verify any release with front office" }))) ] : [];
  const drawerStudentReports = drawerStudent ? (data.publishedReports ?? []).filter(r => r.studentId === drawerStudent.id) : [];
  const drawerStudentReportSubjects = drawerStudent ? (data.reportSubjects ?? []).filter(rs => drawerStudentReports.some(r => r.id === rs.reportCardId)) : [];
  const drawerStudentMarks = drawerStudent ? (data.historyRecords?.filter(m => m.studentId === drawerStudent.id) ?? []) : [];
  const drawerStudentBehaviours = drawerStudent ? (data.behaviours?.filter(b => b.studentId === drawerStudent.id) ?? []) : [];
  const drawerStudentTimetable = drawerStudent && drawerStudentClass ? (data.timetable ?? []).filter(p => p.classId === drawerStudentClass.id) : [];
  const save = (command: WorkflowCommand) => start(async () => {
    setMessage("");
    const result = await saveTeacherWorkflowAction(command);
    setMessage(result.success ? "Saved successfully." : result.error);
    if (result.success) router.refresh();
  });
  const submit = (event: React.FormEvent<HTMLFormElement>, make: (form: FormData) => WorkflowCommand) => {
    event.preventDefault(); save(make(new FormData(event.currentTarget)));
  };
  return <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
    <a href="#teacher-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <aside className="border-b border-slate-800 bg-slate-950 text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col">
      <div className="flex min-h-20 items-center justify-between border-b border-white/10 px-5"><Link href="/" className="flex items-center gap-3 text-white"><span className="grid h-9 w-9 place-items-center bg-blue-600 text-lg font-bold">K</span><span><strong className="block text-lg">Klassa</strong><small className="text-[10px] uppercase tracking-[.16em] text-slate-400">Teacher workspace</small></span></Link><button className="grid h-11 w-11 place-items-center lg:hidden" aria-label={mobileNav ? "Close navigation" : "Open navigation"} aria-expanded={mobileNav} onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button></div>
      <nav className={`${mobileNav ? "block" : "hidden"} flex-1 p-3 lg:block`} aria-label="Teacher navigation">{tabs.map(tab => { const Icon = tab.icon; return <Link key={tab.id} href={`/?section=${tab.id}`} onClick={() => setMobileNav(false)} aria-current={current.id === tab.id ? "page" : undefined} className={`mb-1 flex min-h-11 items-center gap-3 px-3 text-sm font-medium ${current.id === tab.id ? "bg-blue-600 text-white" : "hover:bg-white/5 hover:text-white"}`}><Icon size={18} /><span className="flex-1">{tab.label}</span>{current.id === tab.id && <ChevronRight size={14} />}</Link>; })}</nav>
      <div className="hidden border-t border-white/10 p-5 lg:block"><p className="text-sm font-semibold text-white">{data.actor.name}</p><p className="mt-1 text-xs">Teacher</p><Link href="/schools" className="mt-3 inline-flex min-h-11 items-center text-xs text-blue-300">Switch school</Link></div>
    </aside>
    <div className="min-w-0"><header className="flex min-h-20 items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><div><p className="text-[10px] font-bold uppercase tracking-[.15em] text-blue-700">{data.currentYear?.name ?? "No current school year"}</p><p className="mt-1 font-bold">{data.school.name}</p></div><AccountSignOut /></header>
      <main id="teacher-content" className="mx-auto max-w-[1400px] space-y-6 p-4 sm:p-8"><div><p className="text-xs text-slate-500">Teaching</p><h1 className="mt-1 text-2xl font-bold">{current.label}</h1></div>
        {message && <p role="status" className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{message}</p>}
        {current.id === "overview" && (data.safety.alerts.length > 0 || data.safety.pickupWarnings.length > 0) && <Link href="/?section=classes" className="block border-l-4 border-amber-600 bg-amber-50 p-4 text-sm font-semibold text-amber-950">Active student safety information is on your class rosters. Review directives and pickup restrictions before class or dismissal.</Link>}
        {!data.classes.length && current.id !== "notices" && <div className="border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"><strong>No classes assigned yet.</strong><p className="mt-1">Ask your school administrator to assign you as a homeroom or subject teacher for the current year.</p></div>}
        {current.id === "overview" && <><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">{[
          { label: "Assigned classes", value: data.classes.length, href: "classes" },
          { label: "Active students", value: new Set(data.enrollments.filter(row => row.status === "active").map(row => row.studentId)).size, href: "classes" },
          { label: "Open inquiries", value: (data.inquiries ?? []).filter(row => row.status === "open").length, href: "inquiries" },
          { label: "Praise merits", value: (data.behaviours ?? []).filter(row => row.type === "praise").reduce((sum, row) => sum + row.points, 0), href: "behaviour" },
          { label: "Assessments", value: data.assessments.length, href: "gradebook" },
        ].map(item => <Link key={item.label} href={`/?section=${item.href}`} className="border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{item.label}</p><p className="mt-3 text-3xl font-bold">{item.value}</p></Link>)}</div><Card title="Your classes"><div className="grid gap-3 md:grid-cols-2">{data.classes.map(row => <Link key={row.id} href="/?section=classes" className="flex min-h-16 items-center justify-between border border-slate-200 p-4 text-sm hover:border-blue-500"><span><strong>{row.name}</strong><span className="ml-2 text-slate-500">{data.gradeLevels.find(grade => grade.id === row.gradeLevelId)?.name}</span></span><span className="text-slate-500">{roster(row.id).length} students</span></Link>)}</div></Card><Card title="Latest notices">{notices.slice(0, 3).map(notice => <div key={notice.id} className="border-b border-slate-100 py-3 text-sm"><strong>{notice.title}</strong><p className="mt-1 text-slate-600">{notice.content}</p></div>)}{!notices.length && <p className="text-sm text-slate-500">No published notices.</p>}</Card></>}
        {current.id === "classes" && <div className="space-y-5">{data.classes.map(row => <Card key={row.id} title={`${data.gradeLevels.find(grade => grade.id === row.gradeLevelId)?.name ?? "Grade"} / ${row.name}`}><p className="mb-3 text-sm text-slate-500">{data.homeroomClassIds.includes(row.id) ? "Homeroom teacher" : `Subject teacher: ${allowedSubjects(row.id).map(item => item.name).join(", ")}`}</p><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-slate-200 text-slate-500"><th className="py-2">Student</th><th>Student number</th><th>Status</th><th>Safety information</th></tr></thead><tbody>{roster(row.id).map(student => {
          const merits = (data.behaviours ?? []).filter(b => b.studentId === student.id && b.type === "praise").reduce((sum, b) => sum + b.points, 0);
          const incidents = (data.behaviours ?? []).filter(b => b.studentId === student.id && b.type === "incident").reduce((sum, b) => sum + b.points, 0);
          return <tr key={student.id} className="border-b border-slate-100"><td className="py-3 font-medium"><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={() => setDrawerStudentId(student.id)} className="cursor-pointer font-semibold text-blue-900 hover:text-blue-700 hover:underline text-left">{student.firstName} {student.lastName}</button>{merits > 0 && <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800">+{merits} merits</span>}{incidents > 0 && <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[11px] font-semibold text-rose-800">-{incidents}</span>}</div><StudentContext studentId={student.id} data={data} onOpenProfile={() => setDrawerStudentId(student.id)} /></td><td>{student.studentNumber}</td><td>{words(student.status)}</td><td className="min-w-72 py-3"><StudentSafety studentId={student.id} safety={data.safety} /></td></tr>;
        })}</tbody></table>{!roster(row.id).length && <p className="py-4 text-slate-500">No active students enrolled.</p>}</div></Card>)}</div>}
        {current.id === "attendance" && <Card title="Class attendance"><div className="grid gap-3 sm:grid-cols-3"><Select label="Session period" name="period" choices={attendancePeriods.map(period => ({ id: period, name: period === "morning_roll_call" ? "Morning roll call" : words(period) }))} value={attendancePeriod} onChange={value => setAttendancePeriod(value as AttendancePeriod)} /><Select label="Class" name="classId" choices={attendanceClasses.map(row => ({ id: row.id, name: row.name }))} value={attendanceClassId} onChange={setClassId} /><form onSubmit={event => { event.preventDefault(); router.push(`/?section=attendance&date=${encodeURIComponent(str(new FormData(event.currentTarget), "date"))}`); }}><Field label="Date" name="date" type="date" defaultValue={date} /><button type="submit" className={`${secondary} mt-2`}>Load date</button></form></div>
          {attendanceClasses.length === 0 && <p className="mt-4 text-sm text-slate-500">No classes are assigned for this attendance period.</p>}
          {attendanceClassId && (data.absenceNotes ?? []).filter(note => roster(attendanceClassId).some(student => student.id === note.studentId)).length > 0 &&
            <div className="mt-4 border border-blue-200 bg-blue-50 p-3 text-sm"><strong>Guardian absence notes for this date</strong><ul className="mt-2 space-y-1">{data.absenceNotes.filter(note => roster(attendanceClassId).some(student => student.id === note.studentId)).map(note =>
              <li key={note.id}>{studentName(note.studentId)}: {words(note.reasonCategory)} ({words(note.status)})</li>)}</ul></div>}
          {attendanceClassId && <><p className="mt-4 text-sm text-slate-600">{attendanceSession ? `Session ${words(attendanceSession.status)}.` : "No attendance recorded for this session yet."} Mark every active student before submitting.</p><div className="mt-4 divide-y divide-slate-100">{roster(attendanceClassId).map(student => { const record = data.records.find(row => row.sessionId === attendanceSession?.id && row.studentId === student.id); return <form key={`${attendanceClassId}-${attendancePeriod}-${student.id}`} className="grid items-end gap-3 py-3 md:grid-cols-[1fr_160px_1fr_1fr_auto]" onSubmit={event => submit(event, form => ({ kind: "attendance", classId: attendanceClassId, sessionDate: date, period: attendancePeriod, studentId: student.id, status: str(form, "status") as "present", reason: str(form, "reason"), correctionReason: str(form, "correctionReason") }))}><strong className="text-sm">{student.firstName} {student.lastName}</strong><Select label="Status" name="status" choices={["present", "absent", "late", "excused"].map(value => ({ id: value, name: words(value) }))} value={record?.status ?? "present"} /><Field label="Reason" name="reason" required={false} defaultValue={record?.reason ?? ""} /><Field label="Correction reason" name="correctionReason" required={false} /><button className={primary} disabled={pending || attendanceSession?.status === "locked"}>Save</button></form>; })}</div><button className={secondary} disabled={pending || attendanceSession?.status === "locked" || !roster(attendanceClassId).length} onClick={() => save({ kind: "attendance_submit", classId: attendanceClassId, sessionDate: date, period: attendancePeriod })}>Submit {attendancePeriod === "morning_roll_call" ? "roll call" : words(attendancePeriod)}</button></>}
        </Card>}
        {current.id === "gradebook" && <div className="space-y-5"><Card title="Create assessment"><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => ({ kind: "assessment", classId: str(form, "classId"), termId: str(form, "termId"), subjectId: str(form, "subjectId"), categoryId: str(form, "categoryId"), title: str(form, "title"), maxScore: Number(str(form, "maxScore")), dateDue: str(form, "dateDue") }))}><Select label="Class" name="classId" choices={data.classes.map(row => ({ id: row.id, name: row.name }))} value={selectedClassId} onChange={value => { setClassId(value); setSubjectId(""); }} /><Select label="Term" name="termId" choices={data.terms.map(row => ({ id: row.id, name: row.name }))} /><Select label="Subject" name="subjectId" choices={allowedSubjects(selectedClassId).map(row => ({ id: row.id, name: row.name }))} value={subjectId} onChange={setSubjectId} /><Select label="Category" name="categoryId" choices={data.categories.filter(row => row.subjectId === subjectId).map(row => ({ id: row.id, name: `${row.name} (${row.weight}%)` }))} /><Field label="Title" name="title" /><Field label="Maximum score" name="maxScore" type="number" min={1} max={1000} defaultValue={100} /><Field label="Due date" name="dateDue" type="date" /><button className={primary} disabled={pending || !selectedClassId}>Create assessment</button></form>{!data.categories.length && <p className="mt-3 text-sm text-amber-700">Ask your school administrator to set up assessment categories first.</p>}</Card>
          <Card title="Enter grades"><Select label="Assessment" name="assessmentId" choices={data.assessments.map(row => ({ id: row.id, name: `${row.title} · ${subjectName(row.subjectId)} · ${words(row.status)}` }))} value={activeAssessmentId} onChange={setAssessmentId} />{selectedAssessment && <><p className="mt-3 text-sm text-slate-500">Maximum score {selectedAssessment.maxScore}. Changes to published scores require a correction reason.</p><div className="mt-3 divide-y divide-slate-100">{roster(selectedAssessment.classId).map(student => { const grade = data.grades.find(row => row.assessmentId === selectedAssessment.id && row.studentId === student.id); return <form key={student.id} className="grid items-end gap-3 py-3 md:grid-cols-[1fr_130px_1fr_1fr_auto]" onSubmit={event => submit(event, form => ({ kind: "grade_entry", assessmentId: selectedAssessment.id, studentId: student.id, score: Number(str(form, "score")), feedback: str(form, "feedback"), correctionReason: str(form, "correctionReason") }))}><strong className="text-sm">{student.firstName} {student.lastName}</strong><Field label="Score" name="score" type="number" min={0} max={selectedAssessment.maxScore} defaultValue={grade?.score ?? ""} /><Field label="Feedback" name="feedback" required={false} defaultValue={grade?.feedback ?? ""} /><Field label="Correction reason" name="correctionReason" required={false} /><button className={primary} disabled={pending}>Save</button></form>; })}</div>{selectedAssessment.status === "draft" && roster(selectedAssessment.classId).length > 0 && <button className={secondary} disabled={pending} onClick={() => save({ kind: "assessment_publish", assessmentId: selectedAssessment.id })}>Publish assessment and grades</button>}</>}</Card></div>}
        {current.id === "reports" && <div className="space-y-5"><Card title="Generate draft report card"><p className="mb-3 text-sm text-slate-600">Uses published assessments and submitted attendance. School administration approves and publishes the draft.</p><form className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end" onSubmit={event => submit(event, form => ({ kind: "report_generate", studentId: str(form, "studentId"), termId: str(form, "termId") }))}><Select label="Homeroom student" name="studentId" choices={data.students.filter(student => data.enrollments.some(row => row.studentId === student.id && data.homeroomClassIds.includes(row.classId ?? ""))).map(row => ({ id: row.id, name: `${row.firstName} ${row.lastName}` }))} /><Select label="Term" name="termId" choices={data.terms.map(row => ({ id: row.id, name: row.name }))} /><button className={primary} disabled={pending}>Generate draft</button></form></Card><Card title="My class reports"><div className="space-y-4">{data.reports.map(card => <article key={card.id} className="border border-slate-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="font-semibold">{studentName(card.studentId)} · {data.terms.find(row => row.id === card.termId)?.name} · Version {card.version}</h3><p className="mt-1 text-sm text-slate-500">{words(card.status)} · Overall {card.overallPercentage ?? "—"}% · GPA {card.gpa ?? "—"}</p></div><Link href={`/reports/${card.id}`} className="text-sm font-semibold text-blue-700">Open report</Link></div><ul className="mt-2 text-sm">{data.reportSubjects.filter(row => row.reportCardId === card.id).map(row => <li key={row.id}>{subjectName(row.subjectId)}: {row.scorePercentage}% ({row.letterGrade})</li>)}</ul>{card.status === "draft" && <form className="mt-3 space-y-2" onSubmit={event => submit(event, form => ({ kind: "report_remarks", reportCardId: card.id, teacherRemarks: str(form, "remarks") }))}><label className="block text-sm font-medium">Teacher remarks<textarea className={`${inputStyle} min-h-24`} name="remarks" defaultValue={card.teacherRemarks ?? ""} maxLength={5000} /></label><button className={secondary} disabled={pending}>Save remarks</button></form>}</article>)}{!data.reports.length && <p className="text-sm text-slate-500">No report cards for your homeroom classes yet.</p>}</div></Card></div>}
        {current.id === "behaviour" && (
          <TeacherBehaviourPanel
            classes={data.classes}
            students={data.students}
            enrollments={data.enrollments}
            behaviours={data.behaviours ?? []}
            defaultDate={date}
            pending={pending}
            onSave={save}
          />
        )}
        {current.id === "inquiries" && (
          <StaffInquiryList
            inquiries={data.inquiries ?? []}
            title="Guardian Inquiries"
            description="Two-way messages and inquiries submitted by verified guardians of students in your assigned classes."
            onOpenStudentDrawer={(id) => setDrawerStudentId(id)}
          />
        )}
        {current.id === "notices" && <TeacherClassAnnouncement classes={data.classes} pending={pending} onSave={save} />}
        {current.id === "notices" && <Card title="Published school notices">{notices.map(notice => <article key={notice.id} className="border-b border-slate-100 py-4"><div className="flex justify-between gap-3"><h3 className="font-semibold">{notice.title}</h3><span className="text-xs text-slate-500">{words(notice.priority)}</span></div><p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{notice.content}</p></article>)}{!notices.length && <p className="text-sm text-slate-500">No published notices for your classes.</p>}</Card>}
      </main></div>
    {drawerStudent && (
      <StudentAcademicDrawer
        student={drawerStudent}
        classPlacement={drawerStudentPlacement}
        academicYears={data.currentYear ? [data.currentYear] : []}
        classes={data.classes}
        gradeLevels={data.gradeLevels}
        subjects={data.subjects}
        terms={data.terms}
        enrollments={data.enrollments}
        reports={drawerStudentReports}
        reportSubjects={drawerStudentReportSubjects}
        historyMarks={drawerStudentMarks}
        behaviours={drawerStudentBehaviours}
        timetablePeriods={drawerStudentTimetable}
        guardians={drawerStudentGuardians}
        safetyNotices={drawerStudentSafety}
        onClose={() => setDrawerStudentId(null)}
      />
    )}
  </div>;
}
