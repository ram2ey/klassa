"use client";
import { AdministratorOverview } from "@/components/school-overviews";
import { GuardianDirectory } from "@/components/people-directories";
import { GuardianSmsPreferences } from "@/components/guardian-sms-preferences";
import { type SchoolAdminData } from "@/lib/school-admin-data";
import { type SchoolWorkflowData } from "@/lib/school-workflow-data";
import { type SchoolGdprData } from "@/lib/school-gdpr-data";
import { sections, type Editor, panelStyle, words } from "@/components/school-admin/shared";
import { useState } from "react";
import { SCHOOL_TIME_ZONE, formatGMTDateTime, SCHOOL_TIME_ZONE_LABEL } from "@/lib/timezone";
import { Button } from "@/components/ui/button";
import { Plus, X, Search, Lock, Unlock } from "lucide-react";
import { WorkspaceShell } from "@/components/workspace-shell";
import { groupWorkspaceNavigation } from "@/components/workspace-navigation";
import { SchoolAdminWorkflows } from "@/components/school-admin-workflows";
import { PanelHeading, DataTable, Status } from "@/components/school-admin/ui";
import { SchoolAdminStudentDirectory } from "@/components/school-admin-student-directory";
import { StudentCsvImport } from "@/components/student-csv-import";
import { GuardianPortalAccess } from "@/components/guardian-portal-access";
import { StaffAccessAction, SubjectAssignmentRemove, TermLockControl } from "@/components/school-admin/controls";
import { SchoolRolloverPanel } from "@/components/school-rollover-panel";
import { SchoolAdminGdprPanel } from "@/components/school-admin-gdpr-panel";
import { RecordEditor } from "@/components/school-admin/editor";
import { StudentEnrollmentFlow } from "@/components/student-enrollment-flow";

