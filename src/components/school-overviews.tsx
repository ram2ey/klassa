import Link from "next/link";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import type { OfficeData } from "@/lib/office-data";
import type { TeacherData } from "@/lib/teacher-data";
import { formatGMTDateTime } from "@/lib/timezone";
import { OverviewDashboard, type OverviewModel } from "./overview-dashboard";
import { Button } from "./ui/button";

const href = (section: string, date?: string) => `/?section=${section}${date ? `&date=${encodeURIComponent(date)}` : ""}`;
const words = (value: string) => value.replaceAll("_", " ").replaceAll(".", " ").replace(/\b\w/g, letter => letter.toUpperCase());
type AttendanceSession = { id: string; status: string; period: string };
type AttendanceMark = { sessionId: string; status: string };
export function summarizeSubmittedAttendance(sessions: AttendanceSession[], records: AttendanceMark[]) {
  const submitted = new Set(sessions.filter(row => ["submitted", "locked"].includes(row.status)).map(row => row.id));
  const marks = records.filter(row => submitted.has(row.sessionId));
  return { total: marks.length, attended: marks.filter(row => ["present", "late"].includes(row.status)).length, absent: marks.filter(row => row.status === "absent").length };
}
const rate = (total: number, attended: number) => total ? `${Math.round(attended / total * 100)}%` : "—";

export function buildAdministratorOverview(data: SchoolAdminData): OverviewModel {
  const year = data.years.find(row => row.isCurrent);
  const currentClasses = year ? data.classes.filter(row => row.academicYearId === year.id) : [];
  const activeStudents = data.students.filter(row => row.status === "active");
  const attendance = data.attendanceSummary.reduce((sum, row) => ({ total: sum.total + Number(row.total), attended: sum.attended + Number(row.attended), absent: sum.absent + Number(row.absent) }), { total: 0, attended: 0, absent: 0 });
  const dates = data.attendanceSummary.flatMap(row => [row.firstDate, row.lastDate]).filter((value): value is string => !!value).sort();
  const scope = `All school years · Submitted and locked sessions${dates.length ? ` · ${dates[0]} to ${dates.at(-1)}` : ""}`;
  const enrolled = year && data.enrollments.some(row => row.academicYearId === year.id && row.status === "active");
  return {
    description: `${data.school.name} · ${year?.name ?? "Set up your first academic year"} · School administration`,
    metrics: [
      { label: "Active pupils", value: activeStudents.length, detail: "School directory · Active status only", icon: "students", href: href("students") },
      { label: "Current-year classes", value: currentClasses.length, detail: year?.name ?? "No current academic year", icon: "classes", href: href("classes") },
      { label: "Staff", value: data.staff.length, detail: "School staff memberships · Includes administrators", icon: "staff", href: href("staff") },
      { label: "Attendance rate", value: rate(attendance.total, attendance.attended), detail: attendance.total ? `${attendance.total} submitted or locked marks · All school years` : "No submitted attendance marks yet", icon: "attendance", href: href("attendance") },
    ],
    attendance: { ...attendance, scope, href: href("attendance") },
    steps: [
      { label: "Set the current academic year", done: !!year, href: href("academic"), description: year?.name ?? "Create a year and mark it as current." },
      { label: "Add grades and classes", done: !!currentClasses.length, href: href("classes"), description: "Organize classes in the current academic year." },
      { label: "Create staff accounts", done: data.staff.some(row => row.role === "teacher" || row.role === "office_staff"), href: href("staff"), description: "Give teachers and office staff their own access." },
      { label: "Enroll your students", done: !!enrolled, href: href("students"), description: "Place students in current-year classes." },
      { label: "Link guardian contacts", done: data.links.some(link => activeStudents.some(student => student.id === link.studentId)), href: href("guardians"), description: "Connect active pupils with their guardians." },
    ],
    tasks: [{ label: "Guardian absence notes awaiting review", count: (data.absenceNotes ?? []).filter(row => row.status === "submitted").length, href: href("attendance") + "#guardian-absence-notes", detail: "Pending among the latest 100 school notes. Office staff review submissions; inspect their status in attendance." }],
    actions: [
      { label: "Open attendance", href: href("attendance"), description: "Review roll calls, corrections and guardian absence notes." },
      { label: "Manage students", href: href("students"), description: "Enroll pupils and keep the school directory current." },
      { label: "Manage staff", href: href("staff"), description: "Review staff accounts and class assignments." },
    ],
    activity: data.audit.map(event => ({ id: event.id, action: words(event.action), actor: event.actorName ?? "System", timestamp: formatGMTDateTime(event.createdAt), dateTime: new Date(event.createdAt).toISOString() })),
    activityHref: href("audit"),
    guidance: !year || !currentClasses.length || !enrolled ? "Start with an academic year, add classes, create staff accounts, then enroll pupils. Each setup step links to the place to complete it." : undefined,
  };
}

