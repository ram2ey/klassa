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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const smsMetrics = calculateSmsSegments(content);

  function handleTemplateSelect(templateId: string) {
    const tpl = templates.find((t) => t.id === templateId);
    if (tpl) {
      setTitle(tpl.title);
      setContent(tpl.contentTemplate);
      setPriority(tpl.defaultPriority);
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
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to publish announcement");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-xl rounded-card border border-line-subtle bg-surface shadow-2xl animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
        {/* Header */}
        <div className="border-b border-line-subtle bg-surface-subtle px-5 py-3.5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-ink">
                Official Institutional Announcement
              </h2>
              <p className="mt-0.5 text-xs text-secondary">
                Draft and dispatch an authorized circular to students, classes, or registered guardians.
              </p>
            </div>
            <span className="rounded-control border border-line bg-surface px-2 py-0.5 font-mono text-[11px] font-semibold text-secondary">
              AUDITED NOTICE
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {error && (
            <div className="rounded-control border border-danger/20 bg-danger-subtle p-3 text-xs text-danger">
              {error}
            </div>
          )}

          {/* Quick Template Picker */}
          {templates.length > 0 && (
            <div className="rounded-control border border-line-subtle bg-surface-subtle p-2.5">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-secondary">
                  Insert Standard School Template
                </span>
                <select
                  defaultValue=""
                  onChange={(e) => handleTemplateSelect(e.target.value)}
                  className="h-7 rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none cursor-pointer"
                >
                  <option value="" disabled>
                    Choose template...
                  </option>
                  {templates.map((t) => (
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
            <span className="mb-1 block font-semibold text-secondary">Circular Title</span>
            <input
              type="text"
              required
              placeholder="e.g. End of Term Examination Schedule & Logistics"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full rounded-control border border-line bg-surface px-3 text-xs text-ink focus:border-primary focus:outline-none"
            />
          </label>

          {/* Audience & Target */}
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-semibold text-secondary">Target Audience</span>
              <select
                value={targetType}
                onChange={(e) => {
                  const val = e.target.value as "school" | "grade" | "class";
                  setTargetType(val);
                  if (val === "school") setTargetId("all");
                  else if (val === "grade") setTargetId("grade-10");
                  else if (val === "class") setTargetId("class-10a");
                }}
                className="h-9 w-full rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="school">All Campuses (Entire School)</option>
                <option value="grade">Specific Grade Cohort</option>
                <option value="class">Specific Class Section</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-secondary">Cohort / Section Selector</span>
              {targetType === "school" ? (
                <input
                  type="text"
                  disabled
                  value="All 142 Enrolled Students & Guardians"
                  className="h-9 w-full rounded-control border border-line bg-surface-subtle px-3 text-secondary font-mono text-[11px]"
                />
              ) : targetType === "grade" ? (
                <select
                  value={targetId}
                  onChange={(e) => setTargetId(e.target.value)}
                  className="h-9 w-full rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none"
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
                  className="h-9 w-full rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none"
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
              <span className="mb-1 block font-semibold text-secondary">Delivery Channel</span>
              <select
                value={channels}
                onChange={(e) => setChannels(e.target.value as "in_app" | "sms" | "both")}
                className="h-9 w-full rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="in_app">In-App Notice Board Only (Free)</option>
                <option value="sms">SMS Text Alert Only</option>
                <option value="both">Both In-App + SMS (Recommended)</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-secondary">Priority Level</span>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as "normal" | "urgent")}
                className="h-9 w-full rounded-control border border-line bg-surface px-2 text-xs text-ink focus:border-primary focus:outline-none"
              >
                <option value="normal">Normal (Informational Circular)</option>
                <option value="urgent">Urgent (Action / Attention Required)</option>
              </select>
            </label>
          </div>

          {/* Content */}
          <label className="block">
            <div className="mb-1 flex items-center justify-between font-semibold text-secondary">
              <span>Notice Body & Parameters</span>
              <span className="font-mono text-[11px] text-secondary font-normal">
                {content.length} chars
              </span>
            </div>
            <textarea
              required
              rows={4}
              placeholder="Write the official communication notice here..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full rounded-control border border-line bg-surface p-3 font-sans text-xs text-ink focus:border-primary focus:outline-none"
            />
          </label>

          {/* Live Telecommunications Estimate (if SMS involved) */}
          {(channels === "sms" || channels === "both") && (
            <div className="rounded-control border border-primary/20 bg-primary-subtle p-3 text-xs text-selected">
              <div className="flex items-center justify-between">
                <span className="font-semibold uppercase tracking-wider text-[11px] text-selected">
                  SMS Transit Cost Forecast
                </span>
                <span className="font-mono font-bold text-selected">
                  ${(smsMetrics.estimatedCost * (targetType === "school" ? 142 : targetType === "grade" ? 38 : 22)).toFixed(2)} USD est.
                </span>
              </div>
              <p className="mt-1 text-[11px] text-selected/90">
                Standard GSM-7: {smsMetrics.segments} segment(s) per recipient ({smsMetrics.characters} characters).
                Only dispatches to guardians with active opt-in consent.
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 border-t border-line-subtle pt-3">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              {loading ? "Publishing..." : "Publish Announcement"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
