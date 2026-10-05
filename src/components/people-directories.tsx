import type { ReactNode } from "react";
import type { OfficeData } from "@/lib/office-data";
import { Directory, DirectoryIdentity, DirectoryStatus } from "./ui/directory";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

type Guardian = { id: string; firstName: string; lastName: string; email: string | null; phone: string | null };
type Student = { id: string; firstName: string; lastName: string };
type Relationship = { guardianId: string; studentId: string; isPrimary: boolean; hasLegalResponsibility: boolean };
export function GuardianDirectory({ guardians, students, links, query, onQueryChange, onAdd, renderActions }: {
  guardians: Guardian[]; students: Student[]; links: Relationship[]; query?: string; onQueryChange?: (value: string) => void;
  onAdd: () => void; renderActions: (guardianId: string) => ReactNode;
}) {
  return <Directory title="Guardian contacts" description="Contact records and student links. Legal responsibility is recorded per relationship." resultLabel="guardians" query={query} onQueryChange={onQueryChange}
    actions={<Button onClick={onAdd}>Add guardian</Button>} emptyTitle="No guardian contacts yet" emptyDescription="Add a contact, then use Student relationships to link them to a pupil." emptyAction={<Button onClick={onAdd}>Add your first guardian</Button>}
    filters={[{ key: "linked", label: "Student links", options: [{ value: "yes", label: "Linked to students" }, { value: "no", label: "No linked students" }] }, { key: "legal", label: "Responsibility", options: [{ value: "yes", label: "Has legal responsibility" }, { value: "no", label: "No legal responsibility recorded" }] }]}
    columns={[{ key: "name", label: "Name", sortable: true }, { key: "contact", label: "Contact details" }, { key: "students", label: "Linked students" }, { key: "responsibility", label: "Responsibility" }, { key: "actions", label: "Actions" }]}
    rows={guardians.map(guardian => {
      const relationships = links.filter(link => link.guardianId === guardian.id);
      const children = relationships.map(link => students.find(student => student.id === link.studentId)).filter(Boolean).map(student => `${student!.firstName} ${student!.lastName}`).join(", ");
      return { id: guardian.id, name: `${guardian.firstName} ${guardian.lastName}`, search: [guardian.firstName, guardian.lastName, guardian.email, guardian.phone, children].join(" "), values: { name: `${guardian.lastName} ${guardian.firstName}` }, filters: { linked: relationships.length ? "yes" : "no", legal: relationships.some(link => link.hasLegalResponsibility) ? "yes" : "no" }, cells: {
        name: <DirectoryIdentity name={`${guardian.firstName} ${guardian.lastName}`} />,
        contact: <div className="space-y-1 text-xs">{guardian.email ? <a className="block text-selected hover:underline" href={`mailto:${guardian.email}`}>{guardian.email}</a> : <p className="text-secondary">Email not provided</p>}{guardian.phone ? <a className="block text-selected hover:underline" href={`tel:${guardian.phone}`}>{guardian.phone}</a> : <p className="text-secondary">Phone not provided</p>}</div>,
        students: children || "None linked",
        responsibility: <div className="flex flex-wrap gap-1"><Badge tone={relationships.some(link => link.hasLegalResponsibility) ? "primary" : "slate"}>{relationships.some(link => link.hasLegalResponsibility) ? "Legal responsibility" : "No legal link"}</Badge>{relationships.some(link => link.isPrimary) && <Badge>Primary contact</Badge>}</div>,
        actions: <div className="flex flex-wrap gap-2">{renderActions(guardian.id)}</div>,
      } };
    })}
  />;
}

export function OfficeStudentDirectory({ data, query, onQueryChange, onEnroll, onEdit, hasRestriction }: { data: OfficeData; query: string; onQueryChange: (value: string) => void; onEnroll: () => void; onEdit: (student: OfficeData["students"][number]) => void; hasRestriction: (id: string) => boolean }) {
  const year = data.years.find(row => row.isCurrent);
  const classes = data.classes.filter(row => row.academicYearId === year?.id);
  return <Directory title="Student directory" description="School intake, current-year placement and guardian contacts." resultLabel="students" query={query} onQueryChange={onQueryChange}
    actions={<Button onClick={onEnroll}>Enroll student</Button>} emptyTitle="No students enrolled yet" emptyDescription="Prepare the school year and classes, then enroll your first pupil." emptyAction={<Button onClick={onEnroll}>Enroll your first student</Button>}
    filters={[{ key: "status", label: "Status", options: ["active", "pending", "withdrawn", "graduated"].map(value => ({ value, label: value.replace(/^./, letter => letter.toUpperCase()) })) }, { key: "class", label: "Class", options: [{ value: "unassigned", label: "Not assigned" }, ...classes.map(row => ({ value: row.id, label: row.name }))] }]}
    columns={[{ key: "name", label: "Student", sortable: true }, { key: "number", label: "Number", sortable: true }, { key: "class", label: "Current class", sortable: true }, { key: "guardians", label: "Guardians" }, { key: "status", label: "Status", sortable: true }, { key: "actions", label: "Actions" }]}
    rows={data.students.map(student => {
      const enrollment = data.enrollments.find(row => row.studentId === student.id && row.academicYearId === year?.id && ["active", "pending"].includes(row.status));
      const klass = classes.find(row => row.id === enrollment?.classId);
      const grade = data.grades.find(row => row.id === klass?.gradeLevelId);
      const placement = klass ? `${grade?.name ?? ""} / ${klass.name}` : "Not assigned";
      return { id: student.id, name: `${student.firstName} ${student.lastName}`, search: [student.firstName, student.lastName, student.studentNumber, student.externalReference].join(" "), values: { name: `${student.lastName} ${student.firstName}`, number: student.studentNumber, class: placement, status: student.status }, filters: { status: student.status, class: klass?.id ?? "unassigned" }, cells: {
        name: <><DirectoryIdentity name={`${student.firstName} ${student.lastName}`} />{hasRestriction(student.id) && <p className="mt-2 text-xs font-semibold text-warning">Pickup or disclosure restriction: check details before release</p>}</>,
        number: <span className="font-mono text-xs">{student.studentNumber}{student.externalReference && <small className="block text-secondary">Old ID: {student.externalReference}</small>}</span>, class: placement,
        guardians: data.links.filter(row => row.studentId === student.id).map(link => data.guardians.find(guardian => guardian.id === link.guardianId)).filter(Boolean).map(guardian => `${guardian!.firstName} ${guardian!.lastName}`).join(", ") || "None linked",
        status: <DirectoryStatus value={student.status} />, actions: <Button variant="secondary" aria-label={`Edit ${student.firstName} ${student.lastName}`} onClick={() => onEdit(student)}>Edit</Button>,
      } };
    })}
  />;
}
