"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  calculateSmsSegments,
  type AnnouncementInput,
  type CommunicationTemplateItem,
} from "@/lib/communications";

interface CreateAnnouncementDialogProps {
  onClose: () => void;
  onSubmit: (input: AnnouncementInput) => Promise<void>;
  templates?: CommunicationTemplateItem[];
  prefilledTemplate?: CommunicationTemplateItem | null;
}

export function CreateAnnouncementDialog({
  onClose,
  onSubmit,
  templates = [],
  prefilledTemplate = null,
}: CreateAnnouncementDialogProps) {
  const [title, setTitle] = useState(prefilledTemplate?.title ?? "");
  const [content, setContent] = useState(prefilledTemplate?.contentTemplate ?? "");
  const [targetType, setTargetType] = useState<"school" | "grade" | "class">("school");
  const [targetId, setTargetId] = useState("all");
  const [priority, setPriority] = useState<"normal" | "urgent">("normal");
  const [channels, setChannels] = useState<"in_app" | "sms" | "both">(
    prefilledTemplate?.suggestedChannel ?? "in_app",
  );
  const [scheduledFor, setScheduledFor] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const smsMetrics = calculateSmsSegments(content);

  function handleTemplateSelect(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setTitle(tpl.title);
      setContent(tpl.contentTemplate);
      if (tpl.defaultPriority !== "emergency") {
        setPriority(tpl.defaultPriority);
      }
      setChannels(tpl.suggestedChannel);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError("Title must be at least 3 characters.");
      return;
    }
    if (content.trim().length < 5) {
      setError("Content must be at least 5 characters.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim(),
        targetType,
        targetId,
        priority,
        channels,
        scheduledFor: scheduledFor ? new Date(scheduledFor).toISOString() : undefined,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish announcement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
      <div className="w-full max-w-xl border border-slate-300 bg-white shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="border-b border-slate-200 bg-slate-50 px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Official Institutional Announcement
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                Draft and dispatch an authorized circular to students, classes, or registered guardians.
              </p>
            </div>
            <span className="border border-slate-300 bg-white px-2 py-0.5 font-mono text-[11px] font-semibold text-slate-700">
              AUDITED NOTICE
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              {error}
            </div>
          )}

          {/* Quick Template Picker */}
          {templates.length > 0 && (
            <div className="border border-slate-200 bg-slate-50 p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-slate-600">
                  Insert Standard School Template
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="h-7 border border-slate-300 bg-white px-2 text-xs focus:border-blue-600 focus:outline-none"
                >
                  <option value="" disabled>
                    Choose template...
                  </option>
                  {templates
                    .filter((t) => t.defaultPriority !== "emergency")
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title} ({t.category})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          )}

          {/* Title */}
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-800">Circular Title</span>
            <input
              type="text"
              required
              placeholder="e.g. End of Term Examination Schedule & Logistics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
            />
          </label>

          {/* Audience & Target */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Target Audience</span>
              <select
                value={targetType}
                onChange={(e) => {
                  const val = e.target.value as "school" | "grade" | "class";
                  setTargetType(val);
                  if (val === "school") setTargetId("all");
                  else if (val === "grade") setTargetId("grade-10");
                  else if (val === "class") setTargetId("class-10a");
                }}
                className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
              >
                <option value="school">All Campuses (Entire School)</option>
                <option value="grade">Specific Grade Cohort</option>
                <option value="class">Specific Class Section</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Cohort / Section Selector</span>
              {targetType === "school" ? (
                <input
                  type="text"
                  disabled
                  value="All 142 Enrolled Students & Guardians"
                  className="h-9 w-full border border-slate-200 bg-slate-100 px-3 text-slate-600 font-mono text-[11px]"
                />
              ) : targetType === "grade" ? (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
                >
                  <option value="grade-7">Grade 7 (32 students)</option>
                  <option value="grade-8">Grade 8 (36 students)</option>
                  <option value="grade-9">Grade 9 (36 students)</option>
                  <option value="grade-10">Grade 10 (38 students)</option>
                </select>
              ) : (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
                >
                  <option value="class-7a">Class 7-A</option>
                  <option value="class-7b">Class 7-B</option>
                  <option value="class-10a">Class 10-A (Honors)</option>
                  <option value="class-10b">Class 10-B</option>
                </select>
              )}
            </label>
          </div>

          {/* Channels & Priority */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Delivery Channel</span>
              <select
                value={channels}
                onChange={(e) => setChannels(e.target.value as "in_app" | "sms" | "both")}
                className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
              >
                <option value="in_app">In-App Notice Board Only (Free)</option>
                <option value="sms">SMS Text Alert Only</option>
                <option value="both">Both In-App + SMS (Recommended)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Priority Level</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "normal" | "urgent")}
                className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
              >
                <option value="normal">Normal (Informational Circular)</option>
                <option value="urgent">Urgent (Action / Attention Required)</option>
              </select>
            </label>
          </div>

          {/* Content */}
          <label className="block">
            <div className="mb-1 flex items-center justify-between font-semibold text-slate-800">
              <span>Notice Body & Parameters</span>
              <span className="font-mono text-[11px] text-slate-500 font-normal">
                {content.length} chars
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Write the official communication notice here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full border border-slate-300 bg-white p-3 font-sans text-xs focus:border-blue-600 focus:outline-none"
            />
          </label>

          {/* Live Telecommunications Estimate (if SMS involved) */}
          {(channels === "sms" || channels === "both") && (
            <div className="border border-blue-200 bg-blue-50/70 p-3 text-xs text-blue-950">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-blue-800">
                  SMS Transit Cost Forecast
                </span>
                <span className="font-mono font-bold text-blue-900">
                  ${(smsMetrics.estimatedCost * (targetType === "school" ? 142 : targetType === "grade" ? 38 : 22)).toFixed(2)} USD est.
                </span>
              </div>
              <p className="mt-1 text-[11px] text-blue-700">
                Standard GSM-7: {smsMetrics.segments} segment(s) per recipient ({smsMetrics.characters} characters).
                Only dispatches to guardians with active opt-in consent.
              </p>
            </div>
          )}

          {/* Scheduling (Optional) */}
          <label className="block">
            <span className="mb-1 block font-semibold text-slate-800">
              Scheduled Dispatch (Optional - leave blank for immediate publishing)
            </span>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="h-9 w-full border border-slate-300 bg-white px-3 font-mono text-xs focus:border-blue-600 focus:outline-none"
            />
          </label>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
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
              disabled={loading}
              className="h-8 rounded-none bg-blue-700 text-xs font-semibold text-white hover:bg-blue-800"
            >
              {loading ? "Publishing..." : scheduledFor ? "Schedule Announcement" : "Publish Announcement"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
