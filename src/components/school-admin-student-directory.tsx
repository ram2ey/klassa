"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type { SchoolAdminData } from "@/lib/school-admin-data";
import { Directory, DirectoryIdentity, DirectoryStatus } from "@/components/ui/directory";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bulkUpdateSchoolStudentsAction } from "@/app/actions/school-admin-actions";
import { StudentAcademicDrawer } from "@/components/student-academic-drawer";

type Props = {
  data: SchoolAdminData;
  query: string;
  onQueryChange?: (value: string) => void;
  currentYearId?: string;
  onEnroll: () => void;
  onEdit: (student: SchoolAdminData["students"][number], classId: string) => void;
};

type QuickFilter = "all" | "unassigned" | "no_guardian" | "incomplete" | "pending" | "alert";

export function SchoolAdminStudentDirectory({ data, query, onQueryChange, currentYearId, onEnroll, onEdit }: Props) {
  const [filter, setFilter] = useState<QuickFilter>("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkClass, setBulkClass] = useState("");
  const [bulkMessage, setBulkMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const students = useMemo(() => data.students.filter(student => {
    const enrollment = data.enrollments.find(item => item.studentId === student.id && item.academicYearId === currentYearId && ["active", "pending"].includes(item.status));
    const linked = data.links.some(link => link.studentId === student.id);
    const hasAlert = data.activeAlerts.some(item => item.studentId === student.id) || data.activeRestrictions.some(item => item.studentId === student.id);
    const searchMatches = `${student.firstName} ${student.lastName} ${student.studentNumber} ${student.externalReference ?? ""}`.toLowerCase().includes(query.trim().toLowerCase());
    if (!searchMatches) return false;
    if (filter === "unassigned") return !enrollment?.classId;
    if (filter === "no_guardian") return !linked;
    if (filter === "incomplete") return !student.dateOfBirth || !linked || !enrollment?.classId;
    if (filter === "pending") return student.status === "pending";
    if (filter === "alert") return hasAlert;
    return true;
  }), [data, query, filter, currentYearId]);

  const selectedStudents = data.students.filter(student => selected.includes(student.id));
  const student = data.students.find(item => item.id === profileId);
  const currentEnrollment = student && data.enrollments.find(item => item.studentId === student.id && item.academicYearId === currentYearId && ["active", "pending"].includes(item.status));
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
    { id: "unassigned", label: "No class", count: data.students.filter(item => !data.enrollments.some(row => row.studentId === item.id && row.academicYearId === currentYearId && ["active", "pending"].includes(row.status) && row.classId)).length },
    { id: "no_guardian", label: "No guardian", count: data.students.filter(item => !data.links.some(row => row.studentId === item.id)).length },
    { id: "incomplete", label: "Incomplete records", count: data.students.filter(item => !item.dateOfBirth || !data.links.some(row => row.studentId === item.id) || !data.enrollments.some(row => row.studentId === item.id && row.academicYearId === currentYearId && ["active", "pending"].includes(row.status) && row.classId)).length },
    { id: "pending", label: "Pending", count: data.students.filter(item => item.status === "pending").length },
    { id: "alert", label: "Active alerts", count: data.students.filter(item => data.activeAlerts.some(alert => alert.studentId === item.id) || data.activeRestrictions.some(restriction => restriction.studentId === item.id)).length },
  ];

  return <>
    <Directory title="Student directory" description="Enrollment, current-year placement and guardian contacts. Open a name to view the academic profile." resultLabel="students" query={query} onQueryChange={onQueryChange}
      actions={<Button aria-label="Enroll student" onClick={onEnroll}>+ Enroll student</Button>}
      onExport={ids => exportCsv(ids.flatMap(id => data.students.filter(row => row.id === id)))}
      filters={[{ key: "status", label: "Status", options: ["pending", "active", "withdrawn", "graduated"].map(value => ({ value, label: value.replace(/^./, letter => letter.toUpperCase()) })) }, { key: "class", label: "Class", options: [{ value: "unassigned", label: "Not assigned" }, ...data.classes.filter(row => row.academicYearId === currentYearId).map(row => ({ value: row.id, label: row.name }))] }]}
      columns={[{ key: "name", label: "Student", sortable: true }, { key: "number", label: "Student number", sortable: true }, { key: "class", label: "Current class", sortable: true }, { key: "guardians", label: "Guardians" }, { key: "status", label: "Status", sortable: true }, { key: "record", label: "Record" }, { key: "actions", label: "Actions" }]}
      rows={students.map(item => {
        const enrollment = data.enrollments.find(row => row.studentId === item.id && row.academicYearId === currentYearId && ["active", "pending"].includes(row.status));
        const klass = data.classes.find(row => row.id === enrollment?.classId); const grade = data.grades.find(row => row.id === klass?.gradeLevelId);
        const placement = klass ? (grade?.name ? grade.name + " / " : "") + klass.name : "Not assigned";
        const links = data.links.filter(row => row.studentId === item.id);
        const complete = !!(item.dateOfBirth && klass && links.length);
        return { id: item.id, name: item.firstName + " " + item.lastName, search: [item.firstName, item.lastName, item.studentNumber, item.externalReference].join(" "), values: { name: item.lastName + " " + item.firstName, number: item.studentNumber, class: placement, status: item.status }, filters: { status: item.status, class: klass?.id ?? "unassigned" }, cells: {
          name: <><DirectoryIdentity name={item.firstName + " " + item.lastName} onClick={() => setProfileId(item.id)} /><div className="mt-1 flex flex-wrap gap-1">{data.activeAlerts.some(row => row.studentId === item.id) && <Badge tone="amber">Staff alert</Badge>}{data.activeRestrictions.some(row => row.studentId === item.id) && <Badge tone="danger">Safety restriction</Badge>}</div></>,
          number: <span className="font-mono text-xs">{item.studentNumber}{item.externalReference && <small className="block text-secondary">Old ID: {item.externalReference}</small>}</span>,
          class: placement, guardians: links.map(link => { const guardian = data.guardians.find(row => row.id === link.guardianId); return guardian ? guardian.firstName + " " + guardian.lastName : ""; }).filter(Boolean).join(", ") || "None linked",
          status: <DirectoryStatus value={item.status} />, record: <Badge tone={complete ? "green" : "amber"}>{complete ? "Complete" : "Needs attention"}</Badge>,
          actions: <Button variant="secondary" onClick={() => onEdit(item, enrollment?.classId ?? "")}>Edit<span className="sr-only"> {item.firstName} {item.lastName}</span></Button>,
        } };
      })}
      selected={selected} onSelectionChange={setSelected} selectionDisabled={pending} bulkActions={selected.length > 0 ? <div className="space-y-3 border-b border-line bg-primary-subtle px-4 py-3 text-sm"><div className="flex flex-wrap items-center justify-between gap-3"><span>{selected.length} selected</span><div className="flex flex-wrap gap-2"><Button variant="secondary" className="min-h-10" onClick={() => exportCsv(selectedStudents)}>Export selected</Button><label className="sr-only" htmlFor="bulk-status">Set selected students’ status</label><select id="bulk-status" aria-label="Set selected students’ status" value={bulkStatus} onChange={event => setBulkStatus(event.target.value)} className="min-h-10 border ui-field px-2"><option value="">Keep status</option>{["pending", "active", "withdrawn", "graduated"].map(status => <option key={status} value={status}>{status.replace(/^./, letter => letter.toUpperCase())}</option>)}</select><label className="sr-only" htmlFor="bulk-class">Assign selected students to class</label><select id="bulk-class" aria-label="Assign selected students to class" value={bulkClass} onChange={event => setBulkClass(event.target.value)} className="min-h-10 max-w-64 border ui-field px-2"><option value="">Keep current class</option>{data.classes.filter(item => item.academicYearId === currentYearId).map(item => ({ ...item, grade: data.grades.find(grade => grade.id === item.gradeLevelId)?.name })).map(item => <option key={item.id} value={item.id}>{item.grade} / {item.name}</option>)}</select><Button className="min-h-10" disabled={pending || (!bulkStatus && !bulkClass)} onClick={applyBulkUpdate}>{pending ? "Updating…" : `Update ${selected.length}`}</Button><Button variant="secondary" className="min-h-10" disabled={pending} onClick={() => { setSelected([]); setBulkMessage(""); }}>Clear selection</Button></div></div></div> : undefined}
      toolbar={<div className="space-y-3">{!currentYearId && <p className="rounded-control bg-warning-subtle p-3 text-sm text-warning">Set a current year in Academic years, then add classes before enrolling students.</p>}<div className="flex flex-wrap gap-2" role="group" aria-label="Student quick filters">{quickFilters.map(item => <Button key={item.id} variant={filter === item.id ? "primary" : "secondary"} size="sm" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span className="tabular-nums">{item.count}</span></Button>)}</div>{bulkMessage && <p role="status" className="text-sm text-selected">{bulkMessage}</p>}</div>}
      resetKey={filter} hasExternalFilters={filter !== "all"} onClearFilters={() => setFilter("all")} emptyTitle="No students yet" emptyDescription="Set up current-year classes, then enroll your first pupil or import a roster below." emptyAction={<Button onClick={onEnroll}>Enroll your first student</Button>}
    />
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
        timetablePeriods={(data.timetable ?? []).filter(p => p.classId === currentEnrollment?.classId)}
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
          ...studentRestrictions.map(() => ({ type: "pickup" as const, title: "Safety restriction", detail: "Enforced court order on file" })),
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
