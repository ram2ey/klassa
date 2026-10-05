"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitGuardianAbsenceNoteAction } from "@/app/actions/guardian-portal-actions";
import { Button } from "@/components/ui/button";

type StudentChoice = { id: string; firstName: string; lastName: string; schoolName: string };

export function GuardianAbsenceNoteForm({ students }: { students: StudentChoice[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();
  const today = new Date();
  const dateValue = (days: number) => { const date = new Date(today); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
  if (!students.length) return null;

  return (
    <section className="rounded-card border border-line-subtle bg-surface shadow-card overflow-hidden">
      <div className="border-b border-line-subtle p-5">
        <h2 className="font-bold text-ink">Send an absence note</h2>
        <p className="mt-1 text-sm text-secondary">Tell the school office about a past or upcoming absence. This note does not change an attendance mark.</p>
      </div>
      <form className="grid gap-4 p-5 sm:grid-cols-3 sm:items-end" onSubmit={event => {
        event.preventDefault(); setError(""); setMessage(""); const htmlForm = event.currentTarget; const form = new FormData(htmlForm);
        start(async () => {
          try {
            const result = await submitGuardianAbsenceNoteAction({
              studentId: String(form.get("studentId") ?? ""),
              absenceDate: String(form.get("absenceDate") ?? ""),
              reasonCategory: String(form.get("reasonCategory") ?? "illness") as "illness" | "appointment" | "family" | "other",
            });
            if (!result.success) { setError(result.error); return; }
            setMessage("Absence note sent to the school office."); htmlForm.reset(); router.refresh();
          } catch { setError("The absence note could not be sent. Refresh and try again."); }
        });
      }}>
        <label className="block text-sm font-medium text-ink">Student
          <select name="studentId" required className="ui-field mt-1.5 w-full">
            {students.map(student => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.schoolName}</option>)}
          </select>
        </label>
        <label className="block text-sm font-medium text-ink">Absence date
          <input name="absenceDate" type="date" required defaultValue={dateValue(0)} min={dateValue(-30)} max={dateValue(90)} className="ui-field mt-1.5 w-full" />
        </label>
        <label className="block text-sm font-medium text-ink">Reason category
          <select name="reasonCategory" required className="ui-field mt-1.5 w-full">
            <option value="illness">Illness</option>
            <option value="appointment">Appointment</option>
            <option value="family">Family matter</option>
            <option value="other">Other</option>
          </select>
        </label>
        {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-subtle p-3 text-sm text-danger sm:col-span-3">{error}</p>}
        {message && <p role="status" className="rounded-control border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 sm:col-span-3">{message}</p>}
        <div className="sm:col-span-3">
          <Button className="min-h-11" disabled={pending}>{pending ? "Sending…" : "Send note"}</Button>
        </div>
      </form>
    </section>
  );
}
