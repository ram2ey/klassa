"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BookOpen,
  CalendarCheck,
  ExternalLink,
  GraduationCap,
  Mail,
  Phone,
  ShieldAlert,
  Sparkles,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";

export type StudentDrawerProfile = {
  id: string;
  studentNumber: string;
  firstName: string;
  lastName: string;
  preferredName?: string | null;
  dateOfBirth?: string | null;
  status: string;
  externalReference?: string | null;
};

export type StudentDrawerReport = {
  id: string;
  studentId: string;
  termId: string;
  version?: number;
  overallPercentage?: string | number | null;
  gpa?: string | number | null;
  attendanceRate?: string | number | null;
  teacherRemarks?: string | null;
  publishedAt?: string | Date | null;
  createdAt?: string | Date | null;
};

export type StudentDrawerSubjectGrade = {
  id: string;
  reportCardId: string;
  subjectId: string;
  scorePercentage: string | number;
  letterGrade: string;
  comments?: string | null;
};

export type StudentDrawerBehaviour = {
  id: string;
  studentId?: string;
  type: "praise" | "incident";
  category: string;
  points: number;
  description?: string | null;
  guardianVisible?: boolean;
  occurredAt: string;
};

export type StudentDrawerAttendance = {
  total: number;
  attended: number;
  absent: number;
  late?: number;
  excused?: number;
};

export type StudentDrawerGuardian = {
  id?: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  email?: string | null;
  relationship: string;
  isPrimary: boolean;
  hasLegalResponsibility?: boolean;
};

export type StudentDrawerSafetyNotice = {
  id?: string;
  type: "directive" | "pickup";
  title: string;
  detail: string;
  severity?: string;
};

export type StudentAcademicDrawerProps = {
  student: StudentDrawerProfile;
  classPlacement?: string;
  academicYears?: Array<{ id: string; name: string }>;
  terms?: Array<{ id: string; name: string; academicYearId?: string; position?: number }>;
  subjects?: Array<{ id: string; name: string; code?: string | null }>;
  classes?: Array<{ id: string; name: string; gradeLevelId?: string; academicYearId?: string }>;
  gradeLevels?: Array<{ id: string; name: string }>;
  enrollments?: Array<{ id: string; studentId: string; classId: string | null; academicYearId: string; status: string }>;
  reports?: StudentDrawerReport[];
  reportSubjects?: StudentDrawerSubjectGrade[];
  attendance?: StudentDrawerAttendance;
  historyMarks?: Array<{ studentId?: string; status: string; sessionDate?: string }>;
  behaviours?: StudentDrawerBehaviour[];
  guardians?: StudentDrawerGuardian[];
  safetyNotices?: StudentDrawerSafetyNotice[];
  onClose: () => void;
  onEditStudent?: () => void;
};

type DrawerTab = "transcript" | "subjects" | "attendance" | "conduct" | "guardians";

