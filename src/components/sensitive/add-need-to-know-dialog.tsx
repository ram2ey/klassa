"use client";

import { useState, useTransition } from "react";
import { X, Plus, WarningCircle, ShieldCheck } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type {
  CreateNeedToKnowInput,
  NeedToKnowAlertRecord,
  NeedToKnowSeverity,
  KlassoRole,
} from "@/lib/sensitive-records";
import { createNeedToKnowAlertAction } from "@/app/actions/sensitive-record-actions";

interface AddNeedToKnowDialogProps {
  currentUserRole: KlassoRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onAlertCreated: (newAlert: NeedToKnowAlertRecord) => void;
}

const AVAILABLE_STUDENTS = [
  { id: "st-001", name: "Amelia Warren", grade: "Grade 5" },
  { id: "st-002", name: "Elias Martin", grade: "Grade 5" },
  { id: "st-003", name: "Lucas Vance", grade: "Grade 6" },
  { id: "st-004", name: "Julian Hayes", grade: "Grade 6" },
  { id: "st-005", name: "Chloe Sterling", grade: "Grade 4" },
];

export function AddNeedToKnowDialog({
  currentUserRole,
  currentUserId,
  currentUserName,
  onClose,
  onAlertCreated,
}: AddNeedToKnowDialogProps) {
  const [studentId, setStudentId] = useState(AVAILABLE_STUDENTS[0].id);
  const [category, setCategory] = useState<"medical" | "dietary" | "learning_support" | "safety">("medical");
  const [severity, setSeverity] = useState<NeedToKnowSeverity>("routine");
  const [directiveSummary, setDirectiveSummary] = useState("");
  const [actionRequired, setActionRequired] = useState("");
  const [expiresAt, setExpiresAt] = useState("2027-06-30");
  const [error, setError] = useState<string | null>(null);
  const [sanitizationNotice, setSanitizationNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSanitizationNotice(null);

    const selectedStudent = AVAILABLE_STUDENTS.find((s) => s.id === studentId);
    if (!selectedStudent) {
      setError("Please select a student.");
      return;
    }

    if (directiveSummary.trim().length < 5) {
      setError("Directive summary must be at least 5 characters.");
      return;
    }

    if (actionRequired.trim().length < 10) {
      setError("Action instructions for teachers must be at least 10 characters.");
      return;
    }

    const payload: CreateNeedToKnowInput = {
      studentId,
      studentName: selectedStudent.name,
      studentGrade: selectedStudent.grade,
      category,
      severity,
      directiveSummary: directiveSummary.trim(),
      actionRequired: actionRequired.trim(),
      expiresAt: expiresAt ? new Date(expiresAt).toISOString() : null,
    };

    startTransition(async () => {
      const res = await createNeedToKnowAlertAction(payload, currentUserRole, currentUserId, currentUserName);
      if (!res.success || !res.alert) {
        setError(res.error || "Failed to publish Need-to-Know alert.");
      } else {
        if (res.flaggedClinicalContent) {
          setSanitizationNotice("Notice: Diagnostic/sensitive keywords were detected and automatically redacted into protected institutional wording.");
        }
        onAlertCreated(res.alert);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xs border border-slate-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xs bg-amber-100 p-1.5 text-amber-800">
              <ShieldCheck size={18} weight="bold" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Publish Teacher Need-to-Know Directive</h2>
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
          <div className="rounded-xs border border-blue-200 bg-blue-50/70 p-3 text-slate-700 leading-relaxed">
            <span className="font-semibold text-blue-900">Institutional Need-to-Know Standard:</span> Classroom staff require actionable care instructions (e.g. EpiPen location, exam accommodations) without exposing medical diagnosis or confidential safeguarding details.
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-xs border border-rose-200 bg-rose-50 p-2.5 text-rose-700">
              <WarningCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {sanitizationNotice && (
            <div className="flex items-center gap-2 rounded-xs border border-amber-200 bg-amber-50 p-2.5 text-amber-800">
              <WarningCircle size={16} />
              <span>{sanitizationNotice}</span>
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
                Category <span className="text-rose-600">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as "medical" | "dietary" | "learning_support" | "safety")}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="medical">Medical / Health</option>
                <option value="dietary">Dietary / Anaphylaxis</option>
                <option value="learning_support">Learning Support / SENCO</option>
                <option value="safety">Campus Safety / Custody Protocol</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Classroom Urgency / Severity <span className="text-rose-600">*</span>
              </label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as NeedToKnowSeverity)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="routine">Routine (Accommodations & Daily Support)</option>
                <option value="urgent">Urgent (Restricted Contact / Immediate Awareness)</option>
                <option value="critical">Critical (Anaphylaxis / Life Safety Protocol)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Expiry Date
              </label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Directive Summary <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Severe Peanut Anaphylaxis: Carries twin EpiPen pack"
              value={directiveSummary}
              onChange={(e) => setDirectiveSummary(e.target.value)}
              className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Action Required by Classroom Teacher <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Ensure EpiPen kit is transported on all outdoor activities. If facial swelling or wheezing develops, administer pen immediately and page Health Nurse..."
              value={actionRequired}
              onChange={(e) => setActionRequired(e.target.value)}
              className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <Plus size={14} weight="bold" />
              {isPending ? "Publishing..." : "Publish to Teacher Rosters"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
