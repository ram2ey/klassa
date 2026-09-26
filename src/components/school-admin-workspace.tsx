"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BookOpen, CalendarDays, Check, ChevronRight, ClipboardList, FileClock, GraduationCap, Megaphone, ShieldAlert, NotebookPen, ClipboardCheck,
  LayoutDashboard, Menu, Plus, Search, Settings, Users, UsersRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AccountSignOut } from "@/components/account-sign-out";
import { formatGMTDateTime, SCHOOL_TIME_ZONE, SCHOOL_TIME_ZONE_LABEL } from "@/lib/timezone";
import { removeSchoolStaffAccessAction, saveSchoolRecordAction } from "@/app/actions/school-admin-actions";
import { provisionStaffForCurrentSchoolAction } from "@/app/actions/school-access-actions";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import type { SchoolWorkflowData } from "@/lib/school-workflow-data";
import { SchoolAdminWorkflows } from "@/components/school-admin-workflows";
import { StudentCsvImport } from "@/components/student-csv-import";
import { StudentEnrollmentFlow } from "@/components/student-enrollment-flow";
import { SchoolAdminStudentDirectory } from "@/components/school-admin-student-directory";
import { GuardianPortalAccess } from "@/components/guardian-portal-access";
import type { SchoolCommand } from "@/lib/school-admin-policy";

const sections = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "students", label: "Students", icon: GraduationCap },
  { id: "guardians", label: "Guardians", icon: UsersRound },
  { id: "staff", label: "Staff & access", icon: Users },
  { id: "classes", label: "Classes & grades", icon: ClipboardList },
  { id: "subjects", label: "Subjects", icon: BookOpen },
  { id: "academic", label: "Academic years", icon: CalendarDays },
  { id: "attendance", label: "Attendance", icon: ClipboardCheck },
  { id: "gradebook", label: "Gradebook", icon: NotebookPen },
  { id: "reports", label: "Report cards", icon: FileClock },
  { id: "communications", label: "Communications", icon: Megaphone },
  { id: "sensitive", label: "Sensitive records", icon: ShieldAlert },
  { id: "audit", label: "Audit history", icon: FileClock },
  { id: "settings", label: "School settings", icon: Settings },
] as const;
const roles = ["school_admin", "office_staff", "teacher", "safeguarding_lead", "senco", "health_nurse"] as const;
const fieldStyle = "mt-1.5 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600";
const panelStyle = "border border-slate-200 bg-white";
const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
type Editor = { kind: Exclude<SchoolCommand["kind"], "teacher_subject_assignment_remove"> | "staff"; title: string; values?: Record<string, string | number | boolean | null> };
type Option = { value: string; label: string };
type Field = { name: string; label: string; type?: "text" | "date" | "email" | "password" | "number" | "checkbox"; required?: boolean; options?: Option[]; hint?: string; max?: number; min?: number; disabled?: boolean };