export function SchoolAdminWorkspace({ data, workflow, gdpr, section, date: selectedDate }: { data: SchoolAdminData; workflow?: SchoolWorkflowData; gdpr?: SchoolGdprData; section: string; date?: string }) {
  const current = sections.find(item => item.id === section) ?? sections[0];
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [notice, setNotice] = useState("");
  const currentYear = data.years.find(year => year.isCurrent);
  const date = (value: string | Date) => new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: SCHOOL_TIME_ZONE }).format(new Date(value));
  const matches = (...values: unknown[]) => values.join(" ").toLowerCase().includes(query.toLowerCase());
  const yearName = (id: string) => data.years.find(year => year.id === id)?.name ?? "Unknown year";
  const gradeName = (id: string) => data.grades.find(grade => grade.id === id)?.name ?? "Unknown grade";
  const studentName = (id: string) => { const student = data.students.find(student => student.id === id); return student ? `${student.firstName} ${student.lastName}` : "Unknown student"; };
  const guardianName = (id: string) => { const guardian = data.guardians.find(guardian => guardian.id === id); return guardian ? `${guardian.firstName} ${guardian.lastName}` : "Unknown guardian"; };
  const edit = (kind: Editor["kind"], title: string, values?: Editor["values"]) => setEditor({ kind, title, values });
  const add = (kind: Editor["kind"], title: string) => <Button aria-label={title} className="min-h-11" onClick={() => edit(kind, title)}><Plus size={16} />{title}</Button>;
  const editButton = (kind: Editor["kind"], title: string, values: NonNullable<Editor["values"]>) => <Button variant="secondary" aria-label={title} className="min-h-11" onClick={() => edit(kind, title, values)}>Edit</Button>;

  return <><WorkspaceShell schoolName={data.school.name} academicYear={currentYear?.name ?? "Academic year not set"} actorName={data.actor.name} roleLabel="School administrator" navigationLabel="School navigation" groups={groupWorkspaceNavigation(sections)} activeId={current.id} contentId="school-content" switchSchoolHref="/schools" onNavigate={() => { setQuery(""); setNotice(""); }}>

        {current.id !== "overview" && <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium text-secondary">School administration</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{current.label}</h1></div>
          {!["students", "guardians", "overview", "settings", "attendance", "gradebook", "reports", "behaviour", "communications", "sensitive"].includes(current.id) && <label className="relative block"><span className="sr-only">Search {current.label}</span><Search size={16} className="absolute left-3 top-3.5 text-muted" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder={`Search ${current.label.toLowerCase()}`} className="ui-field min-h-11 w-72 max-w-full pl-9 pr-3 text-sm" /></label>}
        </div>}
        {notice && <div role="status" className="flex items-start justify-between gap-4 border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800"><span>{notice}</span><button aria-label="Dismiss notification" onClick={() => setNotice("")}><X size={18} /></button></div>}
        {workflow && ["attendance", "gradebook", "reports", "behaviour", "communications", "sensitive"].includes(current.id) && <SchoolAdminWorkflows section={current.id} date={selectedDate ?? new Date().toISOString().slice(0, 10)} base={data} data={workflow} />}

        {current.id === "overview" && <AdministratorOverview data={data} onEnroll={() => setShowEnrollment(true)} />}

        {current.id === "students" && <div className="space-y-6">
          <SchoolAdminStudentDirectory data={data} query={query} onQueryChange={setQuery} currentYearId={currentYear?.id} onEnroll={() => setShowEnrollment(true)}
            onEdit={(student, classId) => edit("student", `Edit ${student.firstName} ${student.lastName}`, { id: student.id, firstName: student.firstName, lastName: student.lastName, dateOfBirth: student.dateOfBirth, status: student.status, classId })} />
          <StudentCsvImport />
        </div>}

        {current.id === "guardians" && <GuardianSmsPreferences staff profiles={data.guardians.filter(guardian => data.links.some(link => link.guardianId === guardian.id && link.hasLegalResponsibility)).map(guardian => ({
          guardianId: guardian.id, schoolId: data.school.id, label: `${guardian.firstName} ${guardian.lastName}`,
          announcements: data.smsPreferences.find(preference => preference.guardianId === guardian.id)?.announcements ?? true,
        }))} />}
        {current.id === "guardians" && <div className="space-y-6"><GuardianDirectory guardians={data.guardians} students={data.students} links={data.links} query={query} onQueryChange={setQuery} onAdd={() => edit("guardian", "Add guardian")} renderActions={id => { const guardian = data.guardians.find(row => row.id === id)!; return <>{editButton("guardian", `Edit ${guardian.firstName} ${guardian.lastName}`, { id: guardian.id, firstName: guardian.firstName, lastName: guardian.lastName, email: guardian.email, phone: guardian.phone })}<GuardianPortalAccess guardianId={guardian.id} guardianName={`${guardian.firstName} ${guardian.lastName}`} enabled={!!guardian.userId} eligible={data.links.some(link => link.guardianId === guardian.id && link.hasLegalResponsibility)} /></>; }} /><section className={panelStyle}><PanelHeading title="Student relationships" description="Set each contact's relationship and responsibility for a student." action={add("guardian_link", "Link guardian")} />
          <DataTable caption="Student guardian relationships" headers={["Student", "Guardian", "Relationship", "Primary contact", "Legal responsibility", "Actions"]} rows={data.links.filter(link => matches(studentName(link.studentId), guardianName(link.guardianId))).map(link => ({ key: link.id, cells: [studentName(link.studentId), guardianName(link.guardianId), words(link.relationship), link.isPrimary ? "Yes" : "No", link.hasLegalResponsibility ? "Yes" : "No", editButton("guardian_link", "Edit relationship", { studentId: link.studentId, guardianId: link.guardianId, relationship: link.relationship, isPrimary: link.isPrimary, hasLegalResponsibility: link.hasLegalResponsibility })] }))} empty="Add a student and a guardian, then link them here." />
        </section></div>}

        {current.id === "staff" && <section className={panelStyle}><PanelHeading title="Staff directory" description="Create accounts, review sign-in security, and manage school access." action={add("staff", "Create staff account")} />
          <DataTable caption="School staff" headers={["Name", "Login tenant / username", "School role", "Account setup", "Two-factor", "Actions"]} rows={data.staff.filter(member => matches(member.name, member.username, member.role)).map(member => ({ key: member.id, cells: [<strong key="name">{member.name}{member.userId === data.actor.userId && <span className="ml-2 text-xs font-normal text-secondary">You</span>}</strong>, member.username?.replace(":", " / ") ?? "Not assigned", words(member.role), <Status key="setup" value={member.mustChangePassword ? "password change due" : "ready"} />, <Status key="mfa" value={member.twoFactorEnabled ? "enabled" : "not enabled"} />, member.userId === data.actor.userId ? <span key="own" className="text-xs text-secondary">Your account</span> : <div key="actions" className="flex flex-wrap gap-2">{editButton("staff_role", `Change role for ${member.name}`, { membershipId: member.id, role: member.role })}<StaffAccessAction membershipId={member.id} staffName={member.name} /></div>] }))} empty="No staff match your search." />
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
        </section><section className={panelStyle}><PanelHeading title="Terms" description="Term dates must be within their academic year. Check attendance, grades and reports before closing. Unrecorded weekdays do not block closeout." action={add("term", "Add term")} />
          <DataTable caption="Academic terms" headers={["Term", "Academic year", "Starts", "Ends", "Status", "Actions"]} rows={data.terms.filter(term => matches(term.name, yearName(term.academicYearId))).map(term => {
            const isLocked = !!term.isLocked;
            return {
              key: term.id,
              cells: [
                <strong key="name">{term.name}</strong>,
                yearName(term.academicYearId),
                date(term.startsOn),
                date(term.endsOn),
                <span key="status" className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs font-semibold ${isLocked ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
                  {isLocked ? <Lock size={12} aria-hidden="true" /> : <Unlock size={12} aria-hidden="true" />}
                  {isLocked ? "Closed & Locked" : "Open"}
                </span>,
                <div key="actions" className="flex flex-wrap items-center gap-2">
                  {!isLocked && editButton("term", `Edit ${term.name}`, { id: term.id, name: term.name, academicYearId: term.academicYearId, startsOn: term.startsOn, endsOn: term.endsOn, position: term.position })}
                  <TermLockControl term={term} onUpdated={msg => setNotice(msg)} />
                </div>,
              ],
            };
          })} empty="Create an academic year, then add its terms." />
        </section><SchoolRolloverPanel data={data} /></div>}

        {current.id === "audit" && <section className={panelStyle}><PanelHeading title="School audit history" description="The latest 100 recorded events for this school, newest first." />
          <DataTable caption="School audit history" headers={["Event", "Actor", "Record type", "Record ID", "Time"]} rows={data.audit.filter(event => matches(event.action, event.actorName, event.entityType, event.entityId)).map(event => ({ key: event.id, cells: [event.action, event.actorName ?? "System", words(event.entityType), <span key="id" className="break-all font-mono text-xs">{event.entityId}</span>, formatGMTDateTime(event.createdAt)] }))} empty="No audit events match this view." />
        </section>}

        {current.id === "settings" && <div className="space-y-6"><section className={`${panelStyle} max-w-3xl`}><PanelHeading title="School details" description="Manage your school's name. The timezone is fixed at GMT." action={<Button variant="secondary" className="min-h-11" onClick={() => edit("settings", "Edit school settings", { name: data.school.name })}>Edit settings</Button>} />
          <dl className="grid gap-6 p-5 sm:grid-cols-2">{[["School name", data.school.name], ["Tenant ID", data.school.slug], ["Timezone", SCHOOL_TIME_ZONE_LABEL], ["Current academic year", currentYear?.name ?? "Not set"]].map(([label, value]) => <div key={label}><dt className="text-xs font-semibold uppercase tracking-wide text-secondary">{label}</dt><dd className="mt-2 font-medium">{value}</dd></div>)}</dl>
          <p className="border-t border-line-subtle px-5 py-4 text-sm text-secondary">Your tenant ID is used to sign in. Contact your platform administrator if it needs to change.</p>
        </section>{gdpr && <SchoolAdminGdprPanel data={gdpr} students={data.students} />}</div>}
    </WorkspaceShell>
    {editor && <RecordEditor editor={editor} data={data} onClose={() => setEditor(null)} onSaved={message => { setNotice(message); setEditor(null); }} />}
    {showEnrollment && <StudentEnrollmentFlow classes={data.classes.filter(item => item.academicYearId === currentYear?.id).map(item => ({ id: item.id, label: `${gradeName(item.gradeLevelId)} / ${item.name}` }))}
      existingGuardians={data.guardians.map(item => ({ id: item.id, label: `${item.firstName} ${item.lastName}${item.email ? ` · ${item.email}` : ""}` }))}
      onClose={() => setShowEnrollment(false)} onSaved={message => { setNotice(message); setShowEnrollment(false); }} />}
  </>;
}
