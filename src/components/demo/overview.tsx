"use client";
import { type AuditRecordItem, type NavModule } from "./types";
import { Button } from "@/components/ui/button";
import { UploadSimple, Plus, CalendarCheck, Student, UserPlus, ClockCounterClockwise, CheckCircle } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export function OverviewModule({
  studentsCount, guardiansCount, classesCount, attendanceRate, recentAudit, onNavigate, onAddStudent, onImportCsv, onInviteStaff,
}: {
  studentsCount: number;
  guardiansCount: number;
  classesCount: number;
  attendanceRate: number;
  recentAudit: AuditRecordItem[];
  onNavigate: (mod: NavModule) => void;
  onAddStudent: () => void;
  onImportCsv: () => void;
  onInviteStaff: () => void;
}) {
  return (
    <div className="mx-auto max-w-[1500px] space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Institutional Overview</h1>
          <p className="mt-1 text-[13px] text-slate-500">Northfield Academy administrative system of record & operations.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={onImportCsv}><UploadSimple size={16} />Import Roster</Button>
          <Button onClick={onAddStudent}><Plus size={16} weight="bold" />Add Student</Button>
        </div>
      </div>

      <div className="grid border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Students" value={String(studentsCount)} detail="Enrolled in school" />
        <MetricCard label="Today's Attendance Rate" value={`${attendanceRate}%`} detail="Phase 2 Operational" />
        <MetricCard label="Linked Guardians" value={String(guardiansCount)} detail="Verified contacts" />
        <MetricCard label="Active Classes" value={String(classesCount)} detail="Assigned homerooms" last />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Phase 2 Operational Checklist</h2>
            <div className="mt-4 space-y-3">
              <CheckItem title="Teacher Roll Call & Class Assignments" desc="Rapid morning entry, segmented P/A/L/E, minutes late counter" done />
              <CheckItem title="Audit-Tracked Discrepancy Corrections" desc="Mandatory justification reason, before/after transition logs" done />
              <CheckItem title="Automated Absence Alerts & SMS" desc="Targeted carrier dispatches to primary guardians with custody" done />
              <CheckItem title="Guardian Portal & Excuse Workflow" desc="Direct guardian attendance status and note submission" done />
              <CheckItem title="In-App Notification Center" desc="Real-time unread alert badge and event notifications" done />
              <CheckItem title="Attendance Analytics & Reports" desc="Daily rates, chronic absence detection, and CSV exports" done />
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700">Administrative Shortcuts</h2>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                onClick={() => onNavigate("Attendance")}
                className="flex flex-col items-start p-3 border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <CalendarCheck size={22} className="text-blue-700" />
                <span className="mt-2 font-semibold text-xs text-slate-900">Daily Attendance</span>
                <span className="text-[11px] text-slate-500">Roll call & corrections</span>
              </button>
              <button
                onClick={() => onNavigate("Students")}
                className="flex flex-col items-start p-3 border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <Student size={22} className="text-blue-700" />
                <span className="mt-2 font-semibold text-xs text-slate-900">Student Directory</span>
                <span className="text-[11px] text-slate-500">Official student profiles</span>
              </button>
              <button
                onClick={onInviteStaff}
                className="flex flex-col items-start p-3 border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-colors text-left"
              >
                <UserPlus size={22} className="text-blue-700" />
                <span className="mt-2 font-semibold text-xs text-slate-900">Invite Staff</span>
                <span className="text-[11px] text-slate-500">Issue secure staff tokens</span>
              </button>
            </div>
          </section>
        </div>

        <section className="border border-slate-200 bg-white flex flex-col">
          <div className="flex h-12 items-center justify-between border-b border-slate-200 px-4">
            <div className="flex items-center gap-2">
              <ClockCounterClockwise size={17} className="text-blue-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Recent System Audits</h2>
            </div>
            <button onClick={() => onNavigate("Audit log")} className="text-xs font-semibold text-blue-700 hover:underline">
              View all
            </button>
          </div>
          <div className="divide-y divide-slate-100 p-2 flex-1">
            {recentAudit.map((item) => (
              <div key={item.id} className="p-3 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{item.action}</span>
                  <span className="text-[11px] text-slate-400">{item.createdAt}</span>
                </div>
                <div className="mt-1 text-slate-600">
                  <span className="text-slate-500">By {item.actorUserId} · </span>
                  <span className="font-mono text-[11px]">{item.entityId}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

export function MetricCard({ label, value, detail, last }: { label: string; value: string; detail: string; last?: boolean }) {
  return (
    <div className={cn("px-4 py-3", !last && "border-b border-slate-200 sm:border-b-0 sm:border-r")}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.07em] text-slate-500">{label}</p>
      <div className="mt-1 flex items-baseline justify-between gap-3">
        <span className="tabular-nums text-xl font-bold text-slate-900">{value}</span>
        <span className="text-[11px] text-slate-500">{detail}</span>
      </div>
    </div>
  );
}

export function CheckItem({ title, desc, done }: { title: string; desc: string; done?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 text-xs">
      <CheckCircle size={16} weight={done ? "fill" : "regular"} className={cn("mt-0.5 shrink-0", done ? "text-green-700" : "text-slate-300")} />
      <div>
        <span className={cn("font-semibold", done ? "text-slate-800" : "text-slate-400")}>{title}</span>
        <p className="text-[11px] text-slate-500">{desc}</p>
      </div>
    </div>
  );
}
