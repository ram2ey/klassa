"use client";
import { type StudentRecord, type GuardianRecord, type ClassRecord, type SubjectRecord, type ImportJobRecord, type AuditRecordItem } from "./types";
import { type NeedToKnowAlertRecord, type CourtRestrictionRecord } from "@/lib/sensitive-records";
import { Button } from "@/components/ui/button";
import { UploadSimple, Plus, MagnifyingGlass, Gavel, ShieldWarning, DotsThree, DownloadSimple } from "@phosphor-icons/react";
import { Badge } from "@/components/ui/badge";
import { generateStudentCsvTemplate } from "@/lib/csv";

export function StudentDirectoryModule({
  students, total, query, setQuery, gradeFilter, setGradeFilter, statusFilter, setStatusFilter,
  needToKnowAlerts = [], courtRestrictions = [],
  onAdd, onImport, onSelectStudent,
}: {
  students: StudentRecord[];
  total: number;
  query: string;
  setQuery: (val: string) => void;
  gradeFilter: string;
  setGradeFilter: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  needToKnowAlerts?: NeedToKnowAlertRecord[];
  courtRestrictions?: CourtRestrictionRecord[];
  onAdd: () => void;
  onImport: () => void;
  onSelectStudent: (st: StudentRecord) => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Student Directory</h1>
          <p className="mt-1 text-[13px] text-slate-500">Official student records, guardians, and enrollments.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onImport}><UploadSimple size={16} />Import CSV</Button>
          <Button onClick={onAdd}><Plus size={16} weight="bold" />Add Student</Button>
        </div>
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1 md:max-w-sm">
            <MagnifyingGlass className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 w-full border border-slate-300 pl-9 pr-3 text-[13px] focus:border-blue-600 focus:outline-none"
              placeholder="Search name, ID…"
            />
          </div>
          <select value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)} className="h-9 border border-slate-300 bg-white px-3 text-[13px]">
            <option>All grades</option>
            <option>Grade 5</option>
            <option>Grade 6</option>
            <option>Grade 7</option>
            <option>Grade 8</option>
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 border border-slate-300 bg-white px-3 text-[13px]">
            <option>All statuses</option>
            <option>Active</option>
            <option>Pending</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead>
              <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                <th className="px-3 font-bold">Student</th>
                <th className="px-3 font-bold">ID</th>
                <th className="px-3 font-bold">DOB</th>
                <th className="px-3 font-bold">Placement</th>
                <th className="px-3 font-bold">Guardians</th>
                <th className="px-3 font-bold">Status</th>
                <th className="w-12 px-3"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {students.map((st) => {
                const hasCourt = courtRestrictions.some((c) => c.isEnforced && (c.studentId === st.id || c.studentName.toLowerCase() === `${st.firstName} ${st.lastName}`.toLowerCase()));
                const activeAlert = needToKnowAlerts.find((a) => a.isActive && (a.studentId === st.id || a.studentName.toLowerCase() === `${st.firstName} ${st.lastName}`.toLowerCase()));

                return (
                  <tr key={st.id} onClick={() => onSelectStudent(st)} className="h-14 cursor-pointer border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-3">
                      <div className="flex items-center gap-3">
                        <span className="flex h-8 w-8 items-center justify-center bg-slate-100 text-[11px] font-bold text-slate-700">{st.initials}</span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-slate-900">{st.firstName} {st.lastName}</span>
                            {hasCourt && (
                              <span className="flex items-center gap-0.5 rounded-xs border border-rose-300 bg-rose-50 px-1.5 py-0.2 text-[9px] font-bold text-rose-800">
                                <Gavel size={10} weight="bold" />
                                COURT ORDER
                              </span>
                            )}
                            {activeAlert && (
                              <span className="flex items-center gap-0.5 rounded-xs border border-amber-300 bg-amber-50 px-1.5 py-0.2 text-[9px] font-bold text-amber-800">
                                <ShieldWarning size={10} weight="bold" />
                                {activeAlert.category.toUpperCase()} ALERT
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                  <td className="px-3 font-mono text-xs text-slate-600">{st.id}</td>
                  <td className="px-3 text-xs font-mono text-slate-600">{st.dateOfBirth}</td>
                  <td className="px-3 text-xs">{st.grade} ({st.className})</td>
                  <td className="px-3 text-xs text-slate-600">{st.guardians} linked</td>
                  <td className="px-3"><Badge tone={st.status === "Active" ? "green" : "amber"}>{st.status}</Badge></td>
                  <td className="px-3" onClick={(e) => e.stopPropagation()}>
                    <button onClick={() => onSelectStudent(st)} className="p-1 hover:bg-slate-100 text-slate-500">
                      <DotsThree size={18} weight="bold" />
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">
          Showing {students.length} of {total} records
        </div>
      </section>
    </div>
  );
}

export function GuardianDirectoryModule({
  guardians, onAddGuardian,
}: {
  guardians: GuardianRecord[];
  onAddGuardian: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Guardian Directory</h1>
          <p className="mt-1 text-[13px] text-slate-500">Verified student contacts and communications channels.</p>
        </div>
        <Button onClick={onAddGuardian}><Plus size={16} weight="bold" />Link Guardian</Button>
      </div>

      <section className="border border-slate-200 bg-white">
        <table className="w-full min-w-[850px] border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
              <th className="px-4 font-bold">Guardian Name</th>
              <th className="px-4 font-bold">Linked Student</th>
              <th className="px-4 font-bold">Relationship</th>
              <th className="px-4 font-bold">Email</th>
              <th className="px-4 font-bold">Phone</th>
              <th className="px-4 font-bold">Custody / Legal</th>
            </tr>
          </thead>
          <tbody>
            {guardians.map((g) => (
              <tr key={g.id} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 font-semibold text-xs text-slate-900">{g.firstName} {g.lastName}</td>
                <td className="px-4 text-xs font-semibold text-slate-800">{g.studentName}</td>
                <td className="px-4 text-xs text-slate-700">{g.relationship}</td>
                <td className="px-4 text-xs font-mono text-slate-600">{g.email}</td>
                <td className="px-4 text-xs font-mono text-slate-600">{g.phone}</td>
                <td className="px-4"><Badge tone={g.hasLegalResponsibility ? "blue" : "slate"}>{g.hasLegalResponsibility ? "Legal Responsibility" : "Emergency Only"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
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
          <p className="mt-1 text-[13px] text-slate-500">Classes, grade levels, and curriculum catalog.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={onAddClass}><Plus size={16} />Add Class</Button>
          <Button onClick={onAddSubject}><Plus size={16} />Add Subject</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((cls) => (
          <div key={cls.id} className="border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-slate-900">Class {cls.name}</span>
              <Badge tone="blue">{cls.grade}</Badge>
            </div>
            <div className="mt-2 text-xs text-slate-600">Homeroom: <span className="font-semibold text-slate-800">{cls.homeroomTeacher}</span></div>
          </div>
        ))}
      </div>

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3 font-bold text-xs uppercase text-slate-700">Subject Curriculum Catalog</div>
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[11px] font-semibold text-slate-500 uppercase">
              <th className="px-4 py-2">Code</th>
              <th className="px-4 py-2">Subject Name</th>
              <th className="px-4 py-2">Department</th>
            </tr>
          </thead>
          <tbody>
            {subjects.map((subj) => (
              <tr key={subj.id} className="h-10 border-b border-slate-100 text-xs hover:bg-slate-50/50">
                <td className="px-4 font-mono font-bold text-slate-800">{subj.code}</td>
                <td className="px-4 font-medium text-slate-900">{subj.name}</td>
                <td className="px-4 text-slate-600">{subj.department}</td>
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
      <section className="border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
              <th className="px-4 font-bold">File</th>
              <th className="px-4 font-bold">Rows</th>
              <th className="px-4 font-bold">Valid</th>
              <th className="px-4 font-bold">Status</th>
              <th className="px-4 font-bold">Date</th>
            </tr>
          </thead>
          <tbody>
            {importJobs.map((j) => (
              <tr key={j.id} className="h-12 border-b border-slate-100">
                <td className="px-4 font-mono text-xs font-semibold">{j.sourceFilename}</td>
                <td className="px-4 font-mono text-xs">{j.rowCount}</td>
                <td className="px-4 font-mono text-xs text-green-700 font-bold">{j.validRowCount}</td>
                <td className="px-4"><Badge tone={j.status === "completed" ? "green" : "amber"}>{j.status}</Badge></td>
                <td className="px-4 text-xs text-slate-500">{j.createdAt}</td>
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
      <section className="border border-slate-200 bg-white">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase text-slate-500">
              <th className="px-4 font-bold">Timestamp</th>
              <th className="px-4 font-bold">Action</th>
              <th className="px-4 font-bold">Entity</th>
              <th className="px-4 font-bold">Actor</th>
              <th className="px-4 font-bold">Payload</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.map((log) => (
              <tr key={log.id} className="h-12 border-b border-slate-100">
                <td className="px-4 font-mono text-xs text-slate-500">{log.createdAt}</td>
                <td className="px-4"><Badge tone="blue">{log.action}</Badge></td>
                <td className="px-4 text-xs font-mono">{log.entityId}</td>
                <td className="px-4 text-xs">{log.actorUserId}</td>
                <td className="px-4 text-[11px] font-mono text-slate-600 truncate max-w-xs">{JSON.stringify(log.metadata)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
