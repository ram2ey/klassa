"use client";

import { GuardianDirectory, OfficeStudentDirectory } from "@/components/people-directories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { Overlay } from "@/components/ui/overlay";
import { OfficeOverview } from "@/components/school-overviews";
import { GuardianSmsPreferences } from "@/components/guardian-sms-preferences";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WorkspaceShell } from "@/components/workspace-shell";
import { groupWorkspaceNavigation, officeNavigationItems } from "@/components/workspace-navigation";
import { StudentCsvImport } from "@/components/student-csv-import";
import { StudentEnrollmentFlow } from "@/components/student-enrollment-flow";
import {
  correctOfficeAttendanceAction,
  markGuardianAbsenceNoteReviewedAction,
  recordReceptionDeskAction,
  reviewAndExcuseGuardianAbsenceAction,
  saveOfficeRecordAction,
} from "@/app/actions/office-actions";
import { previewParentSmsAction, queueParentSmsAction } from "@/app/actions/parent-sms-actions";
import { ParentSmsAnnouncements } from "@/components/parent-sms-announcements";
import { confirmGuardianPhoneAction } from "@/app/actions/guardian-phone-actions";
import type { OfficeData } from "@/lib/office-data";
import type { SchoolCommand } from "@/lib/school-admin-policy";
import type { announcements } from "@/db/schema";
import { ShieldAlert } from "lucide-react";

const tabs = officeNavigationItems;
const field = "ui-field mt-1";
const primary = "min-h-11 rounded-control bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-50 transition-colors";
const secondary = "min-h-11 rounded-control border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-subtle disabled:opacity-50 transition-colors";
const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const str = (form: FormData, name: string) => String(form.get(name) ?? "");
type Editor = { kind: "student" | "guardian" | "guardian_link"; values?: Record<string, string | boolean | null> };

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required = true,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        className={field}
      />
    </label>
  );
}

