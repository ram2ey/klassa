"use client";
import { X, UploadSimple, Gavel, ShieldWarning } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { type StudentRecord, type GuardianRecord } from "./types";
import { type CsvValidationResult, validateStudentCsv } from "@/lib/csv";
import { useState } from "react";
import { type NeedToKnowAlertRecord, type CourtRestrictionRecord } from "@/lib/sensitive-records";
import { Badge } from "@/components/ui/badge";

export function DialogFrame({
  title, description, onClose, children,
}: {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" className="w-full max-w-lg border border-slate-300 bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 p-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
          <button aria-label="Close" onClick={onClose} className="p-1 hover:bg-slate-100 text-slate-500"><X size={17} /></button>
        </div>
        {children}
      </section>
    </div>
  );
}

export function AddStudentDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Student" description="Create an official student record." onClose={onClose}>
      <form action={onSubmit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 text-xs">
          <label><span className="block mb-1 font-semibold">First Name</span><input required name="firstName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Last Name</span><input required name="lastName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <p className="self-end text-xs text-slate-500">A student number is assigned automatically.</p>
          <label><span className="block mb-1 font-semibold">DOB</span><input required type="date" name="dateOfBirth" defaultValue="2014-06-15" className="h-9 w-full border border-slate-300 px-3" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function AddGuardianDialog({
  students, onClose, onSubmit,
}: {
  students: StudentRecord[];
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogFrame title="Link Guardian" description="Register contact information for student." onClose={onClose}>
      <form action={onSubmit}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 text-xs">
          <label><span className="block mb-1 font-semibold">First Name</span><input required name="firstName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Last Name</span><input required name="lastName" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Email</span><input required type="email" name="email" className="h-9 w-full border border-slate-300 px-3" /></label>
          <label><span className="block mb-1 font-semibold">Phone</span><input required type="tel" name="phone" className="h-9 w-full border border-slate-300 px-3" placeholder="+354 555 0199" /></label>
          <label className="sm:col-span-2">
            <span className="block mb-1 font-semibold">Link to Student</span>
            <select name="studentId" className="h-9 w-full border border-slate-300 bg-white px-3">
              {students.map((s) => (<option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.id})</option>))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Save</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function AddClassDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Class" description="Create class section." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-3 text-xs">
          <label><span className="block mb-1 font-semibold">Class Name</span><input required name="name" className="h-9 w-full border border-slate-300 px-3" placeholder="e.g. 7C" /></label>
          <label><span className="block mb-1 font-semibold">Grade</span><select name="grade" className="h-9 w-full border border-slate-300 bg-white px-3"><option>Grade 5</option><option>Grade 6</option><option>Grade 7</option><option>Grade 8</option></select></label>
          <label><span className="block mb-1 font-semibold">Homeroom Teacher</span><input required name="homeroomTeacher" className="h-9 w-full border border-slate-300 px-3" placeholder="Teacher Name" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function AddSubjectDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Subject" description="Configure course subject." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-3 text-xs">
          <label><span className="block mb-1 font-semibold">Code</span><input required name="code" className="h-9 w-full border border-slate-300 px-3 uppercase" placeholder="BIO-01" /></label>
          <label><span className="block mb-1 font-semibold">Title</span><input required name="name" className="h-9 w-full border border-slate-300 px-3" placeholder="Biology" /></label>
          <label><span className="block mb-1 font-semibold">Department</span><input required name="department" className="h-9 w-full border border-slate-300 px-3" placeholder="STEM" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Create</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function InviteStaffDialog({ onClose, onSubmit, error }: { onClose: () => void; onSubmit: (formData: FormData) => void; error: string }) {
  return (
    <DialogFrame title="Invite Staff by SMS" description="Local simulation. No SMS will be sent. Real invitations are managed by the platform superuser." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-3 text-xs">
          <label><span className="block mb-1 font-semibold">Mobile number</span><input required type="tel" name="phoneNumber" className="h-9 w-full border border-slate-300 px-3" placeholder="+354 555 1234" /></label>
          {error && <p role="alert" className="text-red-700">{error}</p>}
          <label><span className="block mb-1 font-semibold">Role</span><select name="role" className="h-9 w-full border border-slate-300 bg-white px-3"><option value="office_staff">Office Staff</option><option value="school_admin">School Admin</option></select></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Send</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function ImportCsvModal({
  onClose, onApplyImport,
}: {
  onClose: () => void;
  onApplyImport: (filename: string, csvContent: string, result: CsvValidationResult) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [csvContent, setCsvContent] = useState("");
  const [validationResult, setValidationResult] = useState<CsvValidationResult | null>(null);

  function handleFileChange(selectedFile: File) {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || "");
      setCsvContent(text);
      const result = validateStudentCsv(text);
      setValidationResult(result);
    };
    reader.readAsText(selectedFile);
  }

  return (
    <DialogFrame title="Import Student Roster" description="Upload a UTF-8 CSV with pre-import validation." onClose={onClose}>
      <div className="p-4 space-y-3 text-xs">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center border border-dashed border-slate-400 bg-slate-50 p-4 text-center hover:bg-blue-50/30">
          <UploadSimple size={24} className="text-blue-700" />
          <span className="mt-2 font-semibold">{file ? file.name : "Select CSV file"}</span>
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }} />
        </label>

        {validationResult && (
          <div className="border border-slate-200 p-3 bg-slate-50 text-xs">
            <span className="font-bold text-slate-800">{file?.name}</span>
            <div className="mt-1 flex gap-3 text-slate-600">
              <span>Total: <strong>{validationResult.totalRows}</strong></span>
              <span className="text-green-700">Valid: <strong>{validationResult.validCount}</strong></span>
              {validationResult.invalidCount > 0 && <span className="text-red-600">Errors: <strong>{validationResult.invalidCount}</strong></span>}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button disabled={!validationResult || validationResult.validCount === 0} onClick={() => { if (validationResult && file) onApplyImport(file.name, csvContent, validationResult); }}>Commit Import</Button>
      </div>
    </DialogFrame>
  );
}

export function StudentDetailDrawer({
  student, guardians, alerts = [], courtOrders = [], onClose, onToggleStatus,
}: {
  student: StudentRecord;
  guardians: GuardianRecord[];
  alerts?: NeedToKnowAlertRecord[];
  courtOrders?: CourtRestrictionRecord[];
  onClose: () => void;
  onToggleStatus: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/40" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="w-full max-w-md bg-white border-l border-slate-300 shadow-2xl flex flex-col h-full">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center bg-slate-900 text-sm font-bold text-white">{student.initials}</span>
            <div><h2 className="text-base font-bold text-slate-900">{student.firstName} {student.lastName}</h2><span className="font-mono text-xs text-slate-500">{student.id}</span></div>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-slate-100 text-slate-500"><X size={18} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {courtOrders.length > 0 && (
            <div className="rounded-xs border border-rose-300 bg-rose-50 p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-rose-950 text-xs">
                <Gavel size={15} weight="bold" className="text-rose-700" />
                <span>STATUTORY COURT ORDER ENFORCED</span>
              </div>
              {courtOrders.map((co) => (
                <div key={co.id} className="text-rose-900 text-[11px] leading-relaxed">
                  <p><strong>Restricted Individual:</strong> {co.restrictedPersonName}</p>
                  <p className="mt-0.5">{co.summary}</p>
                  <p className="mt-0.5 font-mono text-[10px] text-rose-700">Docket: {co.docketNumber} • {co.issuingCourt}</p>
                </div>
              ))}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="rounded-xs border border-amber-300 bg-amber-50 p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-amber-950 text-xs">
                <ShieldWarning size={15} weight="bold" className="text-amber-700" />
                <span>Classroom Need-to-Know Directives ({alerts.length})</span>
              </div>
              {alerts.map((al) => (
                <div key={al.id} className="border-t border-amber-200/70 pt-1.5 text-[11px] text-amber-950">
                  <div className="flex items-center justify-between font-bold">
                    <span>{al.directiveSummary}</span>
                    <span className="uppercase text-[9px] font-bold text-amber-800">{al.severity}</span>
                  </div>
                  <p className="mt-0.5 text-amber-900 leading-relaxed">{al.actionRequired}</p>
                  <span className="text-[10px] text-amber-700">Authorized by {al.authorSpecialistName}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <Badge tone={student.status === "Active" ? "green" : "amber"}>{student.status}</Badge>
            <Button variant="secondary" size="sm" onClick={onToggleStatus}>Switch to {student.status === "Active" ? "Pending" : "Active"}</Button>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Placement</span>
            <p className="mt-1 font-semibold">{student.grade} - Class {student.className}</p>
          </div>
          <div className="border-t border-slate-100 pt-3">
            <span className="font-bold text-slate-400 uppercase text-[10px]">Guardians ({guardians.length})</span>
            {guardians.map((g) => (
              <div key={g.id} className="mt-2 border border-slate-200 p-2 bg-slate-50">
                <span className="font-semibold">{g.firstName} {g.lastName}</span> ({g.relationship})
                <p className="font-mono text-slate-500">{g.email} · {g.phone}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t border-slate-200 p-3 bg-slate-50 flex justify-end">
          <Button variant="secondary" onClick={onClose}>Close</Button>
        </div>
      </div>
    </div>
  );
}
