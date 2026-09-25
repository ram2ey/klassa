"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { enrollStudentAction } from "@/app/actions/student-enrollment-actions";
import type { EnrollmentInput } from "@/lib/student-enrollment";

type Choice = { id: string; label: string };
type GuardianDraft = { key: string; kind: "new" | "existing"; guardianId: string; firstName: string; lastName: string;
  email: string; phone: string; relationship: "parent" | "guardian" | "foster_carer" | "other";
  isPrimary: boolean; hasLegalResponsibility: boolean };
type Concern = EnrollmentInput["concerns"][number];

const steps = ["Student", "Guardians", "Concerns", "Review"];
const concerns: { value: Concern; label: string; help: string }[] = [
  { value: "safeguarding", label: "Safeguarding or pickup concern", help: "Refer for safeguarding review. A pickup restriction needs a separate verified record." },
  { value: "health_medical", label: "Health or medical support", help: "Refer to the appropriate health specialist." },
  { value: "special_needs", label: "Learning or additional support", help: "Refer for learning support review." },
  { value: "disciplinary", label: "Behaviour support", help: "Refer for follow-up and support." },
];
const field = "mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600";
const primary = "min-h-11 bg-blue-700 px-5 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 border border-slate-300 px-4 text-sm font-semibold text-slate-800 disabled:opacity-50";

function emptyGuardian(): GuardianDraft {
  return { key: crypto.randomUUID(), kind: "new", guardianId: "", firstName: "", lastName: "", email: "", phone: "",
    relationship: "parent", isPrimary: false, hasLegalResponsibility: false };
}

