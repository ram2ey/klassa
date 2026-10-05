"use client";
import { type StudentRecord, type GuardianRecord, type ClassRecord, type SubjectRecord, type ImportJobRecord, type AuditRecordItem } from "./types";
import { type NeedToKnowAlertRecord, type CourtRestrictionRecord } from "@/lib/sensitive-records";
import { Directory, DirectoryIdentity, DirectoryStatus } from "@/components/ui/directory";
import { Field, Select } from "@/components/ui/field";
import { PageHeading } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UploadSimple, Plus, DownloadSimple } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { generateStudentCsvTemplate } from "@/lib/csv";

export function StudentDirectoryModule({ students, total, query, setQuery, gradeFilter, setGradeFilter, statusFilter, setStatusFilter, availableGrades, needToKnowAlerts = [], courtRestrictions = [], onAdd, onImport, onSelectStudent }: {
  students: StudentRecord[]; total: number; query: string; setQuery: (value: string) => void; gradeFilter: string; setGradeFilter: (value: string) => void;
  statusFilter: string; setStatusFilter: (value: string) => void; availableGrades?: string[];
  needToKnowAlerts?: NeedToKnowAlertRecord[]; courtRestrictions?: CourtRestrictionRecord[];
  onAdd: () => void; onImport: () => void; onSelectStudent: (student: StudentRecord) => void;
}) {
  return <div className="space-y-6"><PageHeading title="Student Directory" description="Local demo · Synthetic school roster and guardian links." />
    <Directory title="Student directory" description={total + " records in the synthetic roster"} resultLabel="students" query={query} onQueryChange={setQuery}
      actions={<><Button variant="secondary" onClick={onImport}><UploadSimple size={16} />Import CSV</Button><Button onClick={onAdd}><Plus size={16} />Add Student</Button></>}
      resetKey={gradeFilter + statusFilter} hasExternalFilters={gradeFilter !== "All grades" || statusFilter !== "All statuses"} onClearFilters={() => { setGradeFilter("All grades"); setStatusFilter("All statuses"); }}
      toolbar={<div className="grid gap-4 sm:grid-cols-2"><Field label="Grade"><Select value={gradeFilter} onChange={event => setGradeFilter(event.target.value)}><option>All grades</option>{(availableGrades ?? [...new Set(students.map(row => row.grade))]).map(grade => <option key={grade}>{grade}</option>)}</Select></Field><Field label="Status"><Select value={statusFilter} onChange={event => setStatusFilter(event.target.value)}><option>All statuses</option>{["Active", "Pending", "Withdrawn"].map(status => <option key={status}>{status}</option>)}</Select></Field></div>}
      columns={[{ key: "name", label: "Student", sortable: true }, { key: "number", label: "ID", sortable: true }, { key: "class", label: "Placement", sortable: true }, { key: "guardians", label: "Guardians" }, { key: "status", label: "Status", sortable: true }, { key: "actions", label: "Actions" }]}
      rows={students.map(student => ({ id: student.id, name: student.firstName + " " + student.lastName, search: [student.firstName, student.lastName, student.id].join(" "), values: { name: student.lastName + " " + student.firstName, number: student.id, class: student.grade + " / " + student.className, status: student.status }, cells: {
        name: <><DirectoryIdentity name={student.firstName + " " + student.lastName} onClick={() => onSelectStudent(student)} /><div className="mt-1 flex flex-wrap gap-1">{courtRestrictions.some(row => row.isEnforced && (row.studentId === student.id || row.studentName.toLowerCase() === (student.firstName + " " + student.lastName).toLowerCase())) && <Badge tone="danger">Safety restriction</Badge>}{needToKnowAlerts.some(row => row.isActive && (row.studentId === student.id || row.studentName.toLowerCase() === (student.firstName + " " + student.lastName).toLowerCase())) && <Badge tone="amber">Staff alert</Badge>}</div></>,
        number: <span className="font-mono text-xs">{student.id}</span>, class: student.grade + " / " + student.className, guardians: student.guardians, status: <DirectoryStatus value={student.status} />,
        actions: <Button variant="secondary" aria-label={"View " + student.firstName + " " + student.lastName} onClick={() => onSelectStudent(student)}>View profile</Button>,
      } }))} emptyTitle="No students yet" emptyDescription="Add a synthetic pupil or import a roster to explore the demo." emptyAction={<Button onClick={onAdd}>Add Student</Button>}
    />
  </div>;
}

