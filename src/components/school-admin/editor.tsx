"use client";
import { type Editor, type Field, words, roles, fieldStyle } from "./shared";
import { type SchoolAdminData } from "@/lib/school-admin-data";
import { useRef, useTransition, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { provisionStaffForCurrentSchoolAction } from "@/app/actions/school-access-actions";
import { saveSchoolRecordAction } from "@/app/actions/school-admin-actions";
import { type SchoolCommand } from "@/lib/school-admin-policy";
import { Button } from "@/components/ui/button";

export function RecordEditor({ editor, data, onClose, onSaved }: { editor: Editor; data: SchoolAdminData; onClose: () => void; onSaved: (message: string) => void }) {
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
  return <dialog ref={dialog} aria-labelledby="record-editor-title" onCancel={event => { if (pending) event.preventDefault(); else onClose(); }} className="ui-overlay fixed inset-0 m-auto max-h-[90dvh] w-[min(560px,calc(100%_-_32px))] overflow-y-auto p-0">
    <div className="flex items-center justify-between gap-4 border-b border-line-subtle px-6 py-4"><h2 id="record-editor-title" className="text-lg font-bold">{editor.title}</h2><button type="button" disabled={pending} className="grid h-11 w-11 place-items-center" aria-label="Close form" onClick={onClose}><X size={20} /></button></div>
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
          {field.type === "checkbox" ? <label className="flex min-h-11 items-center gap-3 text-sm font-medium"><input type="checkbox" name={field.name} defaultChecked={Boolean(initial)} className="h-4 w-4 accent-primary" disabled={pending} />{field.label}</label> : <><label htmlFor={inputId} className="block text-sm font-semibold">{field.label}</label>
            {field.options ? <select id={inputId} name={field.name} required={field.required} disabled={pending || field.disabled} defaultValue={String(initial || field.options[0]?.value || "")} className={fieldStyle} aria-describedby={field.hint ? `${inputId}-hint` : undefined}>{!field.options.length && <option value="">No options available</option>}{field.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
              : <input id={inputId} name={field.name} type={field.type ?? "text"} defaultValue={String(initial)} required={field.required} disabled={pending} min={field.type === "number" ? field.min : undefined} max={field.type === "number" ? field.max : undefined} minLength={field.type !== "number" ? field.min : undefined} maxLength={field.type !== "number" ? field.max : undefined} autoComplete={field.type === "password" ? "new-password" : undefined} className={fieldStyle} aria-describedby={field.hint ? `${inputId}-hint` : undefined} />}</>}
          {field.hint && <p id={`${inputId}-hint`} className="mt-1.5 text-xs text-secondary">{field.hint}</p>}
        </div>;
      })}
      {missingPrerequisite && <p className="rounded-control border border-warning/20 bg-warning-subtle p-3 text-sm text-warning">Add the required school records first, then return to this form.</p>}
      {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">{error}</p>}
      <div className="flex justify-end gap-2 border-t border-line-subtle pt-5"><Button variant="secondary" className="min-h-11" type="button" disabled={pending} onClick={onClose}>Cancel</Button><Button className="min-h-11" type="submit" disabled={pending || missingPrerequisite}>{pending ? "Saving..." : "Save changes"}</Button></div>
    </form>
  </dialog>;
}