export function SchoolAdminWorkspace({ data, workflow, section, date: selectedDate }: { data: SchoolAdminData; workflow?: SchoolWorkflowData; section: string; date?: string }) {
  const current = sections.find(item => item.id === section) ?? sections[0];
  const [query, setQuery] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [notice, setNotice] = useState("");
  const currentYear = data.years.find(year => year.isCurrent);
  const date = (value: string | Date) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: SCHOOL_TIME_ZONE }).format(new Date(value));
  const matches = (...values: unknown[]) => values.join(" ").toLowerCase().includes(query.toLowerCase());
  const yearName = (id: string) => data.years.find(year => year.id === id)?.name ?? "Unknown year";
  const gradeName = (id: string) => data.grades.find(grade => grade.id === id)?.name ?? "Unknown grade";
  const studentName = (id: string) => { const student = data.students.find(student => student.id === id); return student ? `${student.firstName} ${student.lastName}` : "Unknown student"; };
  const guardianName = (id: string) => { const guardian = data.guardians.find(guardian => guardian.id === id); return guardian ? `${guardian.firstName} ${guardian.lastName}` : "Unknown guardian"; };
  const edit = (kind: Editor["kind"], title: string, values?: Editor["values"]) => setEditor({ kind, title, values });
  const add = (kind: Editor["kind"], title: string) => <Button aria-label={title} className="min-h-11" onClick={() => edit(kind, title)}><Plus size={16} />{title}</Button>;
  const editButton = (kind: Editor["kind"], title: string, values: NonNullable<Editor["values"]>) => <Button variant="secondary" aria-label={title} className="min-h-11" onClick={() => edit(kind, title, values)}>Edit</Button>;

  return <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[240px_minmax(0,1fr)]">
    <a href="#school-content" className="sr-only z-50 bg-white p-3 focus:not-sr-only focus:fixed">Skip to content</a>
    <aside className="border-b border-slate-200 bg-slate-950 text-slate-300 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0">
      <div className="flex min-h-20 items-center justify-between border-b border-white/10 px-5">
        <Link href="/" className="flex items-center gap-3 text-white"><span className="grid h-9 w-9 place-items-center bg-blue-600 text-lg font-bold">K</span><span><span className="block text-lg font-bold">Klassa</span><span className="block text-[10px] font-semibold uppercase tracking-[.16em] text-slate-400">School workspace</span></span></Link>
        <button className="grid h-11 w-11 place-items-center lg:hidden" aria-label={mobileNav ? "Close navigation" : "Open navigation"} aria-expanded={mobileNav} aria-controls="school-nav" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
      </div>
      <nav id="school-nav" aria-label="School navigation" className={`${mobileNav ? "block" : "hidden"} flex-1 p-3 lg:block`}>
        <p className="px-3 pb-2 pt-4 text-[10px] font-semibold uppercase tracking-[.15em] text-slate-500">Your school</p>
        {sections.map(item => { const Icon = item.icon; return <Link key={item.id} href={`/?section=${item.id}`} aria-current={current.id === item.id ? "page" : undefined} onClick={() => { setQuery(""); setMobileNav(false); setNotice(""); }} className={`mb-1 flex min-h-11 items-center gap-3 px-3 text-sm font-medium ${current.id === item.id ? "bg-blue-600 text-white" : "hover:bg-white/5 hover:text-white"}`}><Icon size={18} /><span className="flex-1">{item.label}</span>{current.id === item.id && <ChevronRight size={14} />}</Link>; })}
      </nav>
      <div className="hidden border-t border-white/10 p-5 lg:block"><p className="text-sm font-semibold text-white">{data.actor.name}</p><p className="mt-1 text-xs text-slate-400">School administrator</p><Link href="/schools" className="mt-4 inline-flex min-h-11 items-center text-xs text-blue-300 hover:text-white">Switch school <ChevronRight size={14} /></Link></div>
    </aside>

    <div className="min-w-0">
      <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
        <div><p className="text-[10px] font-semibold uppercase tracking-[.14em] text-blue-700">{currentYear?.name ?? "Academic year not set"}</p><p className="mt-1 font-bold">{data.school.name}</p></div>
        <div className="flex items-center gap-3"><span className="hidden border border-slate-200 px-3 py-1.5 text-xs text-slate-600 sm:inline">Tenant: {data.school.slug}</span><Link href="/schools" className="text-xs text-blue-700 lg:hidden">Switch school</Link><AccountSignOut /></div>
      </header>
      <main id="school-content" className="mx-auto max-w-[1500px] space-y-6 p-4 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium text-slate-500">School administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight">{current.label}</h1></div>
          {!["overview", "settings", "attendance", "gradebook", "reports", "communications", "sensitive"].includes(current.id) && <label className="relative block"><span className="sr-only">Search {current.label}</span><Search size={16} className="absolute left-3 top-3.5 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${current.label.toLowerCase()}`} className="min-h-11 w-72 max-w-full border border-slate-300 bg-white pl-9 pr-3 text-sm" /></label>}
        </div>
        {notice && <div role="status" className="flex items-start justify-between gap-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={18} /></button></div>}
        {workflow && ["attendance", "gradebook", "reports", "communications", "sensitive"].includes(current.id) && <SchoolAdminWorkflows section={current.id} date={selectedDate ?? new Date().toISOString().slice(0, 10)} base={data} data={workflow} />}

        {current.id === "overview" && <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Students" value={data.students.length} detail={`${data.students.filter(student => student.status === "active").length} active students`} icon={<GraduationCap size={22} />} />
            <Metric label="Staff" value={data.staff.length} detail={`${data.staff.filter(member => member.role === "teacher").length} teachers`} icon={<Users size={22} />} />
            <Metric label="Classes" value={data.classes.filter(item => item.academicYearId === currentYear?.id).length} detail={currentYear?.name ?? "Choose a current academic year"} icon={<ClipboardList size={22} />} />
            <Metric label="Guardians" value={data.guardians.length} detail={`${new Set(data.links.map(link => link.studentId)).size} students with linked guardians`} icon={<UsersRound size={22} />} />
          </div>
          <div className="grid gap-6 xl:grid-cols-[1fr_1.4fr]">
            <section className={panelStyle}><PanelHeading title="School setup" description="Build the foundations for your school year." />
              <div className="divide-y divide-slate-100">{[
                { label: "Set the current academic year", done: !!currentYear, section: "academic" },
                { label: "Add grades and classes", done: data.classes.some(item => item.academicYearId === currentYear?.id), section: "classes" },
                { label: "Create staff accounts", done: data.staff.length > 1, section: "staff" },
                { label: "Enroll your students", done: data.students.length > 0, section: "students" },
                { label: "Link guardian contacts", done: data.links.length > 0, section: "guardians" },
              ].map((step, index) => <Link href={`/?section=${step.section}`} key={step.section} className="flex min-h-16 items-center gap-3 px-5 py-3 hover:bg-slate-50"><span className={`grid h-7 w-7 shrink-0 place-items-center text-xs font-bold ${step.done ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>{step.done ? <Check size={16} aria-label="Complete" /> : index + 1}</span><span className="flex-1 text-sm font-medium">{step.label}</span><ChevronRight size={16} className="text-slate-400" /></Link>)}</div>
            </section>
            <section className={panelStyle}><PanelHeading title="Recent activity" description="The latest changes made in your school." action={<Link className="text-xs font-semibold text-blue-700" href="/?section=audit">View history</Link>} />
              {data.audit.length ? <div className="divide-y divide-slate-100">{data.audit.slice(0, 6).map(event => <div key={event.id} className="flex items-start gap-3 px-5 py-4"><FileClock size={18} className="mt-0.5 shrink-0 text-slate-400" /><div className="min-w-0 flex-1"><p className="text-sm font-semibold">{words(event.action.replaceAll(".", " "))}</p><p className="mt-1 text-xs text-slate-500">{event.actorName ?? "System"}</p></div><span className="text-xs text-slate-500">{date(event.createdAt)}</span></div>)}</div> : <Empty text="Your school's activity will appear here as you set things up." />}
            </section>
          </div>
          <section className={`${panelStyle} flex flex-wrap items-center justify-between gap-4 p-5`}><div><h2 className="font-bold">Ready for the next school day</h2><p className="mt-1 text-sm text-slate-500">Keep your student directory, class assignments and contact records up to date.</p></div><Link href="/?section=students" className="inline-flex min-h-11 items-center gap-2 bg-blue-700 px-4 text-sm font-semibold text-white">Open student directory <ChevronRight size={16} /></Link></section>
        </>}

        {current.id === "students" && <div className="space-y-6">
          <SchoolAdminStudentDirectory data={data} query={query} currentYearId={currentYear?.id} onEnroll={() => setShowEnrollment(true)}
            onEdit={(student, classId) => edit("student", `Edit ${student.firstName} ${student.lastName}`, { id: student.id, firstName: student.firstName, lastName: student.lastName, dateOfBirth: student.dateOfBirth, status: student.status, classId })} />
          <StudentCsvImport />
        </div>}

        {current.id === "guardians" && <div className="space-y-6"><section className={panelStyle}><PanelHeading title="Guardian contacts" description="Contact records for parents and guardians." action={add("guardian", "Add guardian")} />
          <DataTable caption="Guardian contacts" headers={["Name", "Email", "Phone", "Linked students", "Actions"]} rows={data.guardians.filter(guardian => matches(guardian.firstName, guardian.lastName, guardian.email, guardian.phone)).map(guardian => ({ key: guardian.id, cells: [<strong key="name">{guardian.firstName} {guardian.lastName}</strong>, guardian.email ?? "Not provided", guardian.phone ?? "Not provided", data.links.filter(link => link.guardianId === guardian.id).map(link => studentName(link.studentId)).join(", ") || "None linked", <div key="actions" className="flex flex-wrap gap-2">{editButton("guardian", `Edit ${guardian.firstName} ${guardian.lastName}`, { id: guardian.id, firstName: guardian.firstName, lastName: guardian.lastName, email: guardian.email, phone: guardian.phone })}<GuardianPortalAccess guardianId={guardian.id} guardianName={`${guardian.firstName} ${guardian.lastName}`} enabled={!!guardian.userId} eligible={data.links.some(link => link.guardianId === guardian.id && link.hasLegalResponsibility)} /></div>] }))} empty="No guardian contacts match this view." />
        </section><section className={panelStyle}><PanelHeading title="Student relationships" description="Set each contact's relationship and responsibility for a student." action={add("guardian_link", "Link guardian")} />
          <DataTable caption="Student guardian relationships" headers={["Student", "Guardian", "Relationship", "Primary contact", "Legal responsibility", "Actions"]} rows={data.links.filter(link => matches(studentName(link.studentId), guardianName(link.guardianId))).map(link => ({ key: link.id, cells: [studentName(link.studentId), guardianName(link.guardianId), words(link.relationship), link.isPrimary ? "Yes" : "No", link.hasLegalResponsibility ? "Yes" : "No", editButton("guardian_link", "Edit relationship", { studentId: link.studentId, guardianId: link.guardianId, relationship: link.relationship, isPrimary: link.isPrimary, hasLegalResponsibility: link.hasLegalResponsibility })] }))} empty="Add a student and a guardian, then link them here." />
        </section></div>}

        {current.id === "staff" && <section className={panelStyle}><PanelHeading title="Staff directory" description="Create accounts, review sign-in security, and manage school access." action={add("staff", "Create staff account")} />
          <DataTable caption="School staff" headers={["Name", "Login tenant / username", "School role", "Account setup", "Two-factor", "Actions"]} rows={data.staff.filter(member => matches(member.name, member.username, member.role)).map(member => ({ key: member.id, cells: [<strong key="name">{member.name}{member.userId === data.actor.userId && <span className="ml-2 text-xs font-normal text-slate-500">You</span>}</strong>, member.username?.replace(":", " / ") ?? "Not assigned", words(member.role), <Status key="setup" value={member.mustChangePassword ? "password change due" : "ready"} />, <Status key="mfa" value={member.twoFactorEnabled ? "enabled" : "not enabled"} />, member.userId === data.actor.userId ? <span key="own" className="text-xs text-slate-500">Your account</span> : <div key="actions" className="flex flex-wrap gap-2">{editButton("staff_role", `Change role for ${member.name}`, { membershipId: member.id, role: member.role })}<StaffAccessAction membershipId={member.id} staffName={member.name} /></div>] }))} empty="No staff match your search." />
        </section>}

        {current.id === "classes" && <div className="space-y-6"><section className={panelStyle}><PanelHeading title="Classes" description="Organize classes by year and grade, and assign homeroom teachers." action={add("class", "Add class")} />
          <DataTable caption="School classes" headers={["Class", "Grade", "Academic year", "Homeroom teacher", "Students", "Actions"]} rows={data.classes.filter(item => matches(item.name, gradeName(item.gradeLevelId), yearName(item.academicYearId))).map(item => ({ key: item.id, cells: [<strong key="name">{item.name}</strong>, gradeName(item.gradeLevelId), yearName(item.academicYearId), data.staff.find(member => member.userId === item.homeroomTeacherId)?.name ?? "Not assigned", data.enrollments.filter(enrollment => enrollment.classId === item.id && ["active", "pending"].includes(enrollment.status)).length, editButton("class", `Edit class ${item.name}`, { id: item.id, name: item.name, academicYearId: item.academicYearId, gradeLevelId: item.gradeLevelId, homeroomTeacherId: item.homeroomTeacherId })] }))} empty="Create an academic year and a grade, then add your first class." />
        </section><section className={panelStyle}><PanelHeading title="Subject teachers" description="Assign teachers to a class and subject so they can manage its gradebook." action={add("teacher_subject_assignment", "Assign subject teacher")} />
          <DataTable caption="Subject teacher assignments" headers={["Class", "Academic year", "Subject", "Teacher", "Actions"]} rows={data.assignments.filter(item => item.subjectId && matches(data.classes.find(klass => klass.id === item.classId)?.name, data.subjects.find(subject => subject.id === item.subjectId)?.name, data.staff.find(member => member.userId === item.teacherId)?.name)).map(item => { const klass = data.classes.find(row => row.id === item.classId); const subject = data.subjects.find(row => row.id === item.subjectId); const teacher = data.staff.find(row => row.userId === item.teacherId); const label = `${teacher?.name ?? "Teacher"} · ${subject?.name ?? "Subject"} · ${klass?.name ?? "Class"}`; return { key: item.id, cells: [klass?.name ?? "Class", klass ? yearName(klass.academicYearId) : "Unknown year", subject?.name ?? "Subject", teacher?.name ?? "Teacher", <div key="actions" className="flex flex-wrap gap-2">{editButton("teacher_subject_assignment", `Edit ${label}`, { id: item.id, classId: item.classId, subjectId: item.subjectId, teacherId: item.teacherId })}<SubjectAssignmentRemove assignmentId={item.id} label={label} onRemoved={() => setNotice("Subject teacher assignment removed.")} /></div>] }; })} empty="No subject teachers assigned yet. Add a class, subject, and teacher first." />
        </section><section className={panelStyle}><PanelHeading title="Grade levels" description="The grade levels offered by your school." action={add("grade", "Add grade")} />
          <DataTable caption="Grade levels" headers={["Grade", "Sort order", "Actions"]} rows={data.grades.filter(grade => matches(grade.name)).map(grade => ({ key: grade.id, cells: [grade.name, grade.position, editButton("grade", `Edit ${grade.name}`, { id: grade.id, name: grade.name, position: grade.position })] }))} empty="Add your school's grade levels." />
        </section></div>}

        {current.id === "subjects" && <section className={panelStyle}><PanelHeading title="Subject catalog" description="Subjects offered across your school." action={add("subject", "Add subject")} />
          <DataTable caption="Subjects" headers={["Code", "Subject", "Department", "Actions"]} rows={data.subjects.filter(subject => matches(subject.name, subject.code, subject.department)).map(subject => ({ key: subject.id, cells: [subject.code, <strong key="name">{subject.name}</strong>, subject.department ?? "Not specified", editButton("subject", `Edit ${subject.name}`, { id: subject.id, name: subject.name, code: subject.code, department: subject.department })] }))} empty="No subjects match this view. Add your first subject to build the catalog." />
        </section>}

        {current.id === "academic" && <div className="space-y-6"><section className={panelStyle}><PanelHeading title="Academic years" description="The current year is used for student enrollment and class placement." action={add("year", "Add academic year")} />
          <DataTable caption="Academic years" headers={["Year", "Starts", "Ends", "Status", "Actions"]} rows={data.years.filter(year => matches(year.name)).map(year => ({ key: year.id, cells: [<strong key="name">{year.name}</strong>, date(year.startsOn), date(year.endsOn), <Status key="status" value={year.isCurrent ? "current" : "not current"} />, editButton("year", `Edit ${year.name}`, { id: year.id, name: year.name, startsOn: year.startsOn, endsOn: year.endsOn, isCurrent: year.isCurrent })] }))} empty="Add an academic year and mark it current to begin school setup." />
        </section><section className={panelStyle}><PanelHeading title="Terms" description="Term dates must be within their academic year." action={add("term", "Add term")} />
          <DataTable caption="Academic terms" headers={["Term", "Academic year", "Starts", "Ends", "Order", "Actions"]} rows={data.terms.filter(term => matches(term.name, yearName(term.academicYearId))).map(term => ({ key: term.id, cells: [term.name, yearName(term.academicYearId), date(term.startsOn), date(term.endsOn), term.position, editButton("term", `Edit ${term.name}`, { id: term.id, name: term.name, academicYearId: term.academicYearId, startsOn: term.startsOn, endsOn: term.endsOn, position: term.position })] }))} empty="Create an academic year, then add its terms." />
        </section></div>}

        {current.id === "audit" && <section className={panelStyle}><PanelHeading title="School audit history" description="The latest 100 recorded events for this school, newest first." />
          <DataTable caption="School audit history" headers={["Event", "Actor", "Record type", "Record ID", "Time"]} rows={data.audit.filter(event => matches(event.action, event.actorName, event.entityType, event.entityId)).map(event => ({ key: event.id, cells: [event.action, event.actorName ?? "System", words(event.entityType), <span key="id" className="break-all font-mono text-xs">{event.entityId}</span>, formatGMTDateTime(event.createdAt)] }))} empty="No audit events match this view." />
        </section>}

        {current.id === "settings" && <section className={`${panelStyle} max-w-3xl`}><PanelHeading title="School details" description="Manage your school's name. The timezone is fixed at GMT." action={<Button variant="secondary" className="min-h-11" onClick={() => edit("settings", "Edit school settings", { name: data.school.name })}>Edit settings</Button>} />
          <dl className="grid gap-6 p-5 sm:grid-cols-2">{[["School name", data.school.name], ["Tenant ID", data.school.slug], ["Timezone", SCHOOL_TIME_ZONE_LABEL], ["Current academic year", currentYear?.name ?? "Not set"]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt><dd className="mt-2 font-medium">{value}</dd></div>)}</dl>
          <p className="border-t border-slate-200 px-5 py-4 text-sm text-slate-500">Your tenant ID is used to sign in. Contact your platform administrator if it needs to change.</p>
        </section>}
      </main>
    </div>
    {editor && <RecordEditor editor={editor} data={data} onClose={() => setEditor(null)} onSaved={message => { setNotice(message); setEditor(null); }} />}
    {showEnrollment && <StudentEnrollmentFlow classes={data.classes.filter(item => item.academicYearId === currentYear?.id).map(item => ({ id: item.id, label: `${gradeName(item.gradeLevelId)} / ${item.name}` }))}
      existingGuardians={data.guardians.map(item => ({ id: item.id, label: `${item.firstName} ${item.lastName}${item.email ? ` · ${item.email}` : ""}` }))}
      onClose={() => setShowEnrollment(false)} onSaved={message => { setNotice(message); setShowEnrollment(false); }} />}
  </div>;
}

function SubjectAssignmentRemove({ assignmentId, label, onRemoved }: { assignmentId: string; label: string; onRemoved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <span className="inline-flex flex-col items-start gap-1"><Button variant="secondary" aria-label={`Remove ${label}`} className="min-h-11 border-red-200 text-red-800 hover:bg-red-50" disabled={pending}
    onClick={() => {
      if (!window.confirm(`Remove the subject teacher assignment for ${label}?`)) return;
      setError("");
      startTransition(async () => {
        const result = await saveSchoolRecordAction({ kind: "teacher_subject_assignment_remove", id: assignmentId });
        if (!result.success) { setError(result.error); return; }
        onRemoved();
        router.refresh();
      });
    }}>Remove</Button>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</span>;
}

function StaffAccessAction({ membershipId, staffName }: { membershipId: string; staffName: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  return <span className="inline-flex flex-col items-start gap-1"><Button variant="secondary" className="min-h-11 border-red-200 text-red-800 hover:bg-red-50" disabled={pending}
    onClick={() => {
      if (!window.confirm(`Remove ${staffName}'s access to this school? Their school session will end. Their account and access to any other school will remain.`)) return;
      setMessage("");
      startTransition(async () => {
        const result = await removeSchoolStaffAccessAction(membershipId);
        if (!result.success) { setMessage(result.error); return; }
        setMessage("School access removed.");
        router.refresh();
      });
    }}>{pending ? "Removing…" : "Remove access"}</Button>{message && <span role="status" className="max-w-48 text-xs text-slate-600">{message}</span>}</span>;
}

function Metric({ label, value, detail, icon }: { label: string; value: number; detail: string; icon: ReactNode }) {
  return <article className={`${panelStyle} p-5`}><div className="flex justify-between gap-3"><div><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h2><p className="mt-3 text-3xl font-bold tabular-nums">{value}</p></div><span className="grid h-11 w-11 place-items-center bg-blue-50 text-blue-700">{icon}</span></div><p className="mt-3 text-xs text-slate-500">{detail}</p></article>;
}
function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5"><div><h2 className="font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action}</div>;
}
function Empty({ text }: { text: string }) { return <p className="px-6 py-12 text-center text-sm text-slate-500">{text}</p>; }
function Status({ value }: { value: string }) {
  const ready = ["active", "ready", "current"].includes(value);
  const pending = ["pending", "password change due"].includes(value);
  return <span className={`inline-block whitespace-nowrap border px-2 py-1 text-xs font-medium ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : pending ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{words(value)}</span>;
}
function DataTable({ caption, headers, rows, empty }: { caption: string; headers: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{headers.map(header => <th scope="col" className="whitespace-nowrap px-5 py-3 font-semibold" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.key} className="hover:bg-slate-50/70">{row.cells.map((cell, index) => <td key={headers[index]} className="px-5 py-3.5 align-middle">{cell}</td>)}</tr>)}</tbody></table></div>;
}

function RecordEditor({ editor, data, onClose, onSaved }: { editor: Editor; data: SchoolAdminData; onClose: () => void; onSaved: (message: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => { dialog.current?.showModal(); }, []);
  const year = data.years.find(year => year.isCurrent);
  const yearOptions = data.years.map(year => ({ value: year.id, label: year.name }));
  const fields: Record<Editor["kind"], Field[]> = {
    student: [{ name: "firstName", label: "First name", required: true, max: 100 }, { name: "lastName", label: "Last name", required: true, max: 100 }, { name: "dateOfBirth", label: "Date of birth", type: "date", required: true }, { name: "status", label: "Status", options: ["pending", "active", "withdrawn", "graduated"].map(value => ({ value, label: words(value) })) }, { name: "classId", label: "Class in current year", required: !editor.values?.id, options: [{ value: "", label: editor.values?.id ? "Keep current placement" : "Choose a class" }, ...data.classes.filter(item => item.academicYearId === year?.id).map(item => ({ value: item.id, label: `${data.grades.find(grade => grade.id === item.gradeLevelId)?.name} / ${item.name}` }))], hint: "Add grades and classes in Classes & grades if none are available. Student numbers are assigned automatically." }],
    guardian: [{ name: "firstName", label: "First name", required: true, max: 100 }, { name: "lastName", label: "Last name", required: true, max: 100 }, { name: "email", label: "Email (optional)", type: "email", max: 254 }, { name: "phone", label: "Phone (optional)", max: 40 }],
    guardian_link: [{ name: "studentId", label: "Student", required: true, disabled: !!editor.values, options: data.students.map(student => ({ value: student.id, label: `${student.firstName} ${student.lastName} (${student.studentNumber})` })) }, { name: "guardianId", label: "Guardian", required: true, disabled: !!editor.values, options: data.guardians.map(guardian => ({ value: guardian.id, label: `${guardian.firstName} ${guardian.lastName}` })) }, { name: "relationship", label: "Relationship", options: ["parent", "guardian", "foster_carer", "other"].map(value => ({ value, label: words(value) })) }, { name: "isPrimary", label: "Primary contact for this student", type: "checkbox", hint: "Selecting this replaces the student's previous primary contact." }, { name: "hasLegalResponsibility", label: "Has legal responsibility", type: "checkbox" }],
    grade: [{ name: "name", label: "Grade name", required: true, max: 80 }, { name: "position", label: "Sort order", type: "number", required: true, min: 0, max: 100 }],
    class: [{ name: "name", label: "Class name", required: true, max: 80 }, { name: "academicYearId", label: "Academic year", required: true, disabled: !!editor.values?.id, options: yearOptions }, { name: "gradeLevelId", label: "Grade", required: true, options: data.grades.map(grade => ({ value: grade.id, label: grade.name })) }, { name: "homeroomTeacherId", label: "Homeroom teacher", options: [{ value: "", label: "Not assigned" }, ...data.staff.filter(member => member.role === "teacher" || member.role === "school_admin").map(member => ({ value: member.userId, label: member.name }))] }],
    teacher_subject_assignment: [{ name: "classId", label: "Class", required: true, options: data.classes.map(item => ({ value: item.id, label: `${data.grades.find(grade => grade.id === item.gradeLevelId)?.name ?? "Grade"} / ${item.name} · ${data.years.find(year => year.id === item.academicYearId)?.name ?? "Year"}` })) },
      { name: "subjectId", label: "Subject", required: true, options: data.subjects.map(subject => ({ value: subject.id, label: subject.name })) },
      { name: "teacherId", label: "Teacher", required: true, options: data.staff.filter(member => member.role === "teacher").map(member => ({ value: member.userId, label: member.name })) }],
    subject: [{ name: "code", label: "Subject code", required: true, max: 30 }, { name: "name", label: "Subject name", required: true, max: 100 }, { name: "department", label: "Department (optional)", max: 80 }],
    year: [{ name: "name", label: "Academic year name", required: true, max: 50 }, { name: "startsOn", label: "Start date", type: "date", required: true }, { name: "endsOn", label: "End date", type: "date", required: true }, { name: "isCurrent", label: "Use as the current academic year", type: "checkbox", hint: "Only one academic year can be current. Existing enrollments stay in their original year." }],
    term: [{ name: "name", label: "Term name", required: true, max: 80 }, { name: "academicYearId", label: "Academic year", required: true, disabled: !!editor.values?.id, options: yearOptions }, { name: "startsOn", label: "Start date", type: "date", required: true }, { name: "endsOn", label: "End date", type: "date", required: true }, { name: "position", label: "Term order", type: "number", required: true, min: 1, max: 20 }],
    settings: [{ name: "name", label: "School name", required: true, max: 180 }],
    staff_role: [{ name: "role", label: "School role", options: roles.map(role => ({ value: role, label: words(role) })), hint: "This changes access within this school immediately." }],
    staff: [{ name: "administratorName", label: "Full name", required: true, min: 2, max: 180 }, { name: "username", label: "Username", required: true, min: 3, max: 64, hint: `The sign-in tenant ID is ${data.school.slug}.` }, { name: "role", label: "School role", options: roles.map(role => ({ value: role, label: words(role) })) }, { name: "temporaryPassword", label: "Temporary password", type: "password", required: true, min: 12, max: 128, hint: "Share securely. The user must change it at first sign-in." }],
  };
  const selectedFields = fields[editor.kind];
  const defaults: Record<string, string | number | boolean> = { status: "pending", position: 1, relationship: "parent", role: "office_staff", academicYearId: year?.id ?? "", isCurrent: !year };
  const missingPrerequisite = selectedFields.some(field => field.required && field.options && field.options.every(option => !option.value));
  return <dialog ref={dialog} aria-labelledby="record-editor-title" onCancel={event => { if (pending) event.preventDefault(); else onClose(); }} className="fixed inset-0 m-auto max-h-[90dvh] w-[min(560px,calc(100%_-_32px))] overflow-y-auto border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/40">
    <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-6 py-4"><h2 id="record-editor-title" className="text-lg font-bold">{editor.title}</h2><button type="button" disabled={pending} className="grid h-11 w-11 place-items-center" aria-label="Close form" onClick={onClose}><X size={20} /></button></div>
    <form className="space-y-5 p-6" onSubmit={event => {
      event.preventDefault(); setError("");
      const values = new FormData(event.currentTarget);
      const payload: Record<string, unknown> = { ...editor.values, ...Object.fromEntries(values), kind: editor.kind };
      for (const field of selectedFields) {
        if (field.disabled) continue;
        if (field.type === "checkbox") payload[field.name] = values.get(field.name) === "on";
        if (field.type === "number") payload[field.name] = Number(values.get(field.name));
      }
      startTransition(async () => {
        try {
          if (editor.kind === "staff") {
            const result = await provisionStaffForCurrentSchoolAction({ administratorName: String(payload.administratorName), username: String(payload.username), temporaryPassword: String(payload.temporaryPassword), role: payload.role as typeof roles[number] });
            onSaved(`Staff account created. Tenant ID: ${result.tenantId}. Username: ${result.username}. Share the temporary password securely.`);
          } else {
            const result = await saveSchoolRecordAction(payload as SchoolCommand);
            if (!result.success) { setError(result.error); return; }
            onSaved(`${editor.title.replace(/^Edit |^Add |^Change /, "")} saved.`);
          }
          router.refresh();
        } catch { setError(editor.kind === "staff" ? "The staff account could not be created. Check that the username is valid and not already used in this school." : "The change could not be saved. Refresh the page and check your access."); }
      });
    }}>
      {selectedFields.map(field => {
        const initial = editor.values?.[field.name] ?? defaults[field.name] ?? "";
        const inputId = `school-field-${field.name}`;
        return <div key={field.name}>
          {field.type === "checkbox" ? <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" name={field.name} defaultChecked={Boolean(initial)} className="h-4 w-4 accent-blue-700" disabled={pending} />{field.label}</label> : <><label htmlFor={inputId} className="block text-sm font-semibold">{field.label}</label>
            {field.options ? <select id={inputId} name={field.name} required={field.required} disabled={pending || field.disabled} defaultValue={String(initial || field.options[0]?.value || "")} className={fieldStyle} aria-describedby={field.hint ? `${inputId}-hint` : undefined}>{!field.options.length && <option value="">No options available</option>}{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : <input id={inputId} name={field.name} type={field.type ?? "text"} defaultValue={String(initial)} required={field.required} disabled={pending} min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined} minLength={field.type !== "number" ? field.min : undefined} maxLength={field.type !== "number" ? field.max : undefined} autoComplete={field.type === "password" ? "new-password" : undefined} className={fieldStyle} aria-describedby={field.hint ? `${inputId}-hint` : undefined} />}</>}
          {field.hint && <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-slate-500">{field.hint}</p>}
        </div>;
      })}
      {missingPrerequisite && <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Add the required school records first, then return to this form.</p>}
      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-slate-200 pt-5"><Button variant="secondary" className="min-h-11" type="button" disabled={pending} onClick={onClose}>Cancel</Button><Button className="min-h-11" type="submit" disabled={pending || missingPrerequisite}>{pending ? "Saving..." : "Save changes"}</Button></div>
    </form>
  </dialog>;
}
