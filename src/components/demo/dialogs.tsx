"use client";
import { UploadSimple, Gavel, ShieldWarning } from "@phosphor-icons/react";
import { Overlay } from "@/components/ui/overlay";
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
    <Overlay open onClose={onClose} title={title} description={description}>
      {children}
    </Overlay>
  );
}

export function AddStudentDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (formData: FormData) => void }) {
  return (
    <DialogFrame title="Add Student" description="Create an official student record." onClose={onClose}>
      <form action={onSubmit}>
        <div className="grid gap-3 p-5 sm:grid-cols-2 text-xs">
          <label className="text-ink"><span className="block mb-1 font-semibold">First Name</span><input required name="firstName" className="ui-field w-full text-xs" /></label>
          <label className="text-ink"><span className="block mb-1 font-semibold">Last Name</span><input required name="lastName" className="ui-field w-full text-xs" /></label>
          <p className="self-end text-xs text-muted">A student number is assigned automatically.</p>
          <label className="text-ink"><span className="block mb-1 font-semibold">DOB</span><input required type="date" name="dateOfBirth" defaultValue="2014-06-15" className="ui-field w-full text-xs" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-subtle bg-surface p-4">
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
        <div className="grid gap-3 p-5 sm:grid-cols-2 text-xs">
          <label className="text-ink"><span className="block mb-1 font-semibold">First Name</span><input required name="firstName" className="ui-field w-full text-xs" /></label>
          <label className="text-ink"><span className="block mb-1 font-semibold">Last Name</span><input required name="lastName" className="ui-field w-full text-xs" /></label>
          <label className="text-ink"><span className="block mb-1 font-semibold">Email</span><input required type="email" name="email" className="ui-field w-full text-xs" /></label>
          <label className="text-ink"><span className="block mb-1 font-semibold">Phone</span><input required type="tel" name="phone" className="ui-field w-full text-xs" placeholder="+354 555 0199" /></label>
          <label className="sm:col-span-2 text-ink">
            <span className="block mb-1 font-semibold">Link to Student</span>
            <select name="studentId" className="ui-field w-full text-xs">
              {students.map((s) => (<option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.id})</option>))}
            </select>
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-subtle bg-surface p-4">
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
        <div className="p-5 space-y-3 text-xs">
          <label className="block text-ink"><span className="block mb-1 font-semibold">Class Name</span><input required name="name" className="ui-field w-full text-xs" placeholder="e.g. 7C" /></label>
          <label className="block text-ink"><span className="block mb-1 font-semibold">Grade</span><select name="grade" className="ui-field w-full text-xs"><option>Grade 5</option><option>Grade 6</option><option>Grade 7</option><option>Grade 8</option></select></label>
          <label className="block text-ink"><span className="block mb-1 font-semibold">Homeroom Teacher</span><input required name="homeroomTeacher" className="ui-field w-full text-xs" placeholder="Teacher Name" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-subtle bg-surface p-4">
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
        <div className="p-5 space-y-3 text-xs">
          <label className="block text-ink"><span className="block mb-1 font-semibold">Code</span><input required name="code" className="ui-field w-full text-xs uppercase" placeholder="BIO-01" /></label>
          <label className="block text-ink"><span className="block mb-1 font-semibold">Title</span><input required name="name" className="ui-field w-full text-xs" placeholder="Biology" /></label>
          <label className="block text-ink"><span className="block mb-1 font-semibold">Department</span><input required name="department" className="ui-field w-full text-xs" placeholder="STEM" /></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-subtle bg-surface p-4">
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
        <div className="p-5 space-y-3 text-xs">
          <label className="block text-ink"><span className="block mb-1 font-semibold">Mobile number</span><input required type="tel" name="phoneNumber" className="ui-field w-full text-xs" placeholder="+354 555 1234" /></label>
          {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-subtle p-3 text-danger">{error}</p>}
          <label className="block text-ink"><span className="block mb-1 font-semibold">Role</span><select name="role" className="ui-field w-full text-xs"><option value="office_staff">Office Staff</option><option value="school_admin">School Admin</option></select></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-line-subtle bg-surface p-4">
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
      <div className="p-5 space-y-3 text-xs">
        <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-control border border-dashed border-line p-4 text-center hover:bg-primary-subtle transition-colors">
          <UploadSimple size={24} className="text-primary" />
          <span className="mt-2 font-semibold text-ink">{file ? file.name : "Select CSV file"}</span>
          <input className="sr-only" type="file" accept=".csv,text/csv" onChange={(e) => { if (e.target.files?.[0]) handleFileChange(e.target.files[0]); }} />
        </label>

        {validationResult && (
          <div className="rounded-control border border-line-subtle p-4 bg-surface-subtle text-xs">
            <span className="font-bold text-ink">{file?.name}</span>
            <div className="mt-1.5 flex gap-4 text-secondary">
              <span>Total: <strong className="text-ink">{validationResult.totalRows}</strong></span>
              <span className="text-emerald-700">Valid: <strong>{validationResult.validCount}</strong></span>
              {validationResult.invalidCount > 0 && <span className="text-danger">Errors: <strong>{validationResult.invalidCount}</strong></span>}
            </div>
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 border-t border-line-subtle bg-surface p-4">
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
    <Overlay open onClose={onClose} title={student.firstName + " " + student.lastName} description={student.id} variant="drawer">
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
          {courtOrders.length > 0 && (
            <div className="rounded-control border border-danger/20 bg-danger-subtle p-3 space-y-1.5">
              <div className="flex items-center gap-1.5 font-bold text-danger text-xs">
                <Gavel size={15} weight="bold" className="text-danger" />
                <span>STATUTORY COURT ORDER ENFORCED</span>
              </div>
              {courtOrders.map((co) => (
                <div key={co.id} className="text-danger text-[11px] leading-relaxed">
                  <p><strong>Restricted Individual:</strong> {co.restrictedPersonName}</p>
                  <p className="mt-0.5">{co.summary}</p>
                  <p className="mt-0.5 font-mono text-[10px]">Docket: {co.docketNumber} • {co.issuingCourt}</p>
                </div>
              ))}
            </div>
          )}

          {alerts.length > 0 && (
            <div className="rounded-control border border-warning/20 bg-warning-subtle p-3 space-y-2">
              <div className="flex items-center gap-1.5 font-bold text-warning text-xs">
                <ShieldWarning size={15} weight="bold" className="text-warning" />
                <span>Classroom Need-to-Know Directives ({alerts.length})</span>
              </div>
              {alerts.map((al) => (
                <div key={al.id} className="border-t border-warning/20 pt-1.5 text-[11px] text-warning">
                  <div className="flex items-center justify-between font-bold">
                    <span>{al.directiveSummary}</span>
                    <span className="uppercase text-[9px] font-bold">{al.severity}</span>
                  </div>
                  <p className="mt-0.5 leading-relaxed">{al.actionRequired}</p>
                  <span className="text-[10px]">Authorized by {al.authorSpecialistName}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center">
            <Badge tone={student.status === "Active" ? "green" : "amber"}>{student.status}</Badge>
            <Button variant="secondary" size="sm" onClick={onToggleStatus}>Switch to {student.status === "Active" ? "Pending" : "Active"}</Button>
          </div>
          <div className="border-t border-line-subtle pt-3">
            <span className="font-bold text-secondary uppercase text-[10px]">Placement</span>
            <p className="mt-1 font-semibold text-ink">{student.grade} - Class {student.className}</p>
          </div>
          <div className="border-t border-line-subtle pt-3">
            <span className="font-bold text-secondary uppercase text-[10px]">Guardians ({guardians.length})</span>
            {guardians.map((g) => (
              <div key={g.id} className="mt-2 rounded-control border border-line-subtle p-3 bg-surface-subtle">
                <span className="font-semibold text-ink">{g.firstName} {g.lastName}</span> <span className="text-secondary">({g.relationship})</span>
                <p className="font-mono text-muted mt-0.5">{g.email} · {g.phone}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-end"><Button variant="secondary" onClick={onClose}>Close</Button></div>
    </Overlay>
  );
}