export function StudentAcademicDrawer({
  student,
  classPlacement,
  academicYears = [],
  terms = [],
  subjects = [],
  classes = [],
  gradeLevels = [],
  enrollments = [],
  reports = [],
  reportSubjects = [],
  attendance,
  historyMarks = [],
  behaviours = [],
  guardians = [],
  safetyNotices = [],
  onClose,
  onEditStudent,
}: StudentAcademicDrawerProps) {
  const [activeTab, setActiveTab] = useState<DrawerTab>("transcript");

  // Close on Escape key press
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Student report cards sorted chronologically
  const studentReports = useMemo(() => {
    return [...reports]
      .filter((r) => r.studentId === student.id)
      .sort((a, b) => {
        const timeA = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const timeB = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return timeA - timeB;
      });
  }, [reports, student.id]);

  const latestReport = studentReports[studentReports.length - 1];

  // Multi-term academic progression trends
  const termTrends = useMemo(() => {
    return studentReports.map((report, index) => {
      const term = terms.find((t) => t.id === report.termId);
      const score = report.overallPercentage != null ? Number(report.overallPercentage) : null;
      const gpa = report.gpa != null ? Number(report.gpa) : null;
      const prevReport = index > 0 ? studentReports[index - 1] : null;
      const prevScore = prevReport?.overallPercentage != null ? Number(prevReport.overallPercentage) : null;
      const delta = score != null && prevScore != null ? score - prevScore : null;

      return {
        reportId: report.id,
        termName: term?.name ?? `Term ${index + 1}`,
        score,
        gpa,
        delta,
        attendanceRate: report.attendanceRate != null ? Number(report.attendanceRate) : null,
      };
    });
  }, [studentReports, terms]);

  // Subject breakdown across reports
  const studentSubjectGrades = useMemo(() => {
    const reportIds = new Set(studentReports.map((r) => r.id));
    return reportSubjects.filter((rs) => reportIds.has(rs.reportCardId));
  }, [reportSubjects, studentReports]);

  // Attendance stats
  const attendanceRate = useMemo(() => {
    if (attendance && attendance.total > 0) {
      return Math.round((Number(attendance.attended) / Number(attendance.total)) * 100);
    }
    if (historyMarks.length > 0) {
      const presentCount = historyMarks.filter((m) => m.status === "present" || m.status === "late").length;
      return Math.round((presentCount / historyMarks.length) * 100);
    }
    if (latestReport?.attendanceRate != null) {
      return Math.round(Number(latestReport.attendanceRate));
    }
    return null;
  }, [attendance, historyMarks, latestReport]);

  // Conduct points
  const praiseMerits = useMemo(() => {
    return behaviours.filter((b) => b.type === "praise").reduce((acc, b) => acc + b.points, 0);
  }, [behaviours]);

  const incidentSanctions = useMemo(() => {
    return behaviours.filter((b) => b.type === "incident").reduce((acc, b) => acc + b.points, 0);
  }, [behaviours]);

  const netConduct = praiseMerits - incidentSanctions;

  // Student enrollments
  const studentEnrollments = useMemo(() => {
    return enrollments.filter((e) => e.studentId === student.id);
  }, [enrollments, student.id]);

  function getGradeColorClass(score: number | null) {
    if (score == null) return "bg-slate-300";
    if (score >= 85) return "bg-emerald-600";
    if (score >= 70) return "bg-blue-600";
    if (score >= 55) return "bg-amber-500";
    return "bg-rose-500";
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-slate-950/40 backdrop-blur-xs transition-opacity"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-profile-title"
        className="flex h-full w-full max-w-2xl flex-col bg-white text-slate-900 shadow-2xl"
      >
        {/* Drawer Header */}
        <div className="border-b border-slate-200 bg-slate-50/80 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Academic Profile
                </span>
                <span className="font-mono text-xs text-slate-500">• {student.studentNumber}</span>
                <span
                  className={`border px-2 py-0.5 text-[11px] font-semibold ${
                    student.status === "active"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  }`}
                >
                  {student.status.toUpperCase()}
                </span>
              </div>
              <h2 id="student-profile-title" className="mt-1.5 text-2xl font-bold text-slate-950">
                {student.firstName} {student.lastName}
                {student.preferredName && (
                  <span className="ml-2 text-base font-normal text-slate-500">
                    ({student.preferredName})
                  </span>
                )}
              </h2>
              <p className="mt-1 text-xs text-slate-600">
                {classPlacement ?? "Class placement not recorded"}
                {student.dateOfBirth && ` • DOB: ${student.dateOfBirth}`}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close academic profile"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-sm border border-slate-300 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-blue-600"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {/* GPA */}
            <div className="border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Latest GPA
              </span>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {latestReport?.gpa != null ? Number(latestReport.gpa).toFixed(2) : "—"}
              </p>
              <span className="text-[10px] text-slate-500">
                {latestReport ? "Official transcript" : "No reports yet"}
              </span>
            </div>

            {/* Overall Score */}
            <div className="border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Academic Score
              </span>
              <p className="mt-1 text-2xl font-bold text-blue-700">
                {latestReport?.overallPercentage != null
                  ? `${Math.round(Number(latestReport.overallPercentage))}%`
                  : "—"}
              </p>
              <span className="text-[10px] text-slate-500">
                {latestReport ? "Latest term result" : "Pending grades"}
              </span>
            </div>

            {/* Attendance */}
            <div className="border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Attendance
              </span>
              <p className="mt-1 text-2xl font-bold text-slate-900">
                {attendanceRate != null ? `${attendanceRate}%` : "—"}
              </p>
              <span className="text-[10px] text-slate-500">
                {attendance ? `${attendance.attended}/${attendance.total} sessions` : "Morning roll call"}
              </span>
            </div>

            {/* Conduct Balance */}
            <div className="border border-slate-200 bg-white p-3 shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                Conduct
              </span>
              <p
                className={`mt-1 text-2xl font-bold ${
                  netConduct > 0
                    ? "text-emerald-700"
                    : netConduct < 0
                    ? "text-rose-700"
                    : "text-slate-700"
                }`}
              >
                {netConduct > 0 ? `+${netConduct}` : netConduct}
              </p>
              <span className="text-[10px] text-slate-500">
                +{praiseMerits} / -{incidentSanctions} pts
              </span>
            </div>
          </div>

          {/* Safety Warning Banner if notices present */}
          {safetyNotices.length > 0 && (
            <div className="mt-3 flex items-start gap-2.5 border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <div>
                <strong className="font-semibold">Student Safety & Care Notices Active</strong>
                <p className="mt-0.5 text-amber-900">
                  {safetyNotices.map((n) => `${n.title}: ${n.detail}`).join(" • ")}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 bg-white px-5">
          <nav className="flex space-x-4 overflow-x-auto text-sm" aria-label="Student profile sections">
            {[
              { id: "transcript", label: "Transcript & Trends", icon: TrendingUp },
              { id: "subjects", label: "Subject Grades", icon: BookOpen },
              { id: "attendance", label: "Attendance", icon: CalendarCheck },
              { id: "conduct", label: "Behaviour & Merits", icon: Award },
              { id: "guardians", label: "Guardians & Contacts", icon: GraduationCap },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as DrawerTab)}
                  className={`flex min-h-12 items-center gap-2 border-b-2 px-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                    isActive
                      ? "border-blue-700 text-blue-700"
                      : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  }`}
                >
                  <Icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Drawer Scrollable Body */}
        <div className="flex-1 space-y-6 overflow-y-auto p-6">
          {/* TAB 1: TRANSCRIPT & TRENDS */}
          {activeTab === "transcript" && (
            <div className="space-y-6">
              {/* Visual Multi-Term Grade Trend Graph */}
              <section className="border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Multi-Term Grade Progression</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Visual overall performance and GPA trajectories across terms.
                    </p>
                  </div>
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>

                {termTrends.length > 0 ? (
                  <div className="mt-5 space-y-4">
                    {termTrends.map((trend) => (
                      <div key={trend.reportId} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-800">{trend.termName}</span>
                          <div className="flex items-center gap-3">
                            {trend.delta != null && (
                              <span
                                className={`flex items-center gap-0.5 font-bold ${
                                  trend.delta > 0
                                    ? "text-emerald-700"
                                    : trend.delta < 0
                                    ? "text-rose-700"
                                    : "text-slate-500"
                                }`}
                              >
                                {trend.delta > 0 ? (
                                  <TrendingUp size={12} />
                                ) : trend.delta < 0 ? (
                                  <TrendingDown size={12} />
                                ) : null}
                                {trend.delta > 0 ? `+${trend.delta.toFixed(1)}%` : `${trend.delta.toFixed(1)}%`}
                              </span>
                            )}
                            {trend.gpa != null && (
                              <span className="font-mono text-slate-500">GPA {trend.gpa.toFixed(2)}</span>
                            )}
                            <span className="font-bold text-slate-950">
                              {trend.score != null ? `${trend.score}%` : "—"}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="h-3 w-full overflow-hidden bg-slate-100">
                          <div
                            className={`h-full transition-all duration-500 ${getGradeColorClass(trend.score)}`}
                            style={{ width: `${Math.min(100, Math.max(0, trend.score ?? 0))}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="py-6 text-center text-xs text-slate-500">
                    No multi-term report cards published for this student yet. Progress graphs will appear once term report cards are issued.
                  </p>
                )}
              </section>

              {/* Published Official Report Cards */}
              <section className="border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Official Published Report Cards</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Approved formal report cards available for download or guardian viewing.
                    </p>
                  </div>
                  <GraduationCap className="h-5 w-5 text-slate-500" />
                </div>

                <div className="mt-4 space-y-3">
                  {studentReports.map((card) => {
                    const termName = terms.find((t) => t.id === card.termId)?.name ?? "Academic Term";
                    return (
                      <article
                        key={card.id}
                        className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 p-4 transition-colors hover:border-blue-400"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-slate-900">{termName}</h4>
                            <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                              v{card.version ?? 1}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-slate-600">
                            Overall:{" "}
                            <strong className="text-slate-900">
                              {card.overallPercentage != null ? `${card.overallPercentage}%` : "—"}
                            </strong>
                            {card.gpa != null && ` • GPA: ${card.gpa}`}
                            {card.attendanceRate != null && ` • Attendance: ${card.attendanceRate}%`}
                          </p>
                          {card.teacherRemarks && (
                            <p className="mt-1.5 text-xs italic text-slate-600 line-clamp-2">
                              &ldquo;{card.teacherRemarks}&rdquo;
                            </p>
                          )}
                        </div>

                        <Link
                          href={`/reports/${card.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex min-h-10 items-center gap-1.5 border border-blue-600 bg-blue-50 px-3 text-xs font-semibold text-blue-800 transition-colors hover:bg-blue-100"
                        >
                          <span>Open printable card</span>
                          <ExternalLink size={13} />
                        </Link>
                      </article>
                    );
                  })}

                  {!studentReports.length && (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No published report cards on file.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB 2: SUBJECT BREAKDOWN */}
          {activeTab === "subjects" && (
            <section className="space-y-4 border border-slate-200 bg-white p-5 shadow-xs">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h3 className="font-bold text-slate-900">Subject-by-Subject Academic Results</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Detailed assessment and term marks by curriculum subject.
                  </p>
                </div>
                <BookOpen className="h-5 w-5 text-blue-600" />
              </div>

              {studentSubjectGrades.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 text-[11px] font-semibold text-slate-500">
                        <th className="py-2.5">Subject</th>
                        <th className="py-2.5">Score</th>
                        <th className="py-2.5">Letter Grade</th>
                        <th className="py-2.5">Teacher Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {studentSubjectGrades.map((grade) => {
                        const subject = subjects.find((s) => s.id === grade.subjectId);
                        const scoreNum = Number(grade.scorePercentage);
                        return (
                          <tr key={grade.id} className="hover:bg-slate-50/70">
                            <td className="py-3 font-semibold text-slate-900">
                              {subject?.name ?? "Curriculum Subject"}
                              {subject?.code && (
                                <span className="ml-1 text-[10px] font-normal text-slate-500">
                                  ({subject.code})
                                </span>
                              )}
                            </td>
                            <td className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-2 w-16 overflow-hidden bg-slate-100">
                                  <div
                                    className={`h-full ${getGradeColorClass(scoreNum)}`}
                                    style={{ width: `${Math.min(100, Math.max(0, scoreNum))}%` }}
                                  />
                                </div>
                                <span className="font-bold">{grade.scorePercentage}%</span>
                              </div>
                            </td>
                            <td className="py-3">
                              <span className="inline-block rounded-xs bg-slate-100 px-2 py-0.5 font-bold text-slate-800">
                                {grade.letterGrade}
                              </span>
                            </td>
                            <td className="py-3 text-slate-600">
                              {grade.comments || "No comments recorded."}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="py-6 text-center text-xs text-slate-500">
                  No individual subject grade marks recorded on published cards for this student yet.
                </p>
              )}
            </section>
          )}

          {/* TAB 3: ATTENDANCE */}
          {activeTab === "attendance" && (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Attendance Statistics</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Roll call attendance mark summary across submitted sessions.
                    </p>
                  </div>
                  <CalendarCheck className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="border border-slate-200 bg-slate-50 p-3 text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase">Rate</span>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {attendanceRate != null ? `${attendanceRate}%` : "—"}
                    </p>
                  </div>
                  <div className="border border-emerald-200 bg-emerald-50/60 p-3 text-center">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Present</span>
                    <p className="mt-1 text-2xl font-bold text-emerald-950">
                      {attendance?.attended ?? historyMarks.filter((m) => m.status === "present").length}
                    </p>
                  </div>
                  <div className="border border-rose-200 bg-rose-50/60 p-3 text-center">
                    <span className="text-[10px] font-bold text-rose-800 uppercase">Absent</span>
                    <p className="mt-1 text-2xl font-bold text-rose-950">
                      {attendance?.absent ?? historyMarks.filter((m) => m.status === "absent").length}
                    </p>
                  </div>
                  <div className="border border-amber-200 bg-amber-50/60 p-3 text-center">
                    <span className="text-[10px] font-bold text-amber-800 uppercase">Late / Excused</span>
                    <p className="mt-1 text-2xl font-bold text-amber-950">
                      {attendance?.late ?? historyMarks.filter((m) => m.status === "late" || m.status === "excused").length}
                    </p>
                  </div>
                </div>

                {/* Recent Attendance Session Marks */}
                {historyMarks.length > 0 && (
                  <div className="mt-5 border-t border-slate-100 pt-4">
                    <h4 className="text-xs font-bold text-slate-700">Recent Marks History</h4>
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {historyMarks.slice(0, 30).map((mark, i) => {
                        const status = mark.status;
                        const color =
                          status === "present"
                            ? "bg-emerald-100 text-emerald-800"
                            : status === "absent"
                            ? "bg-rose-100 text-rose-800 font-bold"
                            : status === "late"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-blue-100 text-blue-800";
                        return (
                          <span
                            key={i}
                            title={`${mark.sessionDate ?? "Session"}: ${status}`}
                            className={`px-2 py-0.5 text-[11px] rounded-xs font-medium uppercase ${color}`}
                          >
                            {status[0]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>
          )}

          {/* TAB 4: CONDUCT & BEHAVIOUR */}
          {activeTab === "conduct" && (
            <div className="space-y-6">
              <section className="border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Conduct & Praise Points Tally</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Positive praise merits and disciplinary incident sanctions.
                    </p>
                  </div>
                  <Sparkles className="h-5 w-5 text-emerald-600" />
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3">
                  <div className="border border-emerald-200 bg-emerald-50/60 p-3">
                    <span className="text-[10px] font-bold text-emerald-800 uppercase">Praise Merits</span>
                    <p className="mt-1 text-2xl font-bold text-emerald-950">+{praiseMerits}</p>
                  </div>
                  <div className="border border-rose-200 bg-rose-50/60 p-3">
                    <span className="text-[10px] font-bold text-rose-800 uppercase">Sanctions</span>
                    <p className="mt-1 text-2xl font-bold text-rose-950">-{incidentSanctions}</p>
                  </div>
                  <div className="border border-slate-200 bg-slate-50 p-3">
                    <span className="text-[10px] font-bold text-slate-600 uppercase">Net Balance</span>
                    <p className="mt-1 text-2xl font-bold text-slate-900">
                      {netConduct > 0 ? `+${netConduct}` : netConduct}
                    </p>
                  </div>
                </div>

                {/* Conduct Event Log Feed */}
                <div className="mt-5 space-y-2.5">
                  <h4 className="text-xs font-bold text-slate-700">Recent Conduct Events</h4>
                  {behaviours.map((beh) => (
                    <div
                      key={beh.id}
                      className="flex items-start justify-between gap-3 border border-slate-100 bg-slate-50/40 p-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`rounded-xs px-1.5 py-0.5 font-bold ${
                              beh.type === "praise"
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-rose-100 text-rose-800"
                            }`}
                          >
                            {beh.type === "praise" ? `+${beh.points} Merits` : `-${beh.points} Sanction`}
                          </span>
                          <strong className="text-slate-800 capitalize">
                            {beh.category.replaceAll("_", " ")}
                          </strong>
                          <span className="text-slate-400">• {beh.occurredAt}</span>
                        </div>
                        {beh.description && (
                          <p className="text-slate-600">{beh.description}</p>
                        )}
                      </div>
                      <span
                        className={`text-[10px] font-medium border px-1.5 py-0.5 whitespace-nowrap ${
                          beh.guardianVisible
                            ? "border-blue-200 bg-blue-50 text-blue-700"
                            : "border-slate-200 bg-slate-100 text-slate-600"
                        }`}
                      >
                        {beh.guardianVisible ? "Portal visible" : "Staff only"}
                      </span>
                    </div>
                  ))}

                  {!behaviours.length && (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No praise merits or incidents logged for this student yet.
                    </p>
                  )}
                </div>
              </section>
            </div>
          )}

          {/* TAB 5: GUARDIANS & SAFETY */}
          {activeTab === "guardians" && (
            <div className="space-y-6">
              {/* Linked Guardian Contacts */}
              <section className="border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Family & Guardian Contacts</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Verified legal guardians and emergency notification contacts.
                    </p>
                  </div>
                  <Phone className="h-5 w-5 text-blue-600" />
                </div>

                <div className="mt-4 space-y-3">
                  {guardians.map((g, idx) => (
                    <div
                      key={g.id ?? idx}
                      className="border border-slate-200 p-4 transition-colors hover:border-slate-300"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-slate-900">
                            {g.firstName} {g.lastName}
                          </strong>
                          {g.isPrimary && (
                            <span className="border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold text-blue-800">
                              Primary Contact
                            </span>
                          )}
                          {g.hasLegalResponsibility && (
                            <span className="border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] text-slate-600">
                              Legal responsibility
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 capitalize">{g.relationship}</span>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-4 text-xs">
                        {g.phone ? (
                          <a
                            href={`tel:${g.phone}`}
                            className="flex items-center gap-1.5 text-blue-700 hover:underline"
                          >
                            <Phone size={13} />
                            <span>{g.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">No phone provided</span>
                        )}

                        {g.email ? (
                          <a
                            href={`mailto:${g.email}`}
                            className="flex items-center gap-1.5 text-blue-700 hover:underline"
                          >
                            <Mail size={13} />
                            <span>{g.email}</span>
                          </a>
                        ) : (
                          <span className="text-slate-400">No email provided</span>
                        )}
                      </div>
                    </div>
                  ))}

                  {!guardians.length && (
                    <p className="py-4 text-center text-xs text-slate-500">
                      No linked guardian contacts on file.
                    </p>
                  )}
                </div>
              </section>

              {/* Safeguarding & Care Directives */}
              {safetyNotices.length > 0 && (
                <section className="border border-amber-300 bg-amber-50/60 p-5">
                  <div className="flex items-center justify-between border-b border-amber-200 pb-3">
                    <h3 className="font-bold text-amber-950">Active Care Directives & Restrictions</h3>
                    <ShieldAlert className="h-5 w-5 text-amber-700" />
                  </div>
                  <div className="mt-3 space-y-2">
                    {safetyNotices.map((notice, idx) => (
                      <div key={idx} className="border border-amber-200 bg-white p-3 text-xs">
                        <strong className="text-amber-900">{notice.title}</strong>
                        <p className="mt-1 text-slate-700">{notice.detail}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Enrollment History */}
              <section className="border border-slate-200 bg-white p-5 shadow-xs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h3 className="font-bold text-slate-900">Historical Enrollment Timeline</h3>
                  <GraduationCap className="h-5 w-5 text-slate-500" />
                </div>
                <div className="mt-3 space-y-2 text-xs">
                  {studentEnrollments.map((en) => {
                    const yr = academicYears.find((y) => y.id === en.academicYearId)?.name ?? "Academic Year";
                    const cls = classes.find((c) => c.id === en.classId);
                    const grd = cls ? gradeLevels.find((g) => g.id === cls.gradeLevelId)?.name : "";
                    return (
                      <div
                        key={en.id}
                        className="flex items-center justify-between border-l-2 border-blue-600 bg-slate-50 p-2.5"
                      >
                        <div>
                          <strong className="text-slate-900">{yr}</strong>
                          <span className="ml-2 text-slate-600">
                            {cls ? `${grd ? `${grd} / ` : ""}${cls.name}` : "Unassigned class"}
                          </span>
                        </div>
                        <span className="border border-slate-200 bg-white px-2 py-0.5 text-[10px] capitalize text-slate-700">
                          {en.status}
                        </span>
                      </div>
                    );
                  })}
                  {!studentEnrollments.length && (
                    <p className="py-2 text-xs text-slate-500">No enrollment history records found.</p>
                  )}
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Drawer Action Footer */}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 p-4">
          <div className="text-xs text-slate-500">
            Student ID: <span className="font-mono">{student.id.substring(0, 8)}</span>
          </div>
          <div className="flex items-center gap-2">
            {onEditStudent && (
              <button
                type="button"
                onClick={onEditStudent}
                className="min-h-10 rounded-sm bg-blue-700 px-4 text-xs font-semibold text-white transition-colors hover:bg-blue-800"
              >
                Edit student details
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="min-h-10 rounded-sm border border-slate-300 bg-white px-4 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
