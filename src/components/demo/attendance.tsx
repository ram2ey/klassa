"use client";
import { type AttendanceSheetRecord, type DiscrepancyCorrectionRecord } from "@/app/actions/attendance-actions";
import { calculateAttendanceMetrics, type AttendanceStatus } from "@/lib/attendance";
import { type ClassRecord, type Persona } from "./types";
import { useState } from "react";
import { CaretRight, DownloadSimple, CalendarBlank, UserCheck, CheckCircle, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { MetricCard } from "./overview";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DialogFrame } from "./dialogs";

export function AttendanceManagerModule({
  records, metrics, sessionStatus, selectedClassId, setSelectedClassId,
  classes, corrections,
  onMarkAllPresent, onSetStatus, onSubmitSession, onOpenCorrectionModal,
  onExportCsv,
}: {
  records: AttendanceSheetRecord[];
  metrics: ReturnType<typeof calculateAttendanceMetrics>;
  sessionStatus: "in_progress" | "submitted";
  selectedClassId: string;
  setSelectedClassId: (id: string) => void;
  classes: ClassRecord[];
  corrections: DiscrepancyCorrectionRecord[];
  persona: Persona;
  onMarkAllPresent: () => void;
  onSetStatus: (studentId: string, status: AttendanceStatus, lateMin?: number, reason?: string) => void;
  onSubmitSession: () => void;
  onOpenCorrectionModal: (rec: AttendanceSheetRecord) => void;
  onExportCsv: () => void;
}) {
  const [tab, setTab] = useState<"rollCall" | "discrepancies" | "reports">("rollCall");

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-slate-500">
            <span>Administration</span>
            <CaretRight size={11} />
            <span className="text-slate-700">Attendance & Guardian Operations</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Operational Attendance</h1>
          <p className="mt-1 text-[13px] text-slate-500">
            Teacher roll-call entry and audit-tracked attendance corrections.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onExportCsv}>
            <DownloadSimple size={16} />Export CSV Report
          </Button>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid border border-slate-200 bg-white sm:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Daily Attendance Rate" value={`${metrics.attendanceRate}%`} detail="Target >= 95%" />
        <MetricCard label="Present" value={String(metrics.present)} detail="On time" />
        <MetricCard label="Late / Tardy" value={String(metrics.late)} detail="Average delay: 15 min" />
        <MetricCard label="Excused Absences" value={String(metrics.excused)} detail="Documented notes" />
        <MetricCard label="Unexcused Absences" value={String(metrics.absent)} detail="Office follow-up needed" last />
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setTab("rollCall")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "rollCall" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Daily Roll Call ({records.length})
        </button>
        <button
          onClick={() => setTab("discrepancies")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "discrepancies" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Discrepancy Corrections ({corrections.length})
        </button>
        <button
          onClick={() => setTab("reports")}
          className={cn("h-10 px-4 text-xs font-semibold border-b-2 transition-colors", tab === "reports" ? "border-blue-700 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-900")}
        >
          Attendance Analytics & Chronic Watch
        </button>
      </div>

      {/* Sub-View: Roll Call */}
      {tab === "rollCall" && (
        <section className="border border-slate-200 bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-3 bg-slate-50">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <span>Class:</span>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="h-8 border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>Class {c.name} ({c.grade})</option>
                  ))}
                </select>
              </label>

              <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                <CalendarBlank size={15} />
                <span>Tuesday, 22 Sep 2026</span>
              </div>

              <Badge tone={sessionStatus === "submitted" ? "green" : "amber"}>
                {sessionStatus === "submitted" ? "Session Submitted" : "In Progress"}
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onMarkAllPresent}>
                <UserCheck size={14} />Mark All Present
              </Button>
              <Button size="sm" onClick={onSubmitSession}>
                <CheckCircle size={14} weight="bold" />Submit Morning Roll Call
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 font-bold">Student Name</th>
                  <th className="px-4 font-bold">Student ID</th>
                  <th className="px-4 font-bold">Attendance Status</th>
                  <th className="px-4 font-bold">Arrival / Excuse Detail</th>
                  <th className="px-4 font-bold">Primary Guardian</th>
                  <th className="w-16 px-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.studentId} className="h-14 border-b border-slate-100 hover:bg-blue-50/20 transition-colors">
                    <td className="px-4">
                      <span className="font-semibold text-xs text-slate-900">{r.studentName}</span>
                    </td>
                    <td className="px-4 font-mono text-xs text-slate-600">{r.studentNumber}</td>
                    <td className="px-4">
                      {/* Segmented Status Selector */}
                      <div className="inline-flex border border-slate-300 bg-white">
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "present")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "present" ? "bg-green-700 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          P
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "absent")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "absent" ? "bg-red-700 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          A
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "late")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "late" ? "bg-amber-600 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          L
                        </button>
                        <button
                          type="button"
                          onClick={() => onSetStatus(r.studentId, "excused")}
                          className={cn("px-2.5 py-1 text-xs font-bold transition-colors", r.status === "excused" ? "bg-blue-700 text-white" : "text-slate-600 hover:bg-slate-100")}
                        >
                          E
                        </button>
                      </div>
                    </td>
                    <td className="px-4 text-xs">
                      {r.status === "late" && (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-500">Late:</span>
                          <input
                            type="number"
                            defaultValue={r.arrivalMinutesLate || 10}
                            onChange={(e) => onSetStatus(r.studentId, "late", Number(e.target.value))}
                            className="h-7 w-16 border border-slate-300 px-2 font-mono"
                          />
                          <span className="text-slate-500 text-[11px]">min</span>
                        </div>
                      )}
                      {(r.status === "excused" || r.status === "absent") && (
                        <input
                          placeholder="Reason / note…"
                          defaultValue={r.reason || ""}
                          onBlur={(e) => onSetStatus(r.studentId, r.status, undefined, e.target.value)}
                          className="h-7 w-full max-w-xs border border-slate-300 px-2 text-xs"
                        />
                      )}
                      {r.status === "present" && <span className="text-slate-400 italic">On time</span>}
                    </td>
                    <td className="px-4 text-xs text-slate-600">
                      <span>{r.guardianName}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{r.guardianPhone}</span>
                    </td>
                    <td className="px-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => onOpenCorrectionModal(r)}
                        title="Correct record with audit note"
                      >
                        Correct
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sub-View: Discrepancy Corrections */}
      {tab === "discrepancies" && (
        <section className="border border-slate-200 bg-white">
          <div className="border-b border-slate-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Audit-Tracked Discrepancy Log</h2>
              <p className="mt-0.5 text-xs text-slate-500">Immutable correction record with mandatory justification reasons.</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-slate-200 bg-slate-50 text-[10px] uppercase tracking-[0.08em] text-slate-500">
                  <th className="px-4 font-bold">Date</th>
                  <th className="px-4 font-bold">Student</th>
                  <th className="px-4 font-bold">Class</th>
                  <th className="px-4 font-bold">State Transition</th>
                  <th className="px-4 font-bold">Audit Justification</th>
                  <th className="px-4 font-bold">Corrected By</th>
                </tr>
              </thead>
              <tbody>
                {corrections.map((corr) => (
                  <tr key={corr.id} className="h-14 border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-4 font-mono text-xs text-slate-500">{corr.date}</td>
                    <td className="px-4 font-semibold text-xs text-slate-900">{corr.studentName}</td>
                    <td className="px-4 text-xs font-bold text-blue-700">{corr.className}</td>
                    <td className="px-4">
                      <div className="flex items-center gap-1.5 text-xs font-mono">
                        <span className="line-through text-red-600 uppercase font-bold">{corr.previousStatus}</span>
                        <span>→</span>
                        <span className="text-green-700 uppercase font-bold">{corr.newStatus}</span>
                      </div>
                    </td>
                    <td className="px-4 text-xs text-slate-700 max-w-sm">
                      <span className="italic font-medium">&ldquo;{corr.reason}&rdquo;</span>
                    </td>
                    <td className="px-4 text-xs text-slate-600">
                      <div>{corr.correctedBy}</div>
                      <span className="text-[10px] text-slate-400">{corr.correctedAt}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sub-View: Reports & Chronic Absenteeism */}
      {tab === "reports" && (
        <div className="grid gap-4 md:grid-cols-2">
          <section className="border border-slate-200 bg-white p-5 space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Class Attendance Distribution</h2>
            <div className="space-y-3 text-xs">
              <ClassRateBar name="Class 7B" rate={96.4} count="27 / 28 present" />
              <ClassRateBar name="Class 7A" rate={95.0} count="25 / 27 present" />
              <ClassRateBar name="Class 6B" rate={94.2} count="24 / 25 present" />
              <ClassRateBar name="Class 8C" rate={93.8} count="27 / 29 present" />
              <ClassRateBar name="Class 6A" rate={88.0} count="23 / 26 present (High Absences)" alert />
              <ClassRateBar name="Class 5A" rate={92.5} count="22 / 24 present" />
            </div>
          </section>

          <section className="border border-slate-200 bg-white p-5 space-y-4">
            <div className="flex items-center gap-2">
              <WarningCircle size={18} className="text-amber-700" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-800">Chronic Absenteeism Watchlist</h2>
            </div>
            <p className="text-xs text-slate-500">Students with attendance rate below 90% (&gt;= 10% absent days).</p>
            <div className="space-y-2">
              <div className="border border-amber-200 bg-amber-50/50 p-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Elias Martin (ST-2026-0126)</span>
                  <Badge tone="amber">87.5% Rate</Badge>
                </div>
                <p className="mt-1 text-[11px] text-slate-600">Class 5A · 3 unexcused absences in past 20 days. Primary guardian notified.</p>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function ClassRateBar({ name, rate, count, alert }: { name: string; rate: number; count: string; alert?: boolean }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="font-semibold text-slate-800">{name}</span>
        <span className={cn("font-mono font-bold", alert ? "text-amber-700" : "text-slate-700")}>{rate}% ({count})</span>
      </div>
      <div className="h-2 w-full bg-slate-100">
        <div className={cn("h-full", alert ? "bg-amber-600" : "bg-blue-700")} style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

export function CorrectAttendanceDialog({
  record, onClose, onSubmit,
}: {
  record: AttendanceSheetRecord;
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogFrame title="Correct Attendance Record" description="Office staff discrepancy correction with mandatory audit justification." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-4 text-xs">
          <div className="border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between font-bold">
              <span>{record.studentName} ({record.studentNumber})</span>
              <span className="uppercase text-slate-500">Current: {record.status}</span>
            </div>
            <span className="text-slate-500 mt-1 block">Class {record.className} · Session Date: 2026-09-22</span>
          </div>

          <label className="block">
            <span className="mb-1 block font-semibold">New Corrected Status</span>
            <select name="newStatus" className="h-9 w-full border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none">
              <option value="excused">Excused (Medical, Family, or School Authorized)</option>
              <option value="present">Present (Verified in Class / Late Arrival)</option>
              <option value="late">Late (Tardy Arrival)</option>
              <option value="absent">Absent (Unexcused)</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block font-semibold">Mandatory Audit Justification Reason</span>
            <textarea
              required
              name="reason"
              minLength={3}
              rows={3}
              autoFocus
              className="w-full border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Parent phoned office at 09:15 to report medical appointment; doctor note verified."
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Commit Correction</Button>
        </div>
      </form>
    </DialogFrame>
  );
}

export function SubmitExcuseDialog({
  onClose, onSubmit,
}: {
  onClose: () => void;
  onSubmit: (formData: FormData) => void;
}) {
  return (
    <DialogFrame title="Submit Absence Excuse Note" description="Directly inform the school office of an upcoming or past absence." onClose={onClose}>
      <form action={onSubmit}>
        <div className="p-4 space-y-4 text-xs">
          <label className="block">
            <span className="mb-1 block font-semibold">Absence Date</span>
            <input required type="date" name="dateStr" defaultValue="2026-09-22" className="h-9 w-full border border-slate-300 px-3 focus:border-blue-600 focus:outline-none" />
          </label>
          <label className="block">
            <span className="mb-1 block font-semibold">Reason for Absence</span>
            <textarea
              required
              name="reason"
              rows={3}
              autoFocus
              className="w-full border border-slate-300 p-2 focus:border-blue-600 focus:outline-none"
              placeholder="e.g. Dental appointment scheduled at 10:00 AM."
            />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 bg-slate-50 p-3">
          <Button type="button" variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit">Submit Note to Office</Button>
        </div>
      </form>
    </DialogFrame>
  );
}
