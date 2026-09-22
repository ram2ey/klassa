"use client";

import { useState, useTransition } from "react";
import { X, LockKey, WarningOctagon, Plus } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type {
  SensitiveCaseArea,
  CaseConfidentialityTier,
  CreateSensitiveCaseInput,
  SensitiveCaseRecord,
  KlassoRole,
} from "@/lib/sensitive-records";
import { createSensitiveCaseAction } from "@/app/actions/sensitive-record-actions";

interface AddSensitiveCaseDialogProps {
  currentUserRole: KlassoRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onCaseCreated: (newCase: SensitiveCaseRecord) => void;
}

const AVAILABLE_STUDENTS = [
  { id: "st-001", name: "Amelia Warren", grade: "Grade 5" },
  { id: "st-002", name: "Elias Martin", grade: "Grade 5" },
  { id: "st-003", name: "Lucas Vance", grade: "Grade 6" },
  { id: "st-004", name: "Julian Hayes", grade: "Grade 6" },
  { id: "st-005", name: "Chloe Sterling", grade: "Grade 4" },
];

export function AddSensitiveCaseDialog({
  currentUserRole,
  currentUserId,
  currentUserName,
  onClose,
  onCaseCreated,
}: AddSensitiveCaseDialogProps) {
  const [studentId, setStudentId] = useState(AVAILABLE_STUDENTS[0].id);
  const [area, setArea] = useState<SensitiveCaseArea>(
    currentUserRole === "health_nurse"
      ? "health_medical"
      : currentUserRole === "senco"
      ? "special_needs"
      : "safeguarding"
  );
  const [confidentialityTier, setConfidentialityTier] = useState<CaseConfidentialityTier>("confidential");
  const [title, setTitle] = useState("");
  const [initialNarrative, setInitialNarrative] = useState("");
  const [reviewDate, setReviewDate] = useState("");
  const [hasCourtOrder, setHasCourtOrder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const selectedStudent = AVAILABLE_STUDENTS.find((s) => s.id === studentId);
    if (!selectedStudent) {
      setError("Please select a valid student.");
      return;
    }

    if (title.trim().length < 5) {
      setError("Title must be at least 5 characters.");
      return;
    }

    if (initialNarrative.trim().length < 10) {
      setError("Initial narrative must be at least 10 characters.");
      return;
    }

    const payload: CreateSensitiveCaseInput = {
      studentId,
      studentName: selectedStudent.name,
      studentGrade: selectedStudent.grade,
      area,
      confidentialityTier,
      title: title.trim(),
      initialNarrativeNote: initialNarrative.trim(),
      reviewDate: reviewDate ? reviewDate : null,
      hasCourtOrder,
    };

    startTransition(async () => {
      const res = await createSensitiveCaseAction(payload, currentUserRole, currentUserId, currentUserName);
      if (!res.success || !res.caseRecord) {
        setError(res.error || "Failed to create sensitive case.");
      } else {
        onCaseCreated(res.caseRecord);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-xl flex-col rounded-xs border border-slate-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xs bg-slate-100 p-1.5 text-slate-700">
              <LockKey size={18} weight="bold" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Create Confidential Sensitive Case</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-xs p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
          {error && (
            <div className="flex items-center gap-2 rounded-xs border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
              <WarningOctagon size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Student <span className="text-rose-600">*</span>
              </label>
              <select
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                {AVAILABLE_STUDENTS.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name} ({st.grade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Case Domain Area <span className="text-rose-600">*</span>
              </label>
              <select
                value={area}
                onChange={(e) => setArea(e.target.value as SensitiveCaseArea)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="safeguarding">Safeguarding (Child Protection)</option>
                <option value="health_medical">Health & Medical Diagnosis</option>
                <option value="special_needs">Special Educational Needs (SEND)</option>
                <option value="disciplinary">Disciplinary & Pastoral</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Confidentiality Clearance Tier <span className="text-rose-600">*</span>
              </label>
              <select
                value={confidentialityTier}
                onChange={(e) => setConfidentialityTier(e.target.value as CaseConfidentialityTier)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="standard_sensitive">Standard Sensitive (Departmental)</option>
                <option value="confidential">Confidential (Specialist Only)</option>
                <option value="strictly_confidential">Strictly Confidential (Designated Lead Only)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Scheduled Statutory Review Date
              </label>
              <input
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Case Header / Subject <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Anaphylaxis Emergency Action Plan, or External Agency Referral..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-slate-700">
                Confidential Initial Narrative <span className="text-rose-600">*</span>
              </label>
              <span className="text-[10px] text-slate-400 font-mono">
                Auto-encrypted with AES-256-GCM
              </span>
            </div>
            <textarea
              rows={4}
              placeholder="Enter detailed clinical observation, agency minutes, or case background notes..."
              value={initialNarrative}
              onChange={(e) => setInitialNarrative(e.target.value)}
              className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none font-sans"
              required
            />
          </div>

          <div className="flex items-center gap-2 rounded-xs border border-slate-200 bg-slate-50 p-2.5">
            <input
              type="checkbox"
              id="courtOrderCheck"
              checked={hasCourtOrder}
              onChange={(e) => setHasCourtOrder(e.target.checked)}
              className="rounded-xs text-blue-600 focus:ring-0"
            />
            <label htmlFor="courtOrderCheck" className="text-xs text-slate-700 cursor-pointer">
              This case involves active statutory <strong>Court Restrictions or Protective Orders</strong>
            </label>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <Plus size={14} weight="bold" />
              {isPending ? "Encrypting & Storing..." : "Save Encrypted Case"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
