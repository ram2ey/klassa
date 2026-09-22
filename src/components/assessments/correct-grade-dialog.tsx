"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface CorrectGradeDialogProps {
  gradeInfo: {
    gradeId: string;
    assessmentId: string;
    assessmentTitle: string;
    studentId: string;
    studentName: string;
    currentScore: number;
    maxScore: number;
  };
  onClose: () => void;
  onSubmit: (newScore: number, reason: string) => Promise<void>;
}

export function CorrectGradeDialog({
  gradeInfo,
  onClose,
  onSubmit,
}: CorrectGradeDialogProps) {
  const [newScore, setNewScore] = useState<number>(gradeInfo.currentScore);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (reason.trim().length < 4) {
      setError("Please provide a specific justification reason (minimum 4 characters).");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit(newScore, reason.trim());
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record correction");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md border border-slate-300 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Correct Published Assessment Grade
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Mandatory audit trail justification required for altering published academic records.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4 text-xs">
          {error && (
            <div className="border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              {error}
            </div>
          )}

          <div className="border border-slate-200 bg-slate-50 p-3 space-y-1">
            <div className="flex items-center justify-between font-bold text-slate-900">
              <span>{gradeInfo.studentName}</span>
              <span className="font-mono text-slate-500">{gradeInfo.studentId}</span>
            </div>
            <p className="text-slate-600 truncate">{gradeInfo.assessmentTitle}</p>
            <p className="text-[11px] text-slate-500">Current Score: {gradeInfo.currentScore} / {gradeInfo.maxScore} pts</p>
          </div>

          <label className="block">
            <span className="mb-1 block font-semibold text-slate-800">New Corrected Score</span>
            <input
              type="number"
              min={0}
              max={gradeInfo.maxScore}
              step="0.5"
              required
              value={newScore}
              onChange={(e) => setNewScore(parseFloat(e.target.value) || 0)}
              className="h-9 w-full border border-slate-300 bg-white px-3 text-xs focus:border-blue-600 focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="mb-1 block font-semibold text-slate-800">
              Mandatory Audit Justification Reason
            </span>
            <textarea
              required
              rows={3}
              minLength={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Recalculated score after re-evaluating question 4 rubric with department lead."
              className="w-full border border-slate-300 p-2 text-xs focus:border-blue-600 focus:outline-none"
            />
          </label>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Recording..." : "Persist Grade Correction"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

