"use client";
import { useState } from "react";
import { Directory, DirectoryIdentity, DirectoryStatus } from "./ui/directory";
import { PageHeading } from "./ui/card";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Field, Input } from "./ui/field";
import { Overlay } from "./ui/overlay";
import { StudentAcademicDrawer } from "./student-academic-drawer";
import { GuardianDirectory } from "./people-directories";

const names = ["Ama Boateng", "Kofi Mensah", "Akua Owusu", "Kwame Asante", "Abena Osei", "Yaw Adjei", "Esi Agyeman", "Kojo Appiah", "Afia Addo", "Kweku Antwi", "Adwoa Opoku", "Nana Aidoo", "Akosua Nyarko", "Kwabena Ansah", "Efua Darko", "Yaa Badu", "Kwadwo Amponsah", "Aba Frimpong"];
const initialStudents = names.map((name, index) => ({ id: `sample-${index}`, studentNumber: `ST-${String(index + 1).padStart(4, "0")}`, firstName: name.split(" ")[0], lastName: name.split(" ")[1], status: index % 5 === 0 ? "pending" : "active", className: index % 3 === 0 ? "7A" : "7B", dateOfBirth: "2013-06-12" }));
const initialGuardians = names.slice(0, 7).map((name, index) => ({ id: `guardian-${index}`, firstName: name.split(" ")[0], lastName: name.split(" ")[1], email: `guardian${index}@example.test`, phone: null }));
const links = initialGuardians.slice(0, 5).map((guardian, index) => ({ guardianId: guardian.id, studentId: initialStudents[index].id, isPrimary: true, hasLegalResponsibility: index !== 2 }));

export function DirectoryPreview({ section, office = false }: { section: "students" | "guardians"; office?: boolean }) {
  const [students, setStudents] = useState(initialStudents);
  const [guardians, setGuardians] = useState<{ id: string; firstName: string; lastName: string; email: string | null; phone: string | null }[]>(initialGuardians);
  const [empty, setEmpty] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{ id: string; firstName: string; lastName: string } | null>(null);
  const [notice, setNotice] = useState("");
  const profile = students.find(student => student.id === profileId);
  return <div className="space-y-6"><PageHeading title={section === "students" ? "Students" : "Guardians"} description="Phase 4 directory preview · Synthetic information · Changes last only in this preview." action={<Button variant="secondary" onClick={() => { setEmpty(value => !value); setSelected([]); }}>{empty ? "Show sample records" : "Show empty directory"}</Button>} />
    {notice && <p role="status" className="rounded-control bg-primary-subtle p-4 text-sm text-selected">{notice}</p>}
    {section === "guardians" ? <GuardianDirectory guardians={empty ? [] : guardians} students={students} links={links} onAdd={() => setEditor({ id: "new", firstName: "", lastName: "" })} renderActions={id => { const guardian = guardians.find(row => row.id === id)!; return <Button variant="secondary" aria-label={`Edit ${guardian.firstName} ${guardian.lastName}`} onClick={() => setEditor(guardian)}>Edit</Button>; }} /> : <Directory title="Student directory" description="Enrollment, current-year placement and guardian contacts." resultLabel="students"
      actions={<Button onClick={() => setEditor({ id: "new", firstName: "", lastName: "" })}>Add sample student</Button>}
      columns={[{ key: "name", label: "Student", sortable: true }, { key: "number", label: "Student number", sortable: true }, { key: "class", label: "Current class", sortable: true }, { key: "guardians", label: "Guardians" }, { key: "status", label: "Status", sortable: true }, { key: "actions", label: "Actions" }]}
      filters={[{ key: "status", label: "Status", options: [{ value: "active", label: "Active" }, { value: "pending", label: "Pending" }] }, { key: "class", label: "Class", options: [{ value: "7A", label: "Grade 7 / 7A" }, { value: "7B", label: "Grade 7 / 7B" }] }]}
      selected={office ? undefined : selected} onSelectionChange={office ? undefined : setSelected}
      bulkActions={!office && !!selected.length ? <div className="flex flex-wrap items-center justify-between gap-3 bg-primary-subtle p-6 text-sm text-selected"><p>{selected.length} selected across all pages</p><Button variant="secondary" onClick={() => setSelected([])}>Clear selection</Button></div> : undefined}
      rows={(empty ? [] : students).map(student => ({ id: student.id, name: `${student.firstName} ${student.lastName}`, search: [student.firstName, student.lastName, student.studentNumber].join(" "), values: { name: `${student.lastName} ${student.firstName}`, number: student.studentNumber, class: student.className, status: student.status }, filters: { status: student.status, class: student.className }, cells: {
        name: <DirectoryIdentity name={`${student.firstName} ${student.lastName}`} onClick={() => setProfileId(student.id)} />, number: <span className="font-mono text-xs">{student.studentNumber}</span>, class: `Grade 7 / ${student.className}`, guardians: links.some(link => link.studentId === student.id) ? "Linked sample contact" : <Badge tone="amber">None linked</Badge>, status: <DirectoryStatus value={student.status} />, actions: <Button variant="secondary" aria-label={`Edit ${student.firstName} ${student.lastName}`} onClick={() => setEditor(student)}>Edit</Button>,
      } }))}
      emptyTitle="No students yet" emptyDescription="Set up classes and enroll your first pupil. This preview contains no live records." emptyAction={<Button onClick={() => setEditor({ id: "new", firstName: "", lastName: "" })}>Add your first sample student</Button>}
    />}
    {profile && <StudentAcademicDrawer student={profile} classPlacement={`Grade 7 / ${profile.className} · Synthetic current year`} onClose={() => setProfileId(null)} />}
    <Overlay open={!!editor} onClose={() => setEditor(null)} title={editor?.id === "new" ? section === "guardians" ? "Add sample guardian" : "Add sample student" : section === "guardians" ? "Edit sample guardian" : "Edit sample student"} description="Synthetic preview only. This form does not send data to the school server.">{editor && <form key={editor.id} className="space-y-4" onSubmit={event => { event.preventDefault(); const form = new FormData(event.currentTarget); const firstName = String(form.get("firstName")); const lastName = String(form.get("lastName")); if (section === "guardians") { if (editor.id === "new") { setGuardians([...guardians, { id: `guardian-new-${guardians.length + 1}`, firstName, lastName, email: null, phone: null }]); setEmpty(false); } else setGuardians(guardians.map(guardian => guardian.id === editor.id ? { ...guardian, firstName, lastName } : guardian)); } else if (editor.id === "new") { const index = students.length + 1; setStudents([...students, { ...initialStudents[0], id: `sample-new-${index}`, studentNumber: `ST-${String(index).padStart(4, "0")}`, firstName, lastName }]); setEmpty(false); } else setStudents(students.map(student => student.id === editor.id ? { ...student, firstName, lastName } : student)); setNotice("Synthetic preview record saved."); setEditor(null); }}><Field label="First name"><Input name="firstName" defaultValue={editor.firstName} required /></Field><Field label="Last name"><Input name="lastName" defaultValue={editor.lastName} required /></Field><div className="flex flex-wrap gap-2"><Button type="submit">Save sample</Button><Button type="button" variant="secondary" onClick={() => setEditor(null)}>Cancel</Button></div></form>}</Overlay>
  </div>;
}