function Select({
  label,
  name,
  choices,
  defaultValue,
}: {
  label: string;
  name: string;
  choices: { id: string; name: string }[];
  defaultValue?: string;
}) {
  return (
    <label className="block text-sm font-medium text-ink">
      {label}
      <select name={name} required defaultValue={defaultValue ?? ""} className={field}>
        <option value="">Choose {label.toLowerCase()}</option>
        {choices.map(item => (
          <option key={item.id} value={item.id}>
            {item.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Card({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-subtle px-5 py-4 bg-surface">
        <h2 className="text-base font-semibold text-ink">{title}</h2>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function OfficeWorkspace({
  data,
  notices,
  section,
  date,
}: {
  data: OfficeData;
  notices: (typeof announcements.$inferSelect)[];
  section: string;
  date: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [showEnrollment, setShowEnrollment] = useState(false);
  const [attendanceClass, setAttendanceClass] = useState("");
  const [receptionType, setReceptionType] = useState<"late_arrival" | "early_departure">("late_arrival");
  const [selectedReceptionStudent, setSelectedReceptionStudent] = useState("");

  const current = tabs.find(tab => tab.id === section) ?? tabs[0];
  const year = data.years.find(row => row.isCurrent);
  const yearClasses = data.classes.filter(row => row.academicYearId === year?.id);
  const selectedAttendanceClass = yearClasses.some(row => row.id === attendanceClass)
    ? attendanceClass
    : yearClasses[0]?.id ?? "";
  const classOptions = yearClasses.map(row => ({
    id: row.id,
    name: `${data.grades.find(grade => grade.id === row.gradeLevelId)?.name ?? "Grade"} / ${row.name}`,
  }));
  const studentOptions = data.students.map(row => ({ id: row.id, name: `${row.firstName} ${row.lastName}` }));
  const guardianOptions = data.guardians.map(row => ({ id: row.id, name: `${row.firstName} ${row.lastName}` }));

  const name = (id: string) => {
    const row = data.students.find(item => item.id === id);
    return row ? `${row.firstName} ${row.lastName}` : "Unknown student";
  };
  const guardianName = (id: string) => {
    const row = data.guardians.find(item => item.id === id);
    return row ? `${row.firstName} ${row.lastName}` : "Unknown guardian";
  };
  const enrollment = (id: string) =>
    data.enrollments.find(row => row.studentId === id && row.academicYearId === year?.id);
  const classLabel = (id?: string | null) => {
    const row = data.classes.find(item => item.id === id);
    return row
      ? `${data.grades.find(grade => grade.id === row.gradeLevelId)?.name ?? "Grade"} / ${row.name}`
      : "Unassigned";
  };

  const today = new Date().toISOString().slice(0, 10);
  const activeRestrictions = (id: string) =>
    data.restrictions.filter(
      row =>
        row.studentId === id &&
        row.isEnforced &&
        (row.prohibitPickup || row.prohibitDisclosure) &&
        row.effectiveDate <= today &&
        (!row.expirationDate || row.expirationDate >= today)
    );
  const selectedStudentRestrictions = selectedReceptionStudent ? activeRestrictions(selectedReceptionStudent) : [];
  const matches = (...values: unknown[]) => values.join(" ").toLowerCase().includes(query.toLowerCase());

  const attendanceSession = data.sessions.find(
    row => row.classId === selectedAttendanceClass && row.period === "morning_roll_call"
  );
  const attendanceRecords = data.records
    .filter(row => row.sessionId === attendanceSession?.id)
    .sort((a, b) => name(a.studentId).localeCompare(name(b.studentId)));

  const save = (command: SchoolCommand) =>
    start(async () => {
      setMessage("");
      const result = await saveOfficeRecordAction(command);
      setMessage(result.success ? "Saved successfully." : result.error);
      if (result.success) {
        setEditor(null);
        router.refresh();
      }
    });

  const submit = (event: React.FormEvent<HTMLFormElement>, make: (form: FormData) => SchoolCommand) => {
    event.preventDefault();
    save(make(new FormData(event.currentTarget)));
  };

  const editStudent = (student: OfficeData["students"][number]) =>
    setEditor({
      kind: "student",
      values: {
        id: student.id,
        firstName: student.firstName,
        lastName: student.lastName,
        dateOfBirth: student.dateOfBirth,
        status: student.status,
        classId: enrollment(student.id)?.classId ?? "",
      },
    });

  const editGuardian = (guardian: OfficeData["guardians"][number]) =>
    setEditor({
      kind: "guardian",
      values: {
        id: guardian.id,
        firstName: guardian.firstName,
        lastName: guardian.lastName,
        email: guardian.email,
        phone: guardian.phone,
      },
    });

  const editLink = (link: OfficeData["links"][number]) =>
    setEditor({
      kind: "guardian_link",
      values: {
        studentId: link.studentId,
        guardianId: link.guardianId,
        relationship: link.relationship,
        isPrimary: link.isPrimary,
        hasLegalResponsibility: link.hasLegalResponsibility,
      },
    });

  return (
    <>
      <WorkspaceShell
        schoolName={data.school.name}
        academicYear={year?.name ?? "Academic year not set"}
        actorName={data.actor.name}
        roleLabel="Office staff"
        navigationLabel="Office navigation"
        groups={groupWorkspaceNavigation(tabs)}
        activeId={current.id}
        contentId="office-content"
        switchSchoolHref="/schools"
        onNavigate={() => {
          setQuery("");
          setEditor(null);
        }}
      >
        {current.id !== "overview" && (
          <div className="flex flex-wrap items-end justify-between gap-3 mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-secondary">School operations</p>
              <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">{current.label}</h1>
            </div>
          </div>
        )}

        {message && (
          <div
            role="status"
            className="rounded-control border border-primary/20 bg-primary-subtle p-3.5 text-sm font-medium text-ink shadow-xs"
          >
            {message}
          </div>
        )}

        {current.id === "overview" && data.medicalAlerts?.length > 0 && (
          <Link
            href={`/?section=attendance&date=${encodeURIComponent(date)}`}
            className="block rounded-card border border-warning/30 bg-warning-subtle p-4 text-sm font-semibold text-warning hover:bg-warning-subtle/80 transition-colors shadow-xs"
          >
            ⚠️ Active medical directives require attention. Review the operational attendance view before assisting pupils.
          </Link>
        )}

        {current.id === "overview" && <OfficeOverview data={data} date={date} notices={notices} />}

        {/* ---------------- STUDENTS ---------------- */}
        {current.id === "students" && (
          <div className="space-y-6">
            <OfficeStudentDirectory
              data={data}
              query={query}
              onQueryChange={setQuery}
              onEnroll={() => setShowEnrollment(true)}
              onEdit={editStudent}
              hasRestriction={id => activeRestrictions(id).length > 0}
            />
          </div>
        )}

        {/* ---------------- GUARDIANS ---------------- */}
        {current.id === "guardians" && (
          <div className="space-y-6">
            <Tabs
              label="Guardian management"
              items={[
                {
                  value: "directory",
                  label: "Guardian contacts",
                  content: (
                    <GuardianDirectory
                      guardians={data.guardians}
                      students={data.students}
                      links={data.links}
                      query={query}
                      onQueryChange={setQuery}
                      onAdd={() => setEditor({ kind: "guardian" })}
                      renderActions={id => {
                        const guardian = data.guardians.find(row => row.id === id)!;
                        return (
                          <Button
                            variant="secondary"
                            size="sm"
                            aria-label={`Edit ${guardian.firstName} ${guardian.lastName}`}
                            onClick={() => editGuardian(guardian)}
                          >
                            Edit
                          </Button>
                        );
                      }}
                    />
                  ),
                },
                {
                  value: "relationships",
                  label: "Student relationships",
                  content: (
                    <Card
                      title="Student relationships"
                      action={
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setEditor({ kind: "guardian_link" })}
                        >
                          Link guardian
                        </Button>
                      }
                    >
                      <p className="mb-4 text-xs text-secondary">
                        Manage authorized legal guardians, primary contacts, and parental relationships.
                      </p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead>
                            <tr className="border-b border-line-subtle text-secondary font-medium text-xs uppercase tracking-wider">
                              <th className="py-2.5">Student</th>
                              <th>Guardian</th>
                              <th>Relationship</th>
                              <th>Primary</th>
                              <th>Legal responsibility</th>
                              <th className="text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line-subtle">
                            {data.links
                              .filter(link => matches(name(link.studentId), guardianName(link.guardianId)))
                              .map(link => (
                                <tr key={link.id} className="hover:bg-surface-subtle transition-colors">
                                  <td className="py-3 font-semibold text-ink">{name(link.studentId)}</td>
                                  <td className="text-secondary">{guardianName(link.guardianId)}</td>
                                  <td>
                                    <Badge tone="slate">{words(link.relationship)}</Badge>
                                  </td>
                                  <td>
                                    {link.isPrimary ? (
                                      <Badge tone="primary">Primary</Badge>
                                    ) : (
                                      <span className="text-muted text-xs">No</span>
                                    )}
                                  </td>
                                  <td>
                                    {link.hasLegalResponsibility ? (
                                      <Badge tone="green">Authorized</Badge>
                                    ) : (
                                      <span className="text-muted text-xs">No</span>
                                    )}
                                  </td>
                                  <td className="text-right">
                                    <Button
                                      variant="secondary"
                                      size="sm"
                                      onClick={() => editLink(link)}
                                    >
                                      Edit
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                          </tbody>
                        </table>
                        {!data.links.length && (
                          <p className="py-6 text-center text-sm text-secondary">
                            Link a student to a guardian to manage contact responsibility.
                          </p>
                        )}
                      </div>
                    </Card>
                  ),
                },
                {
                  value: "verification",
                  label: "SMS & phone verification",
                  content: (
                    <div className="space-y-6">
                      <GuardianSmsPreferences
                        staff
                        profiles={data.guardians
                          .filter(guardian =>
                            data.links.some(link => link.guardianId === guardian.id && link.hasLegalResponsibility)
                          )
                          .map(guardian => ({
                            guardianId: guardian.id,
                            schoolId: data.school.id,
                            label: `${guardian.firstName} ${guardian.lastName}`,
                            announcements:
                              data.smsPreferences.find(p => p.guardianId === guardian.id)?.announcements ?? true,
                          }))}
                      />

                      <Card title="Confirm guardian phone for SMS">
                        <p className="mb-4 text-sm text-secondary">
                          Confirm the telephone number directly with the guardian. The verification is audited and resets if the number changes.
                        </p>
                        <form
                          className="grid gap-4 sm:grid-cols-2"
                          onSubmit={event => {
                            event.preventDefault();
                            const form = new FormData(event.currentTarget);
                            start(async () => {
                              const result = await confirmGuardianPhoneAction({
                                guardianId: str(form, "guardianId"),
                                confirmedPhone: str(form, "confirmedPhone"),
                                evidence: str(form, "evidence"),
                              });
                              setMessage(result.success ? "Guardian number confirmed." : result.error);
                              if (result.success) router.refresh();
                            });
                          }}
                        >
                          <Select label="Guardian" name="guardianId" choices={guardianOptions} />
                          <Field label="Confirmed phone number" name="confirmedPhone" />
                          <div className="sm:col-span-2">
                            <Field label="Confirmation evidence (method and date)" name="evidence" />
                          </div>
                          <div className="sm:col-span-2">
                            <button className={primary} disabled={pending}>
                              Record confirmation
                            </button>
                          </div>
                        </form>

                        <div className="mt-6 border-t border-line-subtle pt-4">
                          <h3 className="text-xs font-bold uppercase tracking-wider text-secondary mb-3">
                            Guardian Phone Status
                          </h3>
                          <ul className="grid gap-2 sm:grid-cols-2 text-sm">
                            {data.guardians.map(guardian => (
                              <li
                                key={guardian.id}
                                className="flex items-center justify-between p-2.5 rounded-control border border-line-subtle bg-surface-subtle"
                              >
                                <span className="font-medium text-ink">
                                  {guardian.firstName} {guardian.lastName}
                                </span>
                                <Badge tone={guardian.phoneVerifiedAt ? "green" : "slate"}>
                                  {guardian.phoneVerifiedAt ? "Confirmed" : "Unconfirmed"}
                                </Badge>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </Card>
                    </div>
                  ),
                },
              ]}
            />
          </div>
        )}

        {/* ---------------- ATTENDANCE ---------------- */}
        {current.id === "attendance" && (
          <div className="space-y-6">
            {data.medicalAlerts?.length > 0 && (
              <Card title="Active medical directives">
                <div className="space-y-2.5">
                  {data.medicalAlerts.map(alert => (
                    <article
                      key={alert.id}
                      className="rounded-control border-l-4 border-warning bg-warning-subtle p-3.5 text-sm text-warning"
                    >
                      <strong>
                        {name(alert.studentId)} · {words(alert.severity)}
                      </strong>
                      <p className="mt-1 text-ink">{alert.directiveSummary}</p>
                      <p className="mt-1 whitespace-pre-wrap text-secondary">{alert.actionRequired}</p>
                    </article>
                  ))}
                </div>
              </Card>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                href="/office/emergency-roll"
                target="_blank"
                className="inline-flex min-h-11 items-center rounded-control border border-line bg-surface px-4 py-2 text-sm font-semibold text-secondary hover:bg-surface-subtle transition-colors shadow-xs"
              >
                📄 Open printable emergency roll sheets
              </Link>
            </div>

            <Card title="Submitted roll calls">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-ink">
                  Class
                  <select
                    className={field}
                    value={selectedAttendanceClass}
                    onChange={event => setAttendanceClass(event.target.value)}
                  >
                    <option value="">Choose a class</option>
                    {classOptions.map(row => (
                      <option key={row.id} value={row.id}>
                        {row.name}
                      </option>
                    ))}
                  </select>
                </label>
                <form
                  onSubmit={event => {
                    event.preventDefault();
                    router.push(`/?section=attendance&date=${encodeURIComponent(str(new FormData(event.currentTarget), "date"))}`);
                  }}
                >
                  <Field label="Date" name="date" type="date" defaultValue={date} />
                  <button className={`${secondary} mt-2 w-full sm:w-auto`} type="submit">
                    Load date
                  </button>
                </form>
              </div>
              <p className="mt-4 text-xs text-secondary">
                Teachers submit morning roll calls. Office staff can correct submitted records with a written explanation for audit safety.
              </p>
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs font-semibold uppercase text-secondary">Status:</span>
                <Badge tone={attendanceSession ? "green" : "slate"}>
                  {attendanceSession ? `Roll call: ${words(attendanceSession.status)}` : "No roll call for this class and date."}
                </Badge>
              </div>
            </Card>

            <Card title={`Unexplained absences for ${date}`}>
              <p className="mb-3 text-sm text-secondary">
                Absent marks from submitted morning roll calls without a guardian note for this date. Contact the guardian to follow up.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-line-subtle text-secondary font-medium text-xs uppercase tracking-wider">
                      <th className="py-2.5">Student</th>
                      <th>Class</th>
                      <th>Guardian</th>
                      <th>Contact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line-subtle">
                    {data.unexplainedAbsences.map(absence => (
                      <tr key={absence.studentId} className="hover:bg-surface-subtle transition-colors">
                        <td className="py-3 font-semibold text-ink">{name(absence.studentId)}</td>
                        <td className="text-secondary">{classLabel(absence.classId)}</td>
                        <td className="text-secondary">
                          {absence.guardianName ?? (absence.contactBlocked ? "Contact withheld" : "No authorised guardian")}
                        </td>
                        <td>
                          {absence.contactBlocked ? (
                            <span className="font-semibold text-warning">Contact restricted: ask the school administrator</span>
                          ) : absence.phone ? (
                            <a className="text-selected hover:underline font-medium" href={`tel:${absence.phone}`}>
                              📞 {absence.phone}
                            </a>
                          ) : absence.email ? (
                            <a className="text-selected hover:underline font-medium" href={`mailto:${absence.email}`}>
                              ✉️ {absence.email}
                            </a>
                          ) : (
                            <span className="text-muted text-xs">No contact details</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.unexplainedAbsences.length && (
                  <p className="py-5 text-center text-sm text-secondary">
                    ✨ No unexplained absences in submitted morning roll calls for this date.
                  </p>
                )}
              </div>
            </Card>

            <Card title="Guardian absence notes">
              <p className="mb-3 text-sm text-secondary">
                Review a note on its own, or review and excuse the matching absent morning mark in one audited step.
              </p>
              <div className="space-y-3">
                {data.absenceNotes.map(note => {
                  const matchingSession =
                    note.absenceDate === date
                      ? data.sessions.find(
                          session =>
                            session.period === "morning_roll_call" &&
                            session.status === "submitted" &&
                            data.records.some(
                              record =>
                                record.sessionId === session.id &&
                                record.studentId === note.studentId &&
                                record.status === "absent"
                            )
                        )
                      : undefined;
                  return (
                    <article
                      key={note.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line-subtle p-3.5 bg-surface-subtle"
                    >
                      <div>
                        <strong className="text-sm text-ink">{name(note.studentId)}</strong>
                        <p className="mt-0.5 text-xs text-secondary">
                          {note.absenceDate} · {note.reasonCategory.replaceAll("_", " ")} · Guardian: {note.guardianName} {note.guardianLastName}
                        </p>
                        <p className="mt-0.5 text-xs text-muted">
                          {words(note.status)}
                          {note.reviewerName ? ` by ${note.reviewerName}` : ""}
                        </p>
                      </div>
                      {note.status === "submitted" && (
                        <div className="flex flex-wrap gap-2">
                          <button
                            className={secondary}
                            disabled={pending}
                            onClick={() =>
                              start(async () => {
                                setMessage("");
                                const result = await markGuardianAbsenceNoteReviewedAction(note.id);
                                setMessage(result.success ? "Absence note marked reviewed." : result.error);
                                if (result.success) router.refresh();
                              })
                            }
                          >
                            Review only
                          </button>
                          {matchingSession ? (
                            <button
                              className={primary}
                              disabled={pending}
                              onClick={() =>
                                start(async () => {
                                setMessage("");
                                const result = await reviewAndExcuseGuardianAbsenceAction(note.id);
                                setMessage(result.success ? "Absence note reviewed and attendance excused." : result.error);
                                if (result.success) router.refresh();
                              })
                            }
                          >
                            Review and excuse
                          </button>
                        ) : note.absenceDate !== date ? (
                          <Link className={secondary} href={`/?section=attendance&date=${encodeURIComponent(note.absenceDate)}`}>
                            Load note date
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </article>
                );
              })}
              {!data.absenceNotes.length && (
                <p className="py-4 text-center text-sm text-secondary">No guardian absence notes have been submitted.</p>
              )}
            </div>
          </Card>

          {attendanceSession && (
            <Card title="Attendance records">
              <div className="space-y-3">
                {attendanceRecords.map(record => (
                  <form
                    key={record.id}
                    className={`grid items-end gap-3 border-b border-line-subtle pb-3 md:grid-cols-[1fr_170px_1fr_1fr_auto] ${
                      record.status === "absent" || record.status === "late"
                        ? "rounded-control bg-warning-subtle/50 p-3"
                        : "p-2"
                    }`}
                    onSubmit={event => {
                      event.preventDefault();
                      const form = new FormData(event.currentTarget);
                      start(async () => {
                        setMessage("");
                        const result = await correctOfficeAttendanceAction({
                          kind: "attendance",
                          classId: attendanceSession.classId,
                          sessionDate: date,
                          studentId: record.studentId,
                          status: str(form, "status") as "present",
                          reason: str(form, "reason"),
                          correctionReason: str(form, "correctionReason"),
                        });
                        setMessage(result.success ? "Attendance correction saved." : result.error);
                        if (result.success) router.refresh();
                      });
                    }}
                  >
                    <div>
                      <strong className="text-sm text-ink">{name(record.studentId)}</strong>
                      <span className="block text-xs text-secondary">Previously {words(record.status)}</span>
                    </div>
                    <Select
                      label="Status"
                      name="status"
                      choices={["present", "absent", "late", "excused"].map(value => ({
                        id: value,
                        name: words(value),
                      }))}
                      defaultValue={record.status}
                    />
                    <Field label="Attendance reason" name="reason" required={false} defaultValue={record.reason} />
                    <Field label="Correction explanation" name="correctionReason" />
                    <button className={primary} disabled={pending || attendanceSession.status !== "submitted"}>
                      Correct
                    </button>
                  </form>
                ))}
                {!attendanceRecords.length && (
                  <p className="py-4 text-center text-sm text-secondary">No student marks recorded in this roll call.</p>
                )}
              </div>
            </Card>
          )}
        </div>
      )}

      {/* ---------------- RECEPTION ---------------- */}
      {current.id === "reception" && (
        <div className="space-y-6">
          <Card title="Front desk reception log">
            <div className="mb-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setReceptionType("late_arrival")}
                className={receptionType === "late_arrival" ? primary : secondary}
              >
                Late arrival check-in
              </button>
              <button
                type="button"
                onClick={() => setReceptionType("early_departure")}
                className={receptionType === "early_departure" ? primary : secondary}
              >
                Early departure sign-out
              </button>
            </div>
            <p className="mb-4 text-xs text-secondary">
              {receptionType === "late_arrival"
                ? "Sign in students arriving after morning roll call. Automatically updates attendance and logs tardiness."
                : "Sign out students leaving campus before the end of the school day. Checks court pickup restrictions."}
            </p>

            {selectedStudentRestrictions.length > 0 && (
              <div className="mb-5 rounded-control border-l-4 border-danger bg-danger-subtle p-4 text-sm text-danger shadow-xs">
                <p className="font-bold flex items-center gap-1.5">
                  <ShieldAlert size={18} /> SAFEGUARDING ALERT: Court Order on File
                </p>
                <p className="mt-1">
                  This student has an active legal restriction. Verify identity of collecting adult before releasing the student:
                </p>
                <ul className="mt-2 list-disc pl-5 text-xs space-y-1">
                  {selectedStudentRestrictions.map(r => (
                    <li key={r.id}>
                      <strong>Restricted person:</strong> {r.restrictedPersonName} · Docket: {r.docketNumber} ·{" "}
                      {r.prohibitPickup ? "Prohibit pickup" : "Restrictions apply"}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <form
              key={receptionType}
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={event => {
                event.preventDefault();
                const target = event.currentTarget;
                const form = new FormData(target);
                start(async () => {
                  setMessage("");
                  const result = await recordReceptionDeskAction({
                    kind: "reception_log",
                    studentId: selectedReceptionStudent || str(form, "studentId"),
                    logType: receptionType,
                    logDate: date,
                    timeString: str(form, "timeString"),
                    minutesLate: Number(form.get("minutesLate") ?? 0),
                    reason: str(form, "reason"),
                    actorPersonName: str(form, "actorPersonName"),
                    collectorGuardianId: str(form, "collectorGuardianId") || null,
                    identityDocumentType: str(form, "identityDocumentType"),
                    identityDocumentLast4: str(form, "identityDocumentLast4"),
                    identityChecked: form.has("identityChecked"),
                    relationship: str(form, "relationship"),
                    isExcused: form.has("isExcused"),
                    remarks: str(form, "remarks"),
                  });
                  setMessage(
                    result.success
                      ? `${receptionType === "late_arrival" ? "Late arrival" : "Early departure"} recorded.`
                      : result.error
                  );
                  if (result.success) {
                    target.reset();
                    setSelectedReceptionStudent("");
                    router.refresh();
                  }
                });
              }}
            >
              <label className="block text-sm font-medium text-ink">
                Student
                <select
                  name="studentId"
                  required
                  value={selectedReceptionStudent}
                  onChange={e => setSelectedReceptionStudent(e.target.value)}
                  className={field}
                >
                  <option value="">Choose student</option>
                  {studentOptions.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>

              <Field
                label={receptionType === "late_arrival" ? "Arrival time" : "Departure time"}
                name="timeString"
                defaultValue="09:15"
              />

              {receptionType === "late_arrival" && (
                <label className="block text-sm font-medium text-ink">
                  Minutes late
                  <input
                    name="minutesLate"
                    type="number"
                    min="1"
                    max="480"
                    defaultValue="15"
                    className={field}
                    required
                  />
                </label>
              )}

              <label className="block text-sm font-medium text-ink">
                Reason
                <select name="reason" required className={field}>
                  <option value="">Choose reason</option>
                  {receptionType === "late_arrival" ? (
                    <>
                      <option value="Medical / Dental appointment">Medical / Dental appointment</option>
                      <option value="Traffic / Transport delay">Traffic / Transport delay</option>
                      <option value="Family emergency">Family emergency</option>
                      <option value="Overslept">Overslept</option>
                      <option value="Other">Other</option>
                    </>
                  ) : (
                    <>
                      <option value="Medical / Dental appointment">Medical / Dental appointment</option>
                      <option value="Illness during school day">Illness during school day</option>
                      <option value="Family emergency">Family emergency</option>
                      <option value="Approved early release">Approved early release</option>
                      <option value="Other">Other</option>
                    </>
                  )}
                </select>
              </label>

              <Field
                label={
                  receptionType === "late_arrival"
                    ? "Brought in by (or 'Unaccompanied')"
                    : "Collected by (adult's full name)"
                }
                name="actorPersonName"
                defaultValue={receptionType === "late_arrival" ? "Unaccompanied" : ""}
              />

              <Field
                label="Relationship to student"
                name="relationship"
                defaultValue={receptionType === "late_arrival" ? "self" : "parent"}
              />

              {receptionType === "early_departure" && (
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2 p-4 rounded-control border border-line-subtle bg-surface-subtle">
                  <label className="text-sm font-medium text-ink sm:col-span-2">
                    Linked legal guardian
                    <select name="collectorGuardianId" className={field} required defaultValue="">
                      <option value="">Choose verified collector</option>
                      {data.links
                        .filter(link => link.studentId === selectedReceptionStudent && link.hasLegalResponsibility)
                        .map(link => {
                          const guardian = data.guardians.find(row => row.id === link.guardianId);
                          return (
                            guardian && (
                              <option key={link.id} value={guardian.id}>
                                {guardian.firstName} {guardian.lastName}
                              </option>
                            )
                          );
                        })}
                    </select>
                  </label>
                  <label className="text-sm font-medium text-ink">
                    Inspected document type
                    <input name="identityDocumentType" className={field} required placeholder="Ghana card, passport" />
                  </label>
                  <label className="text-sm font-medium text-ink">
                    Document final four characters
                    <input
                      name="identityDocumentLast4"
                      className={field}
                      minLength={4}
                      maxLength={4}
                      required
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm font-medium text-ink sm:col-span-2">
                    <input type="checkbox" name="identityChecked" required className="h-4 w-4 accent-primary" />
                    I inspected the original identity document
                  </label>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2 sm:col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    name="isExcused"
                    defaultChecked={receptionType === "late_arrival"}
                    className="h-4 w-4 accent-primary"
                  />
                  {receptionType === "late_arrival" ? "Excused late arrival" : "Authorized early departure"}
                </label>
              </div>

              <label className="block text-sm font-medium text-ink sm:col-span-2">
                Receptionist remarks (optional)
                <input
                  name="remarks"
                  className={field}
                  placeholder="e.g. Doctor slip provided / Verified photo ID at desk"
                />
              </label>

              <button
                className={`${primary} sm:col-span-2`}
                disabled={pending || !data.students.length}
              >
                {receptionType === "late_arrival" ? "Record late arrival" : "Sign out student"}
              </button>
            </form>
          </Card>

          <Card title={`Reception desk register for ${date} (${data.receptionLogs?.length ?? 0})`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-line-subtle text-secondary font-medium text-xs uppercase tracking-wider">
                    <th className="py-2.5">Time</th>
                    <th>Type</th>
                    <th>Student</th>
                    <th>Reason</th>
                    <th>Person / Collector</th>
                    <th>Status</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-subtle">
                  {data.receptionLogs?.map(log => (
                    <tr key={log.id} className="hover:bg-surface-subtle transition-colors">
                      <td className="py-3 font-mono font-bold text-ink">{log.timeString}</td>
                      <td>
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-control ${
                            log.logType === "late_arrival"
                              ? "bg-warning-subtle text-warning"
                              : "bg-primary-subtle text-selected"
                          }`}
                        >
                          {log.logType === "late_arrival" ? `Late (${log.minutesLate}m)` : "Early departure"}
                        </span>
                      </td>
                      <td className="font-semibold text-ink">{name(log.studentId)}</td>
                      <td className="text-secondary">{log.reason}</td>
                      <td className="text-secondary">
                        {log.actorPersonName || "—"}
                        {log.relationship ? ` (${words(log.relationship)})` : ""}
                      </td>
                      <td>
                        <span
                          className={`inline-block px-2.5 py-0.5 text-xs font-semibold rounded-control ${
                            log.isExcused
                              ? "bg-success-subtle text-success"
                              : "bg-surface-subtle text-secondary"
                          }`}
                        >
                          {log.isExcused ? "Excused / Authorized" : "Unexcused"}
                        </span>
                      </td>
                      <td className="text-xs text-secondary">{log.remarks || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {(!data.receptionLogs || data.receptionLogs.length === 0) && (
                <p className="py-6 text-center text-sm text-secondary">
                  No late arrivals or early departures recorded for this date.
                </p>
              )}
            </div>
          </Card>
        </div>
      )}

      {/* ---------------- BROADCAST SMS ---------------- */}
      {current.id === "broadcast" && (
        <ParentSmsAnnouncements
          grades={data.grades}
          classes={yearClasses}
          dispatches={data.dispatches}
          onPreview={previewParentSmsAction}
          onQueue={async input => {
            const result = await queueParentSmsAction(input);
            if (result.success) router.refresh();
            return result;
          }}
        />
      )}

      {/* ---------------- CSV IMPORTS ---------------- */}
      {current.id === "imports" && <StudentCsvImport role="office_staff" />}

      {/* ---------------- NOTICES ---------------- */}
      {current.id === "notices" && (
        <Card title="Published school notices">
          <div className="divide-y divide-line-subtle">
            {notices.map(notice => (
              <article key={notice.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex justify-between items-start gap-3">
                  <h3 className="font-semibold text-ink text-base">{notice.title}</h3>
                  <Badge tone={notice.priority === "emergency" ? "danger" : "slate"}>
                    {words(notice.priority)}
                  </Badge>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-secondary">{notice.content}</p>
              </article>
            ))}
            {!notices.length && (
              <p className="py-6 text-center text-sm text-secondary">No published notices available.</p>
            )}
          </div>
        </Card>
      )}
    </WorkspaceShell>

    {/* ---------------- MODAL OVERLAYS (NO PAGE JUMPING) ---------------- */}
    {editor?.kind === "student" && (
      <Overlay
        open={true}
        onClose={() => setEditor(null)}
        title={editor.values?.id ? "Edit student" : "Enroll student"}
        description="Klassa automatically assigns student numbers upon saving."
      >
        <form
          key={String(editor.values?.id ?? "new")}
          className="space-y-4"
          onSubmit={event =>
            submit(event, form => ({
              kind: "student",
              ...(editor.values?.id ? { id: String(editor.values.id) } : {}),
              firstName: str(form, "firstName"),
              lastName: str(form, "lastName"),
              dateOfBirth: str(form, "dateOfBirth"),
              status: str(form, "status") as "pending",
              classId: str(form, "classId"),
            }))
          }
        >
          <Field label="First name" name="firstName" defaultValue={String(editor.values?.firstName ?? "")} />
          <Field label="Last name" name="lastName" defaultValue={String(editor.values?.lastName ?? "")} />
          <Field
            label="Date of birth"
            name="dateOfBirth"
            type="date"
            defaultValue={String(editor.values?.dateOfBirth ?? "")}
          />
          <Select
            label="Class in current year"
            name="classId"
            choices={classOptions}
            defaultValue={String(editor.values?.classId ?? "")}
          />
          <Select
            label="Status"
            name="status"
            choices={["pending", "active", "withdrawn", "graduated"].map(value => ({
              id: value,
              name: words(value),
            }))}
            defaultValue={String(editor.values?.status ?? "pending")}
          />
          {(!year || !classOptions.length) && (
            <p className="rounded-control border border-warning/20 bg-warning-subtle p-3 text-xs text-warning">
              Ask the school administrator to create the current year and classes first.
            </p>
          )}
          <div className="flex justify-end gap-2 pt-4 border-t border-line-subtle">
            <Button variant="secondary" type="button" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !year || !classOptions.length}>
              {pending ? "Saving..." : "Save student"}
            </Button>
          </div>
        </form>
      </Overlay>
    )}

    {editor?.kind === "guardian" && (
      <Overlay
        open={true}
        onClose={() => setEditor(null)}
        title={editor.values?.id ? "Edit guardian" : "Add guardian"}
        description="Guardian contacts can be linked to students for emergency notifications."
      >
        <form
          key={String(editor.values?.id ?? "new")}
          className="space-y-4"
          onSubmit={event =>
            submit(event, form => ({
              kind: "guardian",
              ...(editor.values?.id ? { id: String(editor.values.id) } : {}),
              firstName: str(form, "firstName"),
              lastName: str(form, "lastName"),
              email: str(form, "email"),
              phone: str(form, "phone"),
            }))
          }
        >
          <Field label="First name" name="firstName" defaultValue={String(editor.values?.firstName ?? "")} />
          <Field label="Last name" name="lastName" defaultValue={String(editor.values?.lastName ?? "")} />
          <Field
            label="Email"
            name="email"
            type="email"
            required={false}
            defaultValue={String(editor.values?.email ?? "")}
          />
          <Field
            label="Phone"
            name="phone"
            required={false}
            defaultValue={String(editor.values?.phone ?? "")}
          />
          <div className="flex justify-end gap-2 pt-4 border-t border-line-subtle">
            <Button variant="secondary" type="button" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Saving..." : "Save guardian"}
            </Button>
          </div>
        </form>
      </Overlay>
    )}

    {editor?.kind === "guardian_link" && (
      <Overlay
        open={true}
        onClose={() => setEditor(null)}
        title="Guardian relationship"
        description="Establish pupil-guardian linkage and specify emergency custody permissions."
      >
        <form
          key={`${editor.values?.studentId ?? "new"}-${editor.values?.guardianId ?? "new"}`}
          className="space-y-4"
          onSubmit={event =>
            submit(event, form => ({
              kind: "guardian_link",
              studentId: str(form, "studentId"),
              guardianId: str(form, "guardianId"),
              relationship: str(form, "relationship") as "parent",
              isPrimary: form.has("isPrimary"),
              hasLegalResponsibility: form.has("legal"),
            }))
          }
        >
          <Select
            label="Student"
            name="studentId"
            choices={studentOptions}
            defaultValue={String(editor.values?.studentId ?? "")}
          />
          <Select
            label="Guardian"
            name="guardianId"
            choices={guardianOptions}
            defaultValue={String(editor.values?.guardianId ?? "")}
          />
          <Select
            label="Relationship"
            name="relationship"
            choices={["parent", "guardian", "foster_carer", "other"].map(value => ({
              id: value,
              name: words(value),
            }))}
            defaultValue={String(editor.values?.relationship ?? "parent")}
          />
          <div className="flex flex-wrap items-center gap-6 pt-1">
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                name="isPrimary"
                defaultChecked={Boolean(editor.values?.isPrimary)}
                className="h-4 w-4 accent-primary"
              />
              Primary contact
            </label>
            <label className="flex items-center gap-2 text-sm font-medium text-ink">
              <input
                type="checkbox"
                name="legal"
                defaultChecked={Boolean(editor.values?.hasLegalResponsibility)}
                className="h-4 w-4 accent-primary"
              />
              Legal responsibility
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-line-subtle">
            <Button variant="secondary" type="button" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={pending || !studentOptions.length || !guardianOptions.length}
            >
              {pending ? "Saving..." : "Save relationship"}
            </Button>
          </div>
        </form>
      </Overlay>
    )}

    {showEnrollment && (
      <StudentEnrollmentFlow
        classes={classOptions.map(item => ({ id: item.id, label: item.name }))}
        existingGuardians={data.guardians.map(item => ({
          id: item.id,
          label: `${item.firstName} ${item.lastName}${item.email ? ` · ${item.email}` : ""}`,
        }))}
        onClose={() => setShowEnrollment(false)}
        onSaved={message => {
          setMessage(message);
          setShowEnrollment(false);
        }}
      />
    )}
  </>
);
}
