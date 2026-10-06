"use client";
import type { AuditRecordItem, NavModule, Persona } from "./types";
import type { AttendanceSummary } from "@/lib/attendance";
import { OverviewDashboard, type OverviewModel } from "@/components/overview-dashboard";
import { Button } from "@/components/ui/button";

export function OverviewModule({ studentsCount, guardiansCount, classesCount, staffCount, metrics, submitted, schoolName, persona, recentAudit, onNavigate, onAddStudent, onImportCsv, onInviteStaff }: {
  studentsCount: number; guardiansCount: number; classesCount: number; staffCount: number;
  metrics: AttendanceSummary; submitted: boolean; schoolName: string; persona: Persona;
  recentAudit: AuditRecordItem[]; onNavigate: (mod: NavModule) => void;
  onAddStudent: () => void; onImportCsv: () => void; onInviteStaff: () => void;
}) {
  const attendance = submitted ? { total: metrics.total, attended: metrics.present + metrics.late, absent: metrics.absent } : { total: 0, attended: 0, absent: 0 };
  const admin = persona === "admin";
  const teacher = persona === "teacher";
  const guardian = persona === "guardian";
  const actions: OverviewModel["actions"] = [
    { label: "Open attendance", onClick: () => onNavigate("Attendance"), description: "Daily roll call and attendance records" },
    ...(guardian ? [{ label: "School notices & consents", onClick: () => onNavigate("Communications") }] : [{ label: "Open student directory", onClick: () => onNavigate("Students"), description: "View enrolled pupils and profiles" }]),
    ...(teacher ? [{ label: "Enter grades & marks", onClick: () => onNavigate("Gradebook"), description: "Record assessment scores" }] : []),
    ...(admin ? [{ label: "Send school announcement", onClick: () => onNavigate("Communications"), description: "Broadcast messages & SMS" }, { label: "Invite staff", onClick: onInviteStaff }] : []),
  ];
  return <OverviewDashboard headingAction={admin ? <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onImportCsv}>Import roster</Button><Button onClick={onAddStudent}>Add student</Button></div> : undefined} model={{
    description: schoolName + " · Local demo · Synthetic school information",
    metrics: [
      { label: "Active pupils", value: studentsCount, detail: "Active records in the synthetic school directory", icon: "students" },
      { label: "Demo classes", value: classesCount, detail: "Classes in the synthetic roster", icon: "classes" },
      { label: admin ? "Staff" : "Guardian contacts", value: admin ? staffCount : guardiansCount, detail: "Records in the synthetic roster", icon: "staff" },
      { label: "Attendance rate", value: attendance.total ? Math.round(attendance.attended / attendance.total * 100) + "%" : "—", detail: "2026-09-22 · Synthetic submitted marks only", icon: "attendance" },
    ],
    attendance: { ...attendance, scope: "2026-09-22 · Local demo · Synthetic morning roll call", onClick: () => onNavigate("Attendance") },
    actions,
    activity: admin ? recentAudit.map(event => ({ id: event.id, action: event.action, actor: event.actorUserId, timestamp: event.createdAt })) : undefined,
    guidance: !studentsCount ? "Add a pupil or import a roster to explore the local demo." : undefined,
  }} />;
}

// Attendance still consumes this compact card until its own page redesign.
export function MetricCard({ label, value, detail }: { label: string; value: string; detail: string; last?: boolean }) {
  return <article className="p-5"><h2 className="text-sm font-medium text-secondary">{label}</h2><p className="mt-2 text-2xl font-semibold tabular-nums text-ink">{value}</p><p className="mt-2 text-xs text-secondary">{detail}</p></article>;
}