export function AdministratorOverview({ data, onEnroll }: { data: SchoolAdminData; onEnroll: () => void }) {
  const year = data.years.find(row => row.isCurrent);
  const canEnroll = !!year && data.classes.some(row => row.academicYearId === year.id);
  return <OverviewDashboard model={buildAdministratorOverview(data)} headingAction={canEnroll ? <Button onClick={onEnroll}>Enroll student</Button> : <Button asChild><Link href={href(year ? "classes" : "academic")}>Continue school setup</Link></Button>} />;
}

type Notice = { id: string; title: string; content: string };
export function OfficeOverview({ data, date, notices }: { data: OfficeData; date: string; notices: Notice[] }) {
  const morning = data.sessions.filter(row => row.period === "morning_roll_call");
  const attendance = summarizeSubmittedAttendance(morning, data.records);
  const scope = `${date} · School morning roll call · Submitted and locked sessions`;
  return <OverviewDashboard model={{
    description: `${data.school.name} · ${date} · Office operations`,
    metrics: [
      { label: "Active pupils", value: data.students.filter(row => row.status === "active").length, detail: "School directory · Active status only", icon: "students", href: href("students") },
      { label: "Pending intake", value: data.students.filter(row => row.status === "pending").length, detail: "School directory · Awaiting intake", icon: "classes", href: href("students") },
      { label: "Guardian contacts", value: data.guardians.length, detail: "All guardian records in this school", icon: "staff", href: href("guardians") },
      { label: "Attendance rate", value: rate(attendance.total, attendance.attended), detail: `${date} · Submitted or locked morning marks`, icon: "attendance", href: href("attendance", date) },
    ],
    attendance: { ...attendance, scope, href: href("attendance", date) },
    tasks: [
      { label: "Review pending intake", count: data.students.filter(row => row.status === "pending").length, detail: "Students awaiting intake in this school.", href: href("students") },
      { label: "Link guardian contacts", count: data.students.filter(row => row.status === "active" && !data.links.some(link => link.studentId === row.id)).length, detail: "Active pupils without a linked guardian.", href: href("guardians") },
      { label: "Call about unexplained absences", count: data.unexplainedAbsences.length, detail: `${date} · Morning absence follow-up list`, href: href("attendance", date) },
      { label: "Guardian absence notes awaiting review", count: data.absenceNotes.filter(row => row.status === "submitted").length, detail: "Pending among the latest 200 school notes.", href: href("attendance", date) },
      { label: "Reception desk logs", count: data.receptionLogs?.length ?? 0, detail: `${date} · Recorded desk visits`, href: href("reception", date) },
    ],
    actions: [{ label: "Review attendance", href: href("attendance", date) }, { label: "Manage student intake", href: href("students") }, { label: "Open reception desk", href: href("reception", date) }],
    notices,
    guidance: !data.students.length ? "Your school directory is empty. Ask your administrator to prepare the current year and classes, then use student intake to enroll pupils." : undefined,
  }} />;
}

export function TeacherOverview({ data, date, notices }: { data: TeacherData; date: string; notices: Notice[] }) {
  const attendance = summarizeSubmittedAttendance(data.sessions, data.records);
  const activeIds = new Set(data.students.filter(row => row.status === "active").map(row => row.id));
  const pupils = new Set(data.enrollments.filter(row => row.status === "active" && activeIds.has(row.studentId)).map(row => row.studentId));
  return <OverviewDashboard model={{
    description: `${data.school.name} · ${data.currentYear?.name ?? "No current academic year"} · Your teaching workspace`,
    metrics: [
      { label: "Assigned classes", value: data.classes.length, detail: "Your current-year homeroom and subject assignments", icon: "classes", href: href("classes") },
      { label: "Active pupils", value: pupils.size, detail: "Unique active pupils enrolled in your assigned classes", icon: "students", href: href("classes") },
      { label: "Assessments", value: data.assessments.length, detail: "Assessments you can access in assigned classes", icon: "staff", href: href("gradebook") },
      { label: "Attendance rate", value: rate(attendance.total, attendance.attended), detail: `${date} · Your permitted submitted or locked marks`, icon: "attendance", href: href("attendance", date) },
    ],
    attendance: { ...attendance, scope: `${date} · Your permitted classes and periods · Submitted and locked sessions`, href: href("attendance", date) },
    actions: [{ label: "Take attendance", href: href("attendance", date) }, { label: "Open class rosters", href: href("classes") }, { label: "Open gradebook", href: href("gradebook") }],
    notices,
    guidance: !data.classes.length ? "Ask your school administrator to assign you as a homeroom or subject teacher for the current academic year. Your class rosters and attendance will then appear here." : undefined,
  }} />;
}