export function StudentEnrollmentFlow({ classes, existingGuardians, onClose, onSaved }: {
  classes: Choice[]; existingGuardians: Choice[]; onClose: () => void; onSaved: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const [student, setStudent] = useState({ firstName: "", lastName: "", dateOfBirth: "", classId: "", status: "pending" as "pending" | "active" });
  const [guardians, setGuardians] = useState<GuardianDraft[]>([]);
  const [selectedConcerns, setSelectedConcerns] = useState<Concern[]>([]);
  useEffect(() => { dialog.current?.showModal(); }, []);
  const updateGuardian = (key: string, patch: Partial<GuardianDraft>) => setGuardians(items => items.map(item => item.key === key ? { ...item, ...patch } : item));
  const validateStep = () => {
    if (step === 0) {
      if (!student.firstName.trim() || !student.lastName.trim() || !student.dateOfBirth || !student.classId) return "Enter the student's name, date of birth and current class.";
      if (student.dateOfBirth > new Date().toISOString().slice(0, 10)) return "Date of birth cannot be in the future.";
    }
    if (step === 1) {
      if (guardians.some(item => item.kind === "existing" && !item.guardianId)) return "Choose a guardian for each existing contact.";
      if (guardians.some(item => item.kind === "new" && (!item.firstName.trim() || !item.lastName.trim()))) return "Enter the first and last name for each new guardian.";
      const ids = guardians.filter(item => item.kind === "existing").map(item => item.guardianId);
      if (new Set(ids).size !== ids.length) return "Each existing guardian can be added once.";
      if (guardians.filter(item => item.isPrimary).length > 1) return "Choose only one primary contact.";
    }
    return "";
  };
  const next = () => { const issue = validateStep(); if (issue) { setError(issue); return; } setError(""); setStep(value => value + 1); };
  const save = () => {
    setError("");
    const payload: EnrollmentInput = { ...student, firstName: student.firstName.trim(), lastName: student.lastName.trim(),
      guardians: guardians.map(item => ({ relationship: item.relationship, isPrimary: item.isPrimary,
        hasLegalResponsibility: item.hasLegalResponsibility, ...(item.kind === "existing"
          ? { kind: "existing" as const, guardianId: item.guardianId }
          : { kind: "new" as const, firstName: item.firstName.trim(), lastName: item.lastName.trim(), email: item.email.trim(), phone: item.phone.trim() }) })),
      concerns: selectedConcerns };
    start(async () => {
      try {
        const result = await enrollStudentAction(payload);
        if (!result.success) { setError(result.error); return; }
        onSaved(`Student enrolled as ${result.studentNumber}. ${result.guardianCount} guardian contact${result.guardianCount === 1 ? "" : "s"} linked${result.referralCount ? `; ${result.referralCount} restricted referral${result.referralCount === 1 ? "" : "s"} created` : ""}.`);
        router.refresh();
      } catch { setError("Enrollment could not be saved. Check your connection and try again."); }
    });
  };
  return <dialog ref={dialog} aria-labelledby="enroll-title" onCancel={event => { if (pending) event.preventDefault(); else onClose(); }}
    className="fixed inset-0 m-auto max-h-[94dvh] w-[min(720px,calc(100%_-_24px))] overflow-y-auto border border-slate-300 bg-white p-0 text-slate-900 shadow-xl backdrop:bg-slate-950/50">
    <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 sm:px-7"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">New enrollment</p><h2 id="enroll-title" className="mt-1 text-xl font-bold">Enroll student</h2></div><button type="button" className="grid h-11 w-11 place-items-center" aria-label="Close enrollment" disabled={pending} onClick={onClose}><X size={20} /></button></div>
    <ol className="grid grid-cols-4 border-b border-slate-200 bg-slate-50" aria-label="Enrollment steps">{steps.map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`border-b-2 px-2 py-3 text-center text-xs font-semibold sm:text-sm ${step === index ? "border-blue-700 text-blue-800" : index < step ? "border-emerald-600 text-emerald-800" : "border-transparent text-slate-500"}`}>{index + 1}. {label}</li>)}</ol>
    <div className="space-y-5 px-5 py-6 sm:px-7">
      {step === 0 && <><p className="text-sm text-slate-600">Choose the class now. Klassa assigns the student number when enrollment is saved.</p><div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">First name<input className={field} required maxLength={100} autoComplete="given-name" value={student.firstName} onChange={event => setStudent({ ...student, firstName: event.target.value })} /></label>
        <label className="text-sm font-semibold">Last name<input className={field} required maxLength={100} autoComplete="family-name" value={student.lastName} onChange={event => setStudent({ ...student, lastName: event.target.value })} /></label>
        <label className="text-sm font-semibold">Date of birth<input className={field} type="date" required max={new Date().toISOString().slice(0, 10)} value={student.dateOfBirth} onChange={event => setStudent({ ...student, dateOfBirth: event.target.value })} /></label>
        <label className="text-sm font-semibold">Class in current year<select className={field} required value={student.classId} onChange={event => setStudent({ ...student, classId: event.target.value })}><option value="">Choose a class</option>{classes.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="text-sm font-semibold">Enrollment status<select className={field} value={student.status} onChange={event => setStudent({ ...student, status: event.target.value as "pending" | "active" })}><option value="pending">Pending</option><option value="active">Active</option></select></label>
      </div>{!classes.length && <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Create the current academic year and a class before enrolling a student.</p>}</>}
      {step === 1 && <><div><h3 className="font-semibold">Guardian contacts</h3><p className="mt-1 text-sm text-slate-600">Add a new guardian or link one already in this school. Contact details are optional. You can add guardians later.</p></div>
        {guardians.map((item, index) => <section key={item.key} className="space-y-4 border border-slate-200 p-4"><div className="flex items-center justify-between"><h4 className="font-semibold">Guardian {index + 1}</h4><button type="button" className="text-sm font-semibold text-red-700" onClick={() => setGuardians(items => items.filter(row => row.key !== item.key))}>Remove</button></div>
          <label className="block text-sm font-semibold">Contact type<select className={field} value={item.kind} onChange={event => updateGuardian(item.key, { kind: event.target.value as GuardianDraft["kind"], guardianId: "" })}><option value="new">New guardian</option><option value="existing">Existing guardian</option></select></label>
          {item.kind === "existing" ? <label className="block text-sm font-semibold">Guardian<select className={field} value={item.guardianId} onChange={event => updateGuardian(item.key, { guardianId: event.target.value })}><option value="">Choose a guardian</option>{existingGuardians.map(guardian => <option key={guardian.id} value={guardian.id}>{guardian.label}</option>)}</select></label>
            : <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">First name<input className={field} maxLength={100} value={item.firstName} onChange={event => updateGuardian(item.key, { firstName: event.target.value })} /></label><label className="text-sm font-semibold">Last name<input className={field} maxLength={100} value={item.lastName} onChange={event => updateGuardian(item.key, { lastName: event.target.value })} /></label><label className="text-sm font-semibold">Email (optional)<input className={field} type="email" maxLength={254} value={item.email} onChange={event => updateGuardian(item.key, { email: event.target.value })} /></label><label className="text-sm font-semibold">Phone (optional)<input className={field} type="tel" maxLength={40} value={item.phone} onChange={event => updateGuardian(item.key, { phone: event.target.value })} /></label></div>}
          <label className="block text-sm font-semibold">Relationship<select className={field} value={item.relationship} onChange={event => updateGuardian(item.key, { relationship: event.target.value as GuardianDraft["relationship"] })}><option value="parent">Parent</option><option value="guardian">Guardian</option><option value="foster_carer">Foster carer</option><option value="other">Other</option></select></label>
          <div className="flex flex-wrap gap-5 text-sm"><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={item.isPrimary} onChange={event => setGuardians(items => items.map(row => ({ ...row, isPrimary: row.key === item.key ? event.target.checked : event.target.checked ? false : row.isPrimary })))} />Primary contact</label><label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={item.hasLegalResponsibility} onChange={event => updateGuardian(item.key, { hasLegalResponsibility: event.target.checked })} />Has legal responsibility</label></div>
        </section>)}
        <button type="button" className={secondary} disabled={guardians.length >= 6} onClick={() => setGuardians(items => [...items, { ...emptyGuardian(), isPrimary: items.length === 0 }])}>Add guardian</button>
      </>}
      {step === 2 && <><div><h3 className="font-semibold">Concerns and referrals</h3><p className="mt-1 text-sm text-slate-600">Select areas that need specialist review. This creates restricted case referrals without recording details in the general student profile.</p></div><div className="space-y-3">{concerns.map(item => <label key={item.value} className="flex gap-3 border border-slate-200 p-4"><input type="checkbox" className="mt-1" checked={selectedConcerns.includes(item.value)} onChange={event => setSelectedConcerns(values => event.target.checked ? [...values, item.value] : values.filter(value => value !== item.value))} /><span><strong className="block text-sm">{item.label}</strong><small className="mt-1 block text-slate-600">{item.help}</small></span></label>)}</div><p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Do not enter medical, safeguarding, or court details here. Authorized staff can add those in Sensitive records after enrollment.</p></>}
      {step === 3 && <><h3 className="font-semibold">Review enrollment</h3><dl className="grid gap-4 border border-slate-200 p-4 text-sm sm:grid-cols-2"><div><dt className="text-slate-500">Student</dt><dd className="font-semibold">{student.firstName.trim()} {student.lastName.trim()}</dd></div><div><dt className="text-slate-500">Date of birth</dt><dd>{student.dateOfBirth}</dd></div><div><dt className="text-slate-500">Class</dt><dd>{classes.find(item => item.id === student.classId)?.label}</dd></div><div><dt className="text-slate-500">Status</dt><dd className="capitalize">{student.status}</dd></div></dl>
        <div className="border border-slate-200 p-4"><h4 className="font-semibold">Guardians ({guardians.length})</h4>{guardians.length ? <ul className="mt-2 space-y-1 text-sm">{guardians.map(item => <li key={item.key}>{item.kind === "existing" ? existingGuardians.find(row => row.id === item.guardianId)?.label : `${item.firstName.trim()} ${item.lastName.trim()}`} · {item.relationship.replaceAll("_", " ")}{item.isPrimary ? " · Primary contact" : ""}</li>)}</ul> : <p className="mt-2 text-sm text-slate-500">No guardian linked yet.</p>}</div>
        <div className="border border-slate-200 p-4"><h4 className="font-semibold">Restricted referrals ({selectedConcerns.length})</h4><p className="mt-2 text-sm text-slate-600">{selectedConcerns.length ? selectedConcerns.map(value => concerns.find(item => item.value === value)?.label).join(", ") : "None selected"}</p></div>
      </>}
      {error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </div>
    <div className="flex flex-wrap justify-between gap-3 border-t border-slate-200 bg-slate-50 px-5 py-4 sm:px-7"><button type="button" className={secondary} disabled={pending} onClick={step === 0 ? onClose : () => { setError(""); setStep(value => value - 1); }}>{step === 0 ? "Cancel" : "Back"}</button>{step < steps.length - 1 ? <button type="button" className={primary} disabled={pending || (step === 0 && !classes.length)} onClick={next}>Continue</button> : <button type="button" className={primary} disabled={pending} onClick={save}>{pending ? "Saving..." : "Enroll student"}</button>}</div>
  </dialog>;
}
