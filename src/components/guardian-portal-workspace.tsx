import { GuardianSmsPreferences } from "@/components/guardian-sms-preferences";
import { GuardianWorkspaceShell } from "@/components/guardian-workspace-shell";
import Link from "next/link";
import { GuardianAbsenceNoteForm } from "@/components/guardian-absence-note-form";
import { StudentDailyTimetable } from "@/components/student-daily-timetable";
import type { GuardianPortalData } from "@/lib/guardian-portal-data";
import { formatGMTDate } from "@/lib/timezone";
import { Badge } from "@/components/ui/badge";

export function GuardianPortalWorkspace({ data }: { data: GuardianPortalData }) {
  const schoolCount = new Set(data.students.map(student => student.schoolId)).size;
  return (
    <GuardianWorkspaceShell
      guardianName={data.guardianName}
      schoolName={schoolCount === 1 ? data.students[0]?.schoolName ?? "Family portal" : schoolCount > 1 ? "Your schools" : "Family portal"}
      academicYear={schoolCount === 1 ? data.students[0]?.currentYearName ?? undefined : undefined}
      hasStudents={data.students.length > 0}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <section id="guardian-students" className="scroll-mt-28">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Family overview</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink">Your students</h1>
          <p className="mt-1.5 text-sm text-secondary">Attendance, published results, and school notices for students linked to your guardian account.</p>
        </section>

        {data.students.length === 0 ? (
          <section className="rounded-card border border-warning/20 bg-warning-subtle p-6">
            <h2 className="font-semibold text-ink">No student access is linked to this account</h2>
            <p className="mt-2 text-sm text-secondary">Ask the school office to confirm your guardian record and legal-responsibility link.</p>
          </section>
        ) : (
          <>
            <div className="grid gap-6 sm:grid-cols-2">
              {data.students.map(student => (
                <article key={student.id} className="rounded-card border border-line-subtle bg-surface p-6 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-secondary">{student.schoolName}</p>
                      <h2 className="mt-1 text-lg font-bold text-ink">{student.firstName} {student.lastName}</h2>
                    </div>
                    <Badge tone="primary">{student.studentNumber}</Badge>
                  </div>
                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Class</dt>
                      <dd className="mt-1 font-medium text-ink">{student.className}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Academic year</dt>
                      <dd className="mt-1 font-medium text-ink">{student.currentYearName ?? "Not set"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Recent attendance</dt>
                      <dd className="mt-1 font-medium text-ink">
                        {student.attendanceRate == null ? "No records" : `${student.attendanceRate}%`}
                        <span className="block text-xs font-normal text-muted mt-0.5">Submitted records (last 120 days)</span>
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-semibold uppercase tracking-wider text-secondary">Published reports</dt>
                      <dd className="mt-1 font-medium text-ink">{student.reports.length}</dd>
                    </div>
                  </dl>

                  {student.reports.length > 0 && (
                    <nav aria-label={`Printable report cards for ${student.firstName} ${student.lastName}`} className="mt-5 border-t border-line-subtle pt-4">
                      <h3 className="text-sm font-semibold text-ink">Printable report cards</h3>
                      <ul className="mt-2 space-y-2">
                        {student.reports.map(report => (
                          <li key={report.id}>
                            <Link href={`/reports/${report.id}`} className="inline-flex min-h-11 items-center text-sm font-semibold text-primary underline hover:text-primary-hover">
                              Open printable report card · {report.termName}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </nav>
                  )}

                  <details className="mt-5 border-t border-line-subtle pt-4 group">
                    <summary className="cursor-pointer text-sm font-semibold text-primary hover:text-primary-hover select-none">
                      View attendance and results
                    </summary>
                    <div className="mt-4 space-y-5">
                      <section>
                        <h3 className="text-sm font-semibold text-ink">Recent attendance</h3>
                        <ul className="mt-2 divide-y divide-line-subtle text-sm">
                          {student.attendance.map((record, index) => (
                            <li key={`${record.date}-${index}`} className="flex justify-between gap-3 py-2 text-secondary">
                              <span>{new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${record.date}T00:00:00Z`))}</span>
                              <span className="font-medium capitalize text-ink">
                                {record.status}
                                {record.status === "late" && record.arrivalMinutesLate > 0 ? ` · ${record.arrivalMinutesLate} min` : ""}
                              </span>
                            </li>
                          ))}
                          {student.attendance.length === 0 && <li className="py-2 text-muted">No submitted attendance yet.</li>}
                        </ul>
                      </section>
                      <section>
                        <h3 className="text-sm font-semibold text-ink">Published report cards</h3>
                        <div className="mt-2 space-y-3">
                          {student.reports.map(report => (
                            <article key={report.id} className="rounded-control border border-line-subtle bg-surface-subtle p-3.5 shadow-subtle">
                              <div className="flex flex-wrap justify-between gap-2">
                                <strong className="text-sm text-ink">{report.termName}</strong>
                                <span className="text-sm font-semibold text-secondary">
                                  {report.overallPercentage == null ? "" : `${report.overallPercentage}%`}
                                </span>
                              </div>
                              <ul className="mt-2 space-y-2">
                                {report.subjects.map((subject, index) => (
                                  <li key={`${subject.subjectName}-${index}`} className="text-sm">
                                    <div className="flex justify-between gap-2">
                                      <span className="text-secondary">{subject.subjectName}</span>
                                      <span className="font-medium text-ink">{subject.letterGrade} · {subject.scorePercentage}%</span>
                                    </div>
                                    {subject.comments && <p className="mt-1 text-xs text-muted">{subject.comments}</p>}
                                  </li>
                                ))}
                              </ul>
                            </article>
                          ))}
                          {student.reports.length === 0 && <p className="text-sm text-muted">No published report cards yet.</p>}
                        </div>
                      </section>
                    </div>
                  </details>

                  <details className="mt-4 border-t border-line-subtle pt-4 group">
                    <summary className="cursor-pointer text-sm font-semibold text-primary hover:text-primary-hover select-none">
                      View daily period timetable
                    </summary>
                    <div className="mt-4">
                      <StudentDailyTimetable timetable={student.timetable ?? []} studentName={`${student.firstName} ${student.lastName}`} className={student.className} />
                    </div>
                  </details>

                  <section className="mt-4 border-t border-line-subtle pt-4">
                    <h3 className="text-sm font-semibold text-ink">Absence notes</h3>
                    <ul className="mt-2 space-y-2 text-xs">
                      {student.absenceNotes.slice(0, 5).map(note => (
                        <li key={note.id} className="flex justify-between gap-2 text-secondary">
                          <span>{new Intl.DateTimeFormat("en-GH", { dateStyle: "medium", timeZone: "UTC" }).format(new Date(`${note.absenceDate}T00:00:00Z`))} · {note.reasonCategory.replaceAll("_", " ")}</span>
                          <span className="font-medium capitalize text-ink">{note.status}</span>
                        </li>
                      ))}
                      {student.absenceNotes.length === 0 && <li className="text-muted">No absence notes submitted.</li>}
                    </ul>
                  </section>
                </article>
              ))}
            </div>

            <GuardianAbsenceNoteForm students={data.students} />

            <section id="guardian-notices" className="scroll-mt-28 rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
              <div className="border-b border-line-subtle p-6">
                <h2 className="font-bold text-ink">School notices</h2>
                <p className="mt-1 text-sm text-secondary">Published notices for your students{schoolCount > 1 ? " across their schools" : ""}.</p>
              </div>
              <div className="divide-y divide-line-subtle">
                {data.announcements.map(notice => (
                  <article key={notice.id} className="p-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="font-semibold text-ink">{notice.title}</h3>
                      <span className="text-xs text-muted">{notice.schoolName} · {notice.publishedAt ? formatGMTDate(notice.publishedAt) : ""}</span>
                    </div>
                    <p className="mt-2.5 whitespace-pre-wrap text-sm text-secondary leading-relaxed">{notice.content}</p>
                  </article>
                ))}
                {data.announcements.length === 0 && <p className="p-8 text-center text-sm text-muted">No published notices yet.</p>}
              </div>
            </section>
          </>
        )}

        <section id="guardian-preferences" aria-label="SMS preferences" className="scroll-mt-28">
          <GuardianSmsPreferences profiles={data.smsPreferences.map(profile => ({ ...profile, label: profile.schoolName }))} />
        </section>
        <p className="text-center text-xs text-muted">This portal shows published school information only. Contact your school for corrections or access support.</p>
      </div>
    </GuardianWorkspaceShell>
  );
}
