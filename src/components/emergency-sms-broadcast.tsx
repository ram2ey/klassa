"use client";

import { useId, useState, useTransition } from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, MessageSquare, Radio, Send, ShieldAlert, Sparkles } from "lucide-react";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";

interface DispatchRecord {
  id: string;
  recipientName: string;
  recipientPhone: string;
  message: string;
  status: string;
  sentAt: Date | string;
}

interface EmergencySmsBroadcastProps {
  grades: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string; gradeLevelId?: string | null }>;
  dispatches?: DispatchRecord[];
  onDispatch: (command: WorkflowCommand) => Promise<{ success: boolean; error?: string; recipientCount?: number }>;
  schoolName?: string;
}

const SEVERITY_CONFIG = {
  urgent_alert: {
    label: "Urgent Alert",
    description: "Operational updates requiring same-day guardian attention.",
    badgeClass: "bg-amber-100 text-amber-900 border-amber-300",
  },
  lockdown: {
    label: "Campus Lockdown",
    description: "Active shelter-in-place or security protocol in effect.",
    badgeClass: "bg-rose-100 text-rose-900 border-rose-300",
  },
  school_closure: {
    label: "School Closure",
    description: "Campus closed due to emergency or unscheduled shutdown.",
    badgeClass: "bg-orange-100 text-orange-900 border-orange-300",
  },
  weather_alert: {
    label: "Severe Weather",
    description: "Storm, road closure, or severe weather disruption.",
    badgeClass: "bg-sky-100 text-sky-900 border-sky-300",
  },
  evacuation: {
    label: "Evacuation / Drill",
    description: "Fire, seismic, or emergency campus evacuation in progress.",
    badgeClass: "bg-red-100 text-red-900 border-red-400 font-semibold",
  },
} as const;

type SeverityKey = keyof typeof SEVERITY_CONFIG;

