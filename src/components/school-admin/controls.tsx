"use client";
import { type SchoolAdminData } from "@/lib/school-admin-data";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveSchoolRecordAction, removeSchoolStaffAccessAction } from "@/app/actions/school-admin-actions";
import { Button } from "@/components/ui/button";
import { Unlock, Lock } from "lucide-react";

export function TermLockControl({ term, onUpdated }: { term: SchoolAdminData["terms"][number]; onUpdated: (msg: string) => void }) {
  const [modal, setModal] = useState<"lock" | "unlock" | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [notes, setNotes] = useState("");
  const router = useRouter();

  const handleLock = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const res = await saveSchoolRecordAction({ kind: "term_lock", termId: term.id, lockNotes: notes });
      if (!res.success) { setError(res.error); return; }
      setModal(null);
      setNotes("");
      onUpdated(`Term "${term.name}" has been closed and locked.`);
      router.refresh();
    });
  };

  const handleUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (notes.trim().length < 4) {
      setError("Please explain why this locked term is being reopened (minimum 4 characters).");
      return;
    }
    setError("");
    startTransition(async () => {
      const res = await saveSchoolRecordAction({ kind: "term_unlock", termId: term.id, unlockReason: notes });
      if (!res.success) { setError(res.error); return; }
      setModal(null);
      setNotes("");
      onUpdated(`Term "${term.name}" has been reopened.`);
      router.refresh();
    });
  };

  return (
    <>
      {term.isLocked ? (
        <Button
          variant="secondary"
          className="min-h-11 border-amber-300 text-amber-900 hover:bg-amber-50"
          onClick={() => { setNotes(""); setError(""); setModal("unlock"); }}
        >
          <Unlock size={14} className="mr-1" />
          Unlock term
        </Button>
      ) : (
        <Button
          variant="secondary"
          className="min-h-11 border-slate-300 text-slate-800 hover:bg-slate-100"
          onClick={() => { setNotes(""); setError(""); setModal("lock"); }}
        >
          <Lock size={14} className="mr-1" />
          Close & lock term
        </Button>
      )}

      {modal === "lock" && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Close & lock {term.name}</h3>
            <p className="text-sm text-slate-600">
              Submit every recorded roll call and publish all assessments, grades and latest report cards for active students first. Closing then seals attendance and locks the gradebook.
            </p>
            {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 p-2 border border-rose-200">{error}</p>}
            <form onSubmit={handleLock} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Lock notes (optional)
                <textarea
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                  rows={3}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. End of term marks finalized and published."
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending} className="bg-amber-700 hover:bg-amber-800 text-white">
                  {pending ? "Locking…" : "Confirm close & lock"}
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}

      {modal === "unlock" && (
        <dialog open className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md bg-white p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Unlock {term.name}</h3>
            <p className="text-sm text-slate-600">
              Reopening this term restores locked attendance sessions to their submitted or in-progress state. Gradebook changes will be allowed again. An audit trail reason is required.
            </p>
            {error && <p role="alert" className="text-xs text-rose-700 bg-rose-50 p-2 border border-rose-200">{error}</p>}
            <form onSubmit={handleUnlock} className="space-y-3">
              <label className="block text-sm font-medium text-slate-700">
                Reason for unlocking *
                <textarea
                  className="mt-1 w-full border border-slate-300 p-2 text-sm"
                  rows={3}
                  required
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="e.g. Grade review appeal granted by academic committee."
                />
              </label>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setModal(null)} disabled={pending}>Cancel</Button>
                <Button type="submit" disabled={pending} className="bg-blue-700 hover:bg-blue-800 text-white">
                  {pending ? "Unlocking…" : "Confirm unlock"}
                </Button>
              </div>
            </form>
          </div>
        </dialog>
      )}
    </>
  );
}

export function SubjectAssignmentRemove({ assignmentId, label, onRemoved }: { assignmentId: string; label: string; onRemoved: () => void }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const router = useRouter();
  return <span className="inline-flex flex-col items-start gap-1"><Button variant="secondary" aria-label={`Remove ${label}`} className="min-h-11 border-red-200 text-red-800 hover:bg-red-50" disabled={pending}
    onClick={() => {
      if (!window.confirm(`Remove the subject teacher assignment for ${label}?`)) return;
      setError("");
      startTransition(async () => {
        const result = await saveSchoolRecordAction({ kind: "teacher_subject_assignment_remove", id: assignmentId });
        if (!result.success) { setError(result.error); return; }
        onRemoved();
        router.refresh();
      });
    }}>Remove</Button>{error && <span role="alert" className="text-xs text-red-700">{error}</span>}</span>;
}

export function StaffAccessAction({ membershipId, staffName }: { membershipId: string; staffName: string }) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const router = useRouter();
  return <span className="inline-flex flex-col items-start gap-1"><Button variant="secondary" className="min-h-11 border-red-200 text-red-800 hover:bg-red-50" disabled={pending}
    onClick={() => {
      if (!window.confirm(`Remove ${staffName}'s access to this school? Their school session will end. Their account and access to any other school will remain.`)) return;
      setMessage("");
      startTransition(async () => {
        const result = await removeSchoolStaffAccessAction(membershipId);
        if (!result.success) { setMessage(result.error); return; }
        setMessage("School access removed.");
        router.refresh();
      });
    }}>{pending ? "Removing…" : "Remove access"}</Button>{message && <span role="status" className="max-w-48 text-xs text-slate-600">{message}</span>}</span>;
}