export function GuardianDirectoryModule({ guardians, onAddGuardian }: { guardians: GuardianRecord[]; onAddGuardian: () => void }) {
  return <div className="space-y-6"><PageHeading title="Guardian Directory" description="Local demo · Synthetic guardian relationships and contact details." />
    <Directory title="Guardian contacts" resultLabel="guardians" actions={<Button onClick={onAddGuardian}>Link Guardian</Button>}
      filters={[{ key: "legal", label: "Responsibility", options: [{ value: "yes", label: "Legal responsibility" }, { value: "no", label: "Emergency only" }] }]}
      columns={[{ key: "name", label: "Name", sortable: true }, { key: "student", label: "Student", sortable: true }, { key: "contact", label: "Contact details" }, { key: "relationship", label: "Relationship" }, { key: "legal", label: "Responsibility" }]}
      rows={guardians.map(guardian => ({ id: guardian.id, name: guardian.firstName + " " + guardian.lastName, search: [guardian.firstName, guardian.lastName, guardian.studentName, guardian.email, guardian.phone].join(" "), values: { name: guardian.lastName + " " + guardian.firstName, student: guardian.studentName }, filters: { legal: guardian.hasLegalResponsibility ? "yes" : "no" }, cells: {
        name: <DirectoryIdentity name={guardian.firstName + " " + guardian.lastName} detail={guardian.isPrimary ? "Primary contact" : undefined} />, student: guardian.studentName, contact: <div className="space-y-1 text-xs"><p>{guardian.email || "Email not provided"}</p><p>{guardian.phone || "Phone not provided"}</p></div>, relationship: guardian.relationship, legal: <Badge tone={guardian.hasLegalResponsibility ? "primary" : "slate"}>{guardian.hasLegalResponsibility ? "Legal responsibility" : "Emergency only"}</Badge>,
      } }))} emptyTitle="No guardian contacts yet" emptyDescription="Link a synthetic guardian to a pupil to populate this directory." emptyAction={<Button onClick={onAddGuardian}>Link Guardian</Button>}
    />
  </div>;
}

export function AcademicSetupModule({
  classes, subjects, onAddClass, onAddSubject,
}: {
  classes: ClassRecord[];
  subjects: SubjectRecord[];
  onAddClass: () => void;
  onAddSubject: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Classes & Academic Setup</h1>
          <p className="mt-1 text-[13px] text-muted">Classes, grade levels, and curriculum catalog.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onAddClass}><Plus size={16} />Add Class</Button>
          <Button onClick={onAddSubject}><Plus size={16} />Add Subject</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => (
          <div key={cls.id} className="border border-line bg-surface p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-ink">Class {cls.name}</span>
              <Badge tone="blue">{cls.grade}</Badge>
            </div>
            <div className="mt-2 text-xs text-secondary">Homeroom: <span className="font-semibold text-ink">{cls.homeroomTeacher}</span></div>
          </div>
        ))}
      </div>

      <section className="border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 font-bold text-xs uppercase text-secondary">Subject Curriculum Catalog</div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-subtle text-[11px] font-semibold text-muted uppercase">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Subject Name</th>
              <th className="px-4 py-2">Department</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj) => (
              <tr key={subj.id} className="h-10 border-b border-line-subtle text-xs hover:bg-surface-subtle/50">
                <td className="px-4 font-mono font-bold text-ink">{subj.code}</td>
                <td className="px-4 font-medium text-ink">{subj.name}</td>
                <td className="px-4 text-secondary">{subj.department}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function ImportWorkspaceModule({
  importJobs, onOpenImportModal,
}: {
  importJobs: ImportJobRecord[];
  onOpenImportModal: () => void;
}) {
  function handleDownloadTemplate() {
    const template = generateStudentCsvTemplate();
    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "klassa_student_import_template.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold tracking-tight">CSV Ingestion Engine</h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={handleDownloadTemplate}><DownloadSimple size={16} />Template</Button>
          <Button onClick={onOpenImportModal}><UploadSimple size={16} />New Import</Button>
        </div>
      </div>
      <section className="border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-line bg-surface-subtle text-[10px] uppercase text-muted">
              <th className="px-4 font-bold">File</th>
              <th className="px-4 font-bold">Rows</th>
              <th className="px-4 font-bold">Valid</th>
              <th className="px-4 font-bold">Status</th>
              <th className="px-4 font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {importJobs.map((j) => (
              <tr key={j.id} className="h-12 border-b border-line-subtle">
                <td className="px-4 font-mono text-xs font-semibold">{j.sourceFilename}</td>
                <td className="px-4 font-mono text-xs">{j.rowCount}</td>
                <td className="px-4 font-mono text-xs text-green-700 font-bold">{j.validRowCount}</td>
                <td className="px-4"><Badge tone={j.status === "completed" ? "green" : "amber"}>{j.status}</Badge></td>
                <td className="px-4 text-xs text-muted">{j.createdAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function AuditLogModule({ auditLogs }: { auditLogs: AuditRecordItem[] }) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Audit Trail</h1>
      <section className="border border-line bg-surface">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-line bg-surface-subtle text-[10px] uppercase text-muted">
              <th className="px-4 font-bold">Timestamp</th>
              <th className="px-4 font-bold">Action</th>
              <th className="px-4 font-bold">Entity</th>
              <th className="px-4 font-bold">Actor</th>
              <th className="px-4 font-bold">Payload</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id} className="h-12 border-b border-line-subtle">
                <td className="px-4 font-mono text-xs text-muted">{log.createdAt}</td>
                <td className="px-4"><Badge tone="blue">{log.action}</Badge></td>
                <td className="px-4 text-xs font-mono">{log.entityId}</td>
                <td className="px-4 text-xs">{log.actorUserId}</td>
                <td className="px-4 text-[11px] font-mono text-secondary truncate max-w-xs">{JSON.stringify(log.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
