"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AssessmentInput } from "@/lib/assessments";
import type { AssessmentCategoryItem } from "@/app/actions/assessment-actions";

interface AddAssessmentDialogProps {
  categories: AssessmentCategoryItem[];
  classId: string;
  subjectId: string;
  onClose: () => void;
  onSubmit: (input: AssessmentInput) => Promise<void>;
}

export function AddAssessmentDialog({
  categories,
  classId,
  subjectId,
  onClose,
  onSubmit,
}: AddAssessmentDialogProps) {
  const [title, setTitle] = useState("");
  const [code, setCode] = useState("");
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "cat-quiz");
  const [maxScore, setMaxScore] = useState(100);
  const [dateDue, setDateDue] = useState("2026-10-05");
  const [status, setStatus] = useState<"draft" | "published">("draft");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !code.trim()) {
      setError("Please provide a valid title and assessment code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await onSubmit({
        title: title.trim(),
        code: code.trim().toUpperCase(),
        classId,
        subjectId,
        categoryId,
        termId: "term-fall-2026",
        maxScore,
        dateDue,
        status,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create assessment");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md border border-slate-300 bg-white shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
            Create Course Assessment
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Add a new quiz, assignment, examination, or capstone project to the gradebook.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          {error && (
            <div className="border border-red-200 bg-red-50 p-2.5 text-xs text-red-800">
              {error}
            </div>
          )}

          <label className="block">
            <span className="mb-1 block font-semibold text-slate-800">Assessment Title</span>
            <input
              type="text"
              required
              placeholder="e.g. Unit 2 Quadratic Equations Exam"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-9 w-full border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Code / Identifier</span>
              <input
                type="text"
                required
                placeholder="e.g. MATH-EX2"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="h-9 w-full border border-slate-300 bg-white px-3 font-mono uppercase focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Assessment Category</span>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.weight}%)
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Max Possible Points</span>
              <input
                type="number"
                min={1}
                max={1000}
                required
                value={maxScore}
                onChange={(e) => setMaxScore(parseInt(e.target.value) || 100)}
                className="h-9 w-full border border-slate-300 bg-white px-3 font-mono focus:border-blue-600 focus:outline-none"
              />
            </label>

            <label className="block">
              <span className="mb-1 block font-semibold text-slate-800">Due / Exam Date</span>
              <input
                type="date"
                required
                value={dateDue}
                onChange={(e) => setDateDue(e.target.value)}
                className="h-9 w-full border border-slate-300 bg-white px-3 focus:border-blue-600 focus:outline-none"
              />
            </label>
          </div>

          <label className="block">
            <span className="mb-1 block font-semibold text-slate-800">Initial Publication State</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as "draft" | "published")}
              className="h-9 w-full border border-slate-300 bg-white px-2 focus:border-blue-600 focus:outline-none"
            >
              <option value="draft">Draft (Private to Teachers & Staff)</option>
              <option value="published">Published (Visible in Guardian Portal & Transcripts)</option>
            </select>
          </label>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Assessment"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

