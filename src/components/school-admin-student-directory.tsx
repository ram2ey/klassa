"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import { Button } from "@/components/ui/button";
import { bulkUpdateSchoolStudentsAction } from "@/app/actions/school-admin-actions";
import { StudentAcademicDrawer } from "@/components/student-academic-drawer";

type Props = {
  data: SchoolAdminData;
  query: string;
  currentYearId?: string;
  onEnroll: () => void;
  onEdit: (student: SchoolAdminData["students"][number], classId: string) => void;
};

const PAGE_SIZE = 10;
type QuickFilter = "all" | "unassigned" | "no_guardian" | "incomplete" | "pending" | "alert";

export function SchoolAdminStudentDirectory({ data, query, currentYearId, onEnroll, onEdit }: Props) {
  const [filter, setFilter] = useState<QuickFilter>("all");
  const [sort, setSort] = useState("name");
  const [direction, setDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkClass, setBulkClass] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const students = useMemo(() => data.students.filter(student => {
    const enrollment = data.enrollments.find(item => item.studentId === student.id && item.academicYearId === currentYearId);
    const linked = data.links.some(link => link.studentId === student.id);
    const hasAlert = data.activeAlerts.some(item => item.studentId === student.id) || data.activeRestrictions.some(item => item.studentId === student.id);
    const searchMatches = `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.externalReference ?? ""}`.toLowerCase().includes(query.toLowerCase());
    if (!searchMatches) return false;
    if (filter === "unassigned") return !enrollment?.classId;
    if (filter === "no_guardian") return !linked;
    if (filter === "incomplete") return !student.dateOfBirth || !linked || !enrollment?.classId;
    if (filter === "pending") return student.status === "pending";
    if (filter === "alert") return hasAlert;
    return true;
  }).sort((a, b) => {
    const placement = (id: string) => data.enrollments.find(item => item.studentId === id && item.academicYearId === currentYearId)?.classId ?? "";
    const aValue = sort === "number" ? a.studentNumber : sort === "class" ? placement(a.id) : sort === "status" ? a.status : `${a.lastName} ${a.firstName}`;
    const bValue = sort === "number" ? b.studentNumber : sort === "class" ? placement(b.id) : sort === "status" ? b.status : `${b.lastName} ${b.firstName}`;
    return String(aValue).localeCompare(String(bValue), undefined, { numeric: true }) * (direction === "asc" ? 1 : -1);
  }), [data, query, filter, sort, direction, currentYearId]);

  const setSortBy = (value: string) => { if (sort === value) setDirection(direction === "asc" ? "desc" : "asc"); else { setSort(value); setDirection("asc"); } setPage(1); };
  const pages = Math.max(1, Math.ceil(students.length / PAGE_SIZE));
  const safePage = Math.min(page, pages);
  const visible = students.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const selectedStudents = data.students.filter(student => selected.includes(student.id));
  const student = data.students.find(item => item.id === profileId);
  const currentEnrollment = student && data.enrollments.find(item => item.studentId === student.id && item.academicYearId === currentYearId);
  const currentClass = currentEnrollment ? data.classes.find(c => c.id === currentEnrollment.classId) : null;
  const currentGrade = currentClass ? data.grades.find(g => g.id === currentClass.gradeLevelId) : null;
  const classPlacement = currentClass ? `${currentGrade?.name ? `${currentGrade.name} / ` : ""}${currentClass.name} · ${currentYearId ? data.years.find(y => y.id === currentYearId)?.name ?? "" : ""}` : "Not assigned";
  const guardianLinks = student ? data.links.filter(link => link.studentId === student.id) : [];
  const studentAlerts = student ? data.activeAlerts.filter(item => item.studentId === student.id) : [];
  const studentRestrictions = student ? data.activeRestrictions.filter(item => item.studentId === student.id) : [];
  const attendance = student ? data.attendanceSummary.find(item => item.studentId === student.id) : undefined;
  const reportHistory = student ? data.publishedReports.filter(item => item.studentId === student.id) : [];

  function exportCsv(rows: typeof data.students) {
    const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
    const lines = [["Student number", "First name", "Last name", "Date of birth", "Status", "Current class", "Guardians", "External reference"], ...rows.map(item => {
      const enrollment = data.enrollments.find(row => row.studentId === item.id && row.academicYearId === currentYearId);
      const klass = data.classes.find(row => row.id === enrollment?.classId);
      const grade = data.grades.find(row => row.id === klass?.gradeLevelId);
      const contacts = data.links.filter(row => row.studentId === item.id).map(row => data.guardians.find(g => g.id === row.guardianId)).filter(Boolean).map(g => `${g!.firstName} ${g!.lastName}`).join("; ");
      return [item.studentNumber, item.firstName, item.lastName, item.dateOfBirth, item.status, klass ? `${grade?.name ?? ""} / ${klass.name}` : "Not assigned", contacts, item.externalReference];
    })].map(row => row.map(csvCell).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", lines], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "student-directory.csv"; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function applyBulkUpdate() {
    if (!selected.length || (!bulkStatus && !bulkClass)) return;
    setBulkMessage("");
    startTransition(async () => {
      try {
        const result = await bulkUpdateSchoolStudentsAction({ studentIds: selected, ...(bulkStatus ? { status: bulkStatus as "pending" | "active" | "withdrawn" | "graduated" } : {}), ...(bulkClass ? { classId: bulkClass } : {}) });
        if (!result.success) { setBulkMessage(result.error); return; }
        setBulkMessage(`Updated ${result.updatedCount} student records.`);
        setSelected([]); setBulkStatus(""); setBulkClass(""); router.refresh();
      } catch { setBulkMessage("The bulk update could not be saved. Refresh the directory and try again."); }
    });
  }

  const quickFilters: { id: QuickFilter; label: string; count: number }[] = [
    { id: "all", label: "All students", count: data.students.length },
    { id: "unassigned", label: "No class", count: data.students.filter(item => !data.enrollments.some(row => row.studentId === item.id && row.academicYearId === currentYearId && row.classId)).length },
    { id: "no_guardian", label: "No guardian", count: data.students.filter(item => !data.links.some(row => row.studentId === item.id)).length },
    { id: "incomplete", label: "Incomplete records", count: data.students.filter(item => !item.dateOfBirth || !data.links.some(row => row.studentId === item.id) || !data.enrollments.some(row => row.studentId === item.id && row.academicYearId === currentYearId && row.classId)).length },
    { id: "pending", label: "Pending", count: data.students.filter(item => item.status === "pending").length },
    { id: "alert", label: "Active alerts", count: data.students.filter(item => data.activeAlerts.some(alert => alert.studentId === item.id) || data.activeRestrictions.some(restriction => restriction.studentId === item.id)).length },
  ];

  return <>
    <section className="border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div><h2 className="font-bold">Student directory</h2><p className="mt-1 text-sm text-slate-500">Enrollment, class placement and student details.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" className="min-h-11" disabled={!students.length} onClick={() => exportCsv(students)}>Export CSV</Button><Button aria-label="Enroll student" className="min-h-11" onClick={onEnroll}>+ Enroll student</Button></div>
      </div>
      {!currentYearId && <p className="border-b border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">Set a current year in Academic years, then add classes before enrolling students.</p>}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3" aria-label="Student quick filters">
        {quickFilters.map(item => <button key={item.id} aria-pressed={filter === item.id} onClick={() => { setFilter(item.id); setPage(1); }} className={`min-h-10 border px-3 text-xs font-medium ${filter === item.id ? "border-blue-700 bg-blue-50 text-blue-800" : "border-slate-200 text-slate-600 hover:bg-slate-50"}`}>{item.label} <span className="ml-1 tabular-nums">{item.count}</span></button>)}
        <label className="ml-auto flex min-h-10 items-center gap-2 text-xs text-slate-600">Sort by <select aria-label="Sort students" value={sort} onChange={event => setSortBy(event.target.value)} className="h-10 border border-slate-300 bg-white px-2"><option value="name">Name</option><option value="number">Student number</option><option value="class">Class</option><option value="status">Status</option></select><button className="min-h-10 border border-slate-300 px-3" onClick={() => setDirection(direction === "asc" ? "desc" : "asc")} aria-label={`Sort ${direction === "asc" ? "descending" : "ascending"}`}>{direction === "asc" ? "A–Z ↑" : "Z–A ↓"}</button></label>
      </div>
      {selected.length > 0 && <div className="space-y-3 border-b border-blue-100 bg-blue-50 px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><span>{selected.length} selected</span><div className="flex flex-wrap gap-2"><Button variant="secondary" className="min-h-10" onClick={() => exportCsv(selectedStudents)}>Export selected</Button><label className="sr-only" htmlFor="bulk-status">Set selected students’ status</label><select id="bulk-status" aria-label="Set selected students’ status" value={bulkStatus} onChange={event => setBulkStatus(event.target.value)} className="min-h-10 border border-slate-300 bg-white px-2"><option value="">Keep status</option>{["pending", "active", "withdrawn", "graduated"].map(status => <option key={status} value={status}>{status.replace(/^./, letter => letter.toUpperCase())}</option>)}</select><label className="sr-only" htmlFor="bulk-class">Assign selected students to class</label><select id="bulk-class" aria-label="Assign selected students to class" value={bulkClass} onChange={event => setBulkClass(event.target.value)} className="min-h-10 max-w-64 border border-slate-300 bg-white px-2"><option value="">Keep current class</option>{data.classes.filter(item => item.academicYearId === currentYearId).map(item => ({ ...item, grade: data.grades.find(grade => grade.id === item.gradeLevelId)?.name })).map(item => <option key={item.id} value={item.id}>{item.grade} / {item.name}</option>)}</select><Button className="min-h-10" disabled={pending || (!bulkStatus && !bulkClass)} onClick={applyBulkUpdate}>{pending ? "Updating…" : `Update ${selected.length}`}</Button><Button variant="secondary" className="min-h-10" disabled={pending} onClick={() => { setSelected([]); setBulkMessage(""); }}>Clear selection</Button></div></div>{bulkMessage && <p role="status" className="text-sm text-blue-900">{bulkMessage}</p>}</div>}
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><caption className="sr-only">Student directory</caption><thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>
        <th className="px-4 py-3"><input aria-label="Select all visible students" type="checkbox" checked={visible.length > 0 && visible.every(item => selected.includes(item.id))} onChange={event => setSelected(event.target.checked ? Array.from(new Set([...selected, ...visible.map(item => item.id)])) : selected.filter(id => !visible.some(item => item.id === id)))} /></th>
        <th className="px-4 py-3">Student</th><th className="px-4 py-3">Student number</th><th className="px-4 py-3">Current class</th><th className="px-4 py-3">Guardians</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Record</th><th className="px-4 py-3">Actions</th>
      </tr></thead><tbody className="divide-y divide-slate-100">{visible.map(item => {
        const enrollment = data.enrollments.find(row => row.studentId === item.id && row.academicYearId === currentYearId);
        const klass = data.classes.find(row => row.id === enrollment?.classId); const grade = data.grades.find(row => row.id === klass?.gradeLevelId);
        const linked = data.links.filter(row => row.studentId === item.id);
        const complete = Boolean(item.dateOfBirth && enrollment?.classId && linked.length);
        const hasAlert = data.activeAlerts.some(alert => alert.studentId === item.id);
        const hasRestriction = data.activeRestrictions.some(restriction => restriction.studentId === item.id);
        return <tr key={item.id} className="hover:bg-slate-50"><td className="px-4 py-3"><input type="checkbox" aria-label={`Select ${item.firstName} ${item.lastName}`} checked={selected.includes(item.id)} onChange={event => setSelected(event.target.checked ? [...selected, item.id] : selected.filter(id => id !== item.id))} /></td><td className="px-4 py-3"><button className="text-left font-semibold text-blue-800 hover:underline" onClick={() => setProfileId(item.id)}>{item.firstName} {item.lastName}</button><div className="mt-1 flex flex-wrap gap-1">{hasAlert && <span className="border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">Staff alert</span>}{hasRestriction && <span className="border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-medium text-rose-900">Safety restriction</span>}</div></td><td className="px-4 py-3 font-mono text-xs">{item.studentNumber}{item.externalReference && <small className="block text-slate-500">Old ID: {item.externalReference}</small>}</td><td className="px-4 py-3">{klass ? `${grade?.name ?? ""} / ${klass.name}` : <span className="text-amber-700">Not assigned</span>}</td><td className="px-4 py-3">{linked.map(link => { const guardian = data.guardians.find(row => row.id === link.guardianId); return guardian ? `${guardian.firstName} ${guardian.lastName}` : ""; }).filter(Boolean).join(", ") || <span className="text-amber-700">None linked</span>}</td><td className="px-4 py-3"><span className={`border px-2 py-1 text-xs ${item.status === "active" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-amber-200 bg-amber-50 text-amber-800"}`}>{item.status}</span></td><td className="px-4 py-3"><span className={complete ? "text-emerald-700" : "text-amber-700"}>{complete ? "Complete" : "Needs attention"}</span></td><td className="px-4 py-3"><Button variant="secondary" className="min-h-10" onClick={() => onEdit(item, enrollment?.classId ?? "")}>Edit<span className="sr-only"> {item.firstName} {item.lastName}</span></Button></td></tr>;
      })}</tbody></table></div>
      {students.length === 0 ? <p className="px-6 py-12 text-center text-sm text-slate-500">No students match this view.</p> : <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 text-sm text-slate-600"><span>Showing {Math.min(students.length, (safePage - 1) * PAGE_SIZE + 1)}–{Math.min(students.length, safePage * PAGE_SIZE)} of {students.length} students</span><div className="flex gap-2"><Button variant="secondary" className="min-h-10" disabled={safePage === 1} onClick={() => setPage(safePage - 1)}>Previous</Button><span className="flex min-h-10 items-center px-2">Page {safePage} of {pages}</span><Button variant="secondary" className="min-h-10" disabled={safePage === pages} onClick={() => setPage(safePage + 1)}>Next</Button></div></div>}
    </section>
    {student && (
      <StudentAcademicDrawer
        student={student}
        classPlacement={classPlacement}
        academicYears={data.years}
        terms={data.terms}
        subjects={data.subjects}
        classes={data.classes}
        gradeLevels={data.grades}
        enrollments={data.enrollments}
        reports={reportHistory}
        reportSubjects={data.reportSubjects ?? []}
        attendance={attendance ? { total: Number(attendance.total), attended: Number(attendance.attended), absent: Number(attendance.absent) } : undefined}
        behaviours={(data.behaviours ?? []).filter(b => b.studentId === student.id)}
        guardians={guardianLinks.map(link => {
          const guardian = data.guardians.find(row => row.id === link.guardianId);
          return {
            id: link.id,
            firstName: guardian?.firstName ?? "",
            lastName: guardian?.lastName ?? "",
            phone: guardian?.phone,
            email: guardian?.email,
            relationship: link.relationship,
            isPrimary: link.isPrimary,
            hasLegalResponsibility: link.hasLegalResponsibility,
          };
        })}
        safetyNotices={[
          ...studentAlerts.map(a => ({ type: "directive" as const, title: a.category.replace(/_/g, " "), detail: `Active directive (${a.severity})` })),
          ...studentRestrictions.map(r => ({ type: "pickup" as const, title: "Safety restriction", detail: "Enforced court order on file" })),
        ]}
        onClose={() => setProfileId(null)}
        onEditStudent={() => {
          onEdit(student, currentEnrollment?.classId ?? "");
          setProfileId(null);
        }}
      />
    )}
  </>;
}
