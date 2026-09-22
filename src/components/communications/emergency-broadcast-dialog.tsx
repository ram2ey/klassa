"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  type EmergencyBroadcastInput,
  validateEmergencyApproval,
  calculateSmsSegments,
} from "@/lib/communications";

interface EmergencyBroadcastDialogProps {
  onClose: () => void;
  onSubmit: (input: EmergencyBroadcastInput) => Promise<void>;
}

const AUTHORIZED_OFFICERS = [
  { id: "usr-admin-1", name: "Sarah Jenkins", role: "Registrar & Primary Dispatcher" },
  { id: "usr-principal-1", name: "Dr. Arthur Vance", role: "Headmaster / Executive Command" },
  { id: "usr-vp-1", name: "Marcus Brody", role: "Vice Principal & Academic Dean" },
  { id: "usr-safety-1", name: "Capt. James Cole", role: "Campus Safety & Security Director" },
];

export function EmergencyBroadcastDialog({
  onClose,
  onSubmit,
}: EmergencyBroadcastDialogProps) {
  const [title, setTitle] = useState("EMERGENCY NOTICE: Immediate Campus Early Dismissal");
  const [content, setContent] = useState(
    "CAMPUS SAFETY ADVISORY: Severe weather conditions require all classes to conclude at 13:00. Busing service will operate early. All after-school extracurricular activities are suspended. Please follow campus pickup instructions.",
  );
  const [firstApproverId, setFirstApproverId] = useState("usr-admin-1");
  const [secondApproverId, setSecondApproverId] = useState("usr-principal-1");
  const [securityConfirmation, setSecurityConfirmation] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const smsMetrics = calculateSmsSegments(content);
  const approvalCheck = validateEmergencyApproval(firstApproverId, secondApproverId);

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!approvalCheck.valid) {
      setError(approvalCheck.error ?? "Invalid two-party authorization.");
      return;
    }
    if (!securityConfirmation) {
      setError("You must confirm the safety authorization certification before dispatch.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        targetType: "school",
        targetId: "all",
        channels: "both",
        firstApproverId,
        secondApproverId,
        securityConfirmation: true,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Emergency broadcast failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-red-950/70 p-4">
      <div className="w-full max-w-xl border-2 border-red-600 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Urgent High-Contrast Header */}
        <div className="border-b border-red-200 bg-red-600 px-5 py-3.5 text-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 bg-white animate-pulse" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">
                Emergency Command Broadcast (Two-Party Four-Eyes Protocol)
              </h2>
            </div>
            <span className="border border-white/40 bg-red-700 px-2 py-0.5 font-mono text-[10px] font-bold text-white uppercase tracking-wider">
              PRIORITY: CRITICAL
            </span>
          </div>
          <p className="mt-1 text-xs text-red-100">
            Rapid institutional broadcast to all 142 enrolled guardians, students, and faculty members across In-App and SMS channels.
          </p>
        </div>

        <form onSubmit={handleDispatch} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="border border-red-300 bg-red-50 p-3 text-xs font-medium text-red-900">
              {error}
            </div>
          )}

          {/* Legal / Policy Alert Box */}
          <div className="border border-amber-300 bg-amber-50 p-3 text-amber-900 text-xs">
            <p className="font-semibold uppercase tracking-wider text-[11px] text-amber-950">
              Safety Override Clause Active
            </p>
            <p className="mt-0.5 text-[11px] text-amber-800">
              In accordance with campus security policy, emergency broadcasts override standard promotional and circular SMS opt-outs to ensure life-safety notifications reach all registered emergency contacts.
            </p>
          </div>

          {/* Emergency Title */}
          <label className="block">
            <span className="mb-1 block font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              Emergency Headline
            </span>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full border border-slate-300 bg-white px-3 font-semibold text-slate-900 focus:border-red-600 focus:outline-none"
            />
          </label>

          {/* Emergency Content */}
          <label className="block">
            <div className="mb-1 flex items-center justify-between font-bold text-slate-900 uppercase tracking-wider text-[11px]">
              <span>Emergency Directive & Logistics</span>
              <span className="font-mono text-[11px] font-normal text-slate-500">
                {content.length} chars ({smsMetrics.segments} SMS segments)
              </span>
            </div>
            <textarea
              required
              rows={4}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border border-slate-300 bg-white p-3 font-sans text-xs focus:border-red-600 focus:outline-none"
            />
          </label>

          {/* Two-Party Dual Authorization Box */}
          <div className="border border-slate-300 bg-slate-50 p-3.5 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold uppercase tracking-wider text-[11px] text-slate-900">
                Four-Eyes Authorization Requirement
              </span>
              <span className="font-mono text-[11px] text-slate-600">
                2 Authorized Signatures Required
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block font-semibold text-slate-800 text-[11px]">
                  1. Initiating Officer (Author)
                </span>
                <select
                  value={firstApproverId}
                  onChange={(e) => setFirstApproverId(e.target.value)}
                  className="h-8 w-full border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  {AUTHORIZED_OFFICERS.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} ({off.role})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block font-semibold text-slate-800 text-[11px]">
                  2. Confirming Officer (Command)
                </span>
                <select
                  value={secondApproverId}
                  onChange={(e) => setSecondApproverId(e.target.value)}
                  className="h-8 w-full border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  {AUTHORIZED_OFFICERS.map((off) => (
                    <option key={off.id} value={off.id}>
                      {off.name} ({off.role})
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {!approvalCheck.valid && (
              <div className="border border-red-200 bg-red-50 p-2 text-xs text-red-800">
                {approvalCheck.error}
              </div>
            )}
          </div>

          {/* Confirmation Checkbox */}
          <label className="flex items-start gap-2.5 cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={securityConfirmation}
              onChange={(e) => setSecurityConfirmation(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded-none border-slate-300 text-red-600 focus:ring-0"
            />
            <span className="text-xs text-slate-700 leading-tight">
              I formally certify that this dispatch addresses an urgent life-safety or campus operational crisis, and has received secondary commanding authorization per Northfield Academy safety protocol.
            </span>
          </label>

          {/* Actions */}
          <div className="flex items-center justify-between border-t border-slate-200 pt-3">
            <span className="font-mono text-[11px] text-slate-500">
              Estimated Reach: 142 Contacts
            </span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={onClose}
                className="h-8 rounded-none border-slate-300 text-xs text-slate-700 hover:bg-slate-100"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading || !securityConfirmation || !approvalCheck.valid}
                className="h-8 rounded-none bg-red-600 text-xs font-bold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Transmitting..." : "AUTHORIZE & DISPATCH BROADCAST"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