export function EmergencySmsBroadcast({
  grades,
  classes,
  dispatches = [],
  onDispatch,
  schoolName = "School",
}: EmergencySmsBroadcastProps) {
  const scopeId = useId();
  const severityId = useId();
  const gradeId = useId();
  const classId = useId();
  const messageId = useId();
  const confirmId = useId();

  const [scope, setScope] = useState<"whole_school" | "grade" | "class">("whole_school");
  const [targetId, setTargetId] = useState<string>("all");
  const [severity, setSeverity] = useState<SeverityKey>("urgent_alert");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const charCount = message.length;
  const maxChars = 320;
  const charsRemaining = maxChars - charCount;
  const segments = charCount === 0 ? 0 : charCount <= 160 ? 1 : 2;

  const quickTemplates: Array<{ label: string; severity: SeverityKey; text: string }> = [
    {
      label: "Severe Weather Closure",
      severity: "school_closure",
      text: `[${schoolName}] Severe Weather Alert: Campus is closed today due to weather conditions. Remote assignments are posted. Please stay safe.`,
    },
    {
      label: "Precautionary Lockdown",
      severity: "lockdown",
      text: `[${schoolName}] Safety Notice: A precautionary lockdown is currently active. All students and staff are secure inside classrooms. Updates follow.`,
    },
    {
      label: "Lockdown Lifted",
      severity: "urgent_alert",
      text: `[${schoolName}] Safety Update: The precautionary campus lockdown has ended. Normal school operations have resumed and all students are safe.`,
    },
    {
      label: "Early Dismissal",
      severity: "urgent_alert",
      text: `[${schoolName}] Early Dismissal: Students will be dismissed today at 12:30. School buses depart at 12:45. Please arrange collection.`,
    },
    {
      label: "Evacuation Roll Call",
      severity: "evacuation",
      text: `[${schoolName}] Emergency Alert: Campus evacuation in progress. All classes are assembling at designated safe points. Updates to follow.`,
    },
  ];

  const handleApplyTemplate = (item: (typeof quickTemplates)[number]) => {
    setSeverity(item.severity);
    setMessage(item.text);
    setStatusMessage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed) {
      setStatusMessage({ type: "error", text: "Please confirm the broadcast safety acknowledgement before sending." });
      return;
    }
    if (charCount < 5) {
      setStatusMessage({ type: "error", text: "Message must contain at least 5 characters." });
      return;
    }
    if (scope === "grade" && (!targetId || targetId === "all")) {
      setStatusMessage({ type: "error", text: "Please select a specific grade level for this broadcast." });
      return;
    }
    if (scope === "class" && (!targetId || targetId === "all")) {
      setStatusMessage({ type: "error", text: "Please select a specific class for this broadcast." });
      return;
    }

    setStatusMessage(null);
    start(async () => {
      try {
        const result = await onDispatch({
          kind: "emergency_sms_broadcast",
          scope,
          targetId: scope === "whole_school" ? "all" : targetId,
          severity,
          message,
        });

        if (result.success) {
          setStatusMessage({
            type: "success",
            text: `Emergency SMS broadcast successfully dispatched to ${result.recipientCount ?? "all eligible"} guardians.`,
          });
          setMessage("");
          setConfirmed(false);
        } else {
          setStatusMessage({ type: "error", text: result.error || "Failed to dispatch broadcast." });
        }
      } catch (err: unknown) {
        setStatusMessage({
          type: "error",
          text: err instanceof Error ? err.message : "Network error occurred while dispatching SMS broadcast.",
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header Card */}
      <section className="border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2">
            <Radio className="h-5 w-5 text-rose-600 animate-pulse" />
            <h2 className="text-lg font-bold text-slate-900">Emergency Parent SMS Broadcast</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800">
            <ShieldAlert className="h-3.5 w-3.5" />
            Live Parent SMS Gateway
          </span>
        </div>

        <p className="mt-3 text-sm text-slate-600">
          Transmit instant, priority SMS alerts directly to parent and legal guardian mobile devices. Dispatches are logged to the immutable compliance audit register.
        </p>

        {statusMessage && (
          <div
            role="status"
            className={`mt-4 flex items-start gap-2.5 border p-4 text-sm ${
              statusMessage.type === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                : "border-rose-200 bg-rose-50 text-rose-900"
            }`}
          >
            {statusMessage.type === "success" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
            )}
            <div>
              <p className="font-semibold">
                {statusMessage.type === "success" ? "Broadcast Dispatched" : "Broadcast Notice"}
              </p>
              <p className="mt-0.5">{statusMessage.text}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          {/* Severity & Scope Row */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={severityId} className="block text-sm font-semibold text-slate-900">
                Alert Severity Category
              </label>
              <select
                id={severityId}
                value={severity}
                onChange={(e) => setSeverity(e.target.value as SeverityKey)}
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                {Object.entries(SEVERITY_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-slate-500">{SEVERITY_CONFIG[severity].description}</p>
            </div>

            <div>
              <label htmlFor={scopeId} className="block text-sm font-semibold text-slate-900">
                Recipient Scope
              </label>
              <select
                id={scopeId}
                value={scope}
                onChange={(e) => {
                  const newScope = e.target.value as "whole_school" | "grade" | "class";
                  setScope(newScope);
                  if (newScope === "whole_school") setTargetId("all");
                  else if (newScope === "grade") setTargetId(grades[0]?.id ?? "");
                  else if (newScope === "class") setTargetId(classes[0]?.id ?? "");
                }}
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
              >
                <option value="whole_school">Whole School (All Enrolled Guardians)</option>
                <option value="grade">Specific Grade Level</option>
                <option value="class">Specific Class</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                {scope === "whole_school"
                  ? "Sends SMS to all primary and legal guardians registered across the entire school."
                  : scope === "grade"
                  ? "Sends SMS only to guardians of students enrolled in the selected grade."
                  : "Sends SMS only to guardians of students enrolled in the selected class."}
              </p>
            </div>
          </div>

          {/* Conditional Target Selector */}
          {scope === "grade" && (
            <div>
              <label htmlFor={gradeId} className="block text-sm font-semibold text-slate-900">
                Select Grade Level
              </label>
              <select
                id={gradeId}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                required
              >
                <option value="">Choose grade level</option>
                {grades.map((grade) => (
                  <option key={grade.id} value={grade.id}>
                    {grade.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {scope === "class" && (
            <div>
              <label htmlFor={classId} className="block text-sm font-semibold text-slate-900">
                Select Class
              </label>
              <select
                id={classId}
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                className="mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none"
                required
              >
                <option value="">Choose class</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Quick Template Presets */}
          <div>
            <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <Sparkles className="h-3.5 w-3.5 text-amber-500" />
              Quick Templates
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {quickTemplates.map((template) => (
                <button
                  key={template.label}
                  type="button"
                  onClick={() => handleApplyTemplate(template)}
                  className="rounded-xs border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-900 transition-colors"
                >
                  {template.label}
                </button>
              ))}
            </div>
          </div>

          {/* Message Textarea with Live Counters */}
          <div>
            <div className="flex items-center justify-between">
              <label htmlFor={messageId} className="block text-sm font-semibold text-slate-900">
                SMS Message Text
              </label>
              <span
                className={`font-mono text-xs ${
                  charsRemaining < 20 ? "font-bold text-rose-600" : "text-slate-500"
                }`}
              >
                {charCount} / {maxChars} characters ({charsRemaining} remaining)
              </span>
            </div>
            <textarea
              id={messageId}
              rows={4}
              maxLength={maxChars}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={`[${schoolName}] Type your urgent notice to parents here...`}
              className="mt-1 block w-full border border-slate-300 bg-white p-3 text-sm focus:border-blue-600 focus:outline-none"
              required
            />

            {/* Segment meter info */}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-1.5">
                <MessageSquare className="h-3.5 w-3.5 text-slate-400" />
                <span>
                  Estimated SMS Billing:{" "}
                  <strong>
                    {segments} {segments === 1 ? "segment" : "segments"}
                  </strong>{" "}
                  (160 chars per segment)
                </span>
              </div>
              {charCount > 160 && (
                <span className="text-amber-700">Multi-part message: Delivered concatenated on recipient handsets.</span>
              )}
            </div>
          </div>

          {/* Safety Confirmation Guard */}
          <div className="rounded-xs border border-rose-200 bg-rose-50/60 p-4">
            <label htmlFor={confirmId} className="flex items-start gap-3 cursor-pointer">
              <input
                id={confirmId}
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1 h-4 w-4 rounded-xs border-slate-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-xs text-slate-800">
                <strong>Emergency Authorization Acknowledgement:</strong> I confirm this is an official school
                emergency communication. Transmitting this message will dispatch real-time SMS alerts to guardians and
                record an immutable entry in the compliance audit trail.
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <div className="flex flex-wrap items-center justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={pending || !confirmed || charCount < 5}
              className="inline-flex min-h-11 items-center gap-2 bg-rose-700 px-6 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-rose-800 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
              {pending ? "Dispatching Broadcast..." : "Send Emergency SMS Broadcast"}
            </button>
          </div>
        </form>
      </section>

      {/* Dispatches History Feed */}
      <section className="border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <h3 className="font-bold text-slate-900">Recent SMS Dispatches ({dispatches.length})</h3>
          <span className="text-xs text-slate-500">Last 50 dispatches</span>
        </div>

        {dispatches.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">No emergency SMS dispatches recorded yet.</p>
        ) : (
          <div className="mt-4 divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 uppercase tracking-wider">
                  <th className="py-2 pr-4 font-semibold">Sent At</th>
                  <th className="py-2 pr-4 font-semibold">Recipient</th>
                  <th className="py-2 pr-4 font-semibold">Phone</th>
                  <th className="py-2 pr-4 font-semibold">Status</th>
                  <th className="py-2 font-semibold">Message</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dispatches.map((dispatch) => (
                  <tr key={dispatch.id} className="hover:bg-slate-50">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-500">
                      {typeof dispatch.sentAt === "string"
                        ? dispatch.sentAt
                        : new Date(dispatch.sentAt).toLocaleString("en-GB", { timeZone: "UTC" })}
                    </td>
                    <td className="py-2.5 pr-4 font-medium text-slate-900 whitespace-nowrap">
                      {dispatch.recipientName}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-slate-600 whitespace-nowrap">
                      {dispatch.recipientPhone}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      <span
                        className={`inline-block rounded-xs px-2 py-0.5 text-[10px] font-semibold uppercase ${
                          dispatch.status === "delivered" || dispatch.status === "sent"
                            ? "bg-emerald-100 text-emerald-800"
                            : dispatch.status === "simulated"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {dispatch.status}
                      </span>
                    </td>
                    <td className="py-2.5 text-slate-700 max-w-md truncate" title={dispatch.message}>
                      {dispatch.message}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
