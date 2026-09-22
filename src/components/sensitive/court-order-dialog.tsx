"use client";

import { useState, useTransition } from "react";
import { X, Plus, Gavel, WarningCircle } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import type {
  CourtOrderType,
  RegisterCourtOrderInput,
  CourtRestrictionRecord,
  KlassoRole,
} from "@/lib/sensitive-records";
import { registerCourtRestrictionAction } from "@/app/actions/sensitive-record-actions";

interface CourtOrderDialogProps {
  currentUserRole: KlassoRole;
  currentUserId: string;
  currentUserName: string;
  onClose: () => void;
  onOrderRegistered: (order: CourtRestrictionRecord) => void;
}

const AVAILABLE_STUDENTS = [
  { id: "st-003", name: "Lucas Vance", grade: "Grade 6" },
  { id: "st-005", name: "Chloe Sterling", grade: "Grade 4" },
  { id: "st-001", name: "Amelia Warren", grade: "Grade 5" },
  { id: "st-002", name: "Elias Martin", grade: "Grade 5" },
  { id: "st-004", name: "Julian Hayes", grade: "Grade 6" },
];

export function CourtOrderDialog({
  currentUserRole,
  currentUserId,
  currentUserName,
  onClose,
  onOrderRegistered,
}: CourtOrderDialogProps) {
  const [studentId, setStudentId] = useState(AVAILABLE_STUDENTS[0].id);
  const [restrictedPersonName, setRestrictedPersonName] = useState("");
  const [orderType, setOrderType] = useState<CourtOrderType>("restraining_order");
  const [docketNumber, setDocketNumber] = useState("");
  const [issuingCourt, setIssuingCourt] = useState("Northfield District Family Court");
  const [summary, setSummary] = useState("");
  const [prohibitPickup, setProhibitPickup] = useState(true);
  const [prohibitDisclosure, setProhibitDisclosure] = useState(true);
  const [prohibitDirectContact, setProhibitDirectContact] = useState(true);
  const [effectiveDate, setEffectiveDate] = useState("2026-09-01");
  const [expirationDate, setExpirationDate] = useState("2027-09-01");
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

    if (!restrictedPersonName.trim()) {
      setError("Restricted individual name is required.");
      return;
    }

    if (!docketNumber.trim()) {
      setError("Court docket number is required.");
      return;
    }

    if (summary.trim().length < 10) {
      setError("Summary must be at least 10 characters.");
      return;
    }

    const payload: RegisterCourtOrderInput = {
      studentId,
      studentName: selectedStudent.name,
      restrictedPersonName: restrictedPersonName.trim(),
      orderType,
      docketNumber: docketNumber.trim(),
      issuingCourt: issuingCourt.trim(),
      summary: summary.trim(),
      prohibitPickup,
      prohibitDisclosure,
      prohibitDirectContact,
      effectiveDate,
      expirationDate: expirationDate ? expirationDate : null,
    };

    startTransition(async () => {
      const res = await registerCourtRestrictionAction(payload, currentUserRole, currentUserId, currentUserName);
      if (!res.success || !res.order) {
        setError(res.error || "Failed to register court restriction.");
      } else {
        onOrderRegistered(res.order);
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-xs border border-slate-300 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <div className="rounded-xs bg-rose-100 p-1.5 text-rose-800">
              <Gavel size={18} weight="bold" />
            </div>
            <h2 className="text-base font-bold text-slate-900">Enforce Statutory Court Restriction</h2>
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
              <WarningCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Protected Student <span className="text-rose-600">*</span>
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
                Order Type <span className="text-rose-600">*</span>
              </label>
              <select
                value={orderType}
                onChange={(e) => setOrderType(e.target.value as CourtOrderType)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="restraining_order">Civil Protective / Restraining Order</option>
                <option value="custody_restriction">Custody & Guardianship Restriction</option>
                <option value="prohibited_contact">Non-Contact Directive</option>
                <option value="non_disclosure">Address & Record Non-Disclosure Order</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Restricted Individual <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="Full Legal Name"
                value={restrictedPersonName}
                onChange={(e) => setRestrictedPersonName(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">
                Docket / Case Number <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., FAM-2026-8821-RO"
                value={docketNumber}
                onChange={(e) => setDocketNumber(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Issuing Court Jurisdiction <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={issuingCourt}
              onChange={(e) => setIssuingCourt(e.target.value)}
              className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block font-semibold text-slate-700">
              Mandated Legal Summary <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="Summary of court stipulations regarding premises entry, record withholding, or custody rights..."
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              required
            />
          </div>

          <div className="space-y-2 rounded-xs border border-slate-200 bg-slate-50 p-3">
            <span className="block font-semibold text-slate-700">Enforced Safeguarding Prohibitions:</span>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prohibitPickup}
                onChange={(e) => setProhibitPickup(e.target.checked)}
                className="rounded-xs text-blue-600 focus:ring-0"
              />
              <span>Prohibit campus release and student pickup</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prohibitDisclosure}
                onChange={(e) => setProhibitDisclosure(e.target.checked)}
                className="rounded-xs text-blue-600 focus:ring-0"
              />
              <span>Prohibit disclosure of attendance, report cards, or address records</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={prohibitDirectContact}
                onChange={(e) => setProhibitDirectContact(e.target.checked)}
                className="rounded-xs text-blue-600 focus:ring-0"
              />
              <span>Prohibit on-premises or electronic communication with student</span>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block font-semibold text-slate-700">Effective Date</label>
              <input
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block font-semibold text-slate-700">Expiration Date (Optional)</label>
              <input
                type="date"
                value={expirationDate}
                onChange={(e) => setExpirationDate(e.target.value)}
                className="w-full rounded-xs border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-200 pt-3">
            <Button variant="secondary" type="button" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending} className="gap-1.5">
              <Plus size={14} weight="bold" />
              {isPending ? "Enforcing Order..." : "Enforce Court Order"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
