"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchoolGdprRequestAction, decideSchoolGdprRequestAction } from "@/app/actions/school-gdpr-actions";
import type { SchoolGdprData } from "@/lib/school-gdpr-data";
import type { SchoolAdminData } from "@/lib/school-admin-data";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const field = "ui-field mt-1.5 w-full";
const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());

export function SchoolAdminGdprPanel({ data, students }: { data: SchoolGdprData; students: SchoolAdminData["students"] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setError(""); setMessage("");
    start(async () => {
      try {
        const result = await createSchoolGdprRequestAction({
          studentId: String(values.get("studentId") ?? ""),
          requestType: String(values.get("requestType") ?? "export") as "export",
          requesterName: String(values.get("requesterName") ?? ""),
          requesterRole: String(values.get("requesterRole") ?? "guardian") as "guardian",
          requesterEmail: String(values.get("requesterEmail") ?? ""),
          justification: String(values.get("justification") ?? ""),
        });
        if (!result.success) { setError(result.error); return; }
        form.reset(); setMessage("Request recorded for review."); router.refresh();
      } catch { setError("The request could not be recorded. Refresh and try again."); }
    });
  }

  function decide(requestId: string, status: "completed" | "rejected") {
    setError(""); setMessage("");
    start(async () => {
      try {
        const result = await decideSchoolGdprRequestAction({ requestId, status, note: notes[requestId] ?? "" });
        if (!result.success) { setError(result.error); return; }
        setNotes(current => ({ ...current, [requestId]: "" }));
        setMessage("Decision recorded. The app did not alter the pupil record or release data."); router.refresh();
      } catch { setError("The request decision could not be saved. Refresh and try again."); }
    });
  }

  return (
    <section className="rounded-card border border-line-subtle bg-surface shadow-card">
      <div className="border-b border-line-subtle p-5">
        <h2 className="font-bold text-ink">Privacy requests</h2>
        <p className="mt-1 text-sm text-secondary">
          Record a request and the administrator&apos;s decision. Complete any record correction or disclosure through the school&apos;s verified process, then describe what was done in the decision note.
        </p>
      </div>
      {error && <p role="alert" className="mx-5 mt-4 rounded-control border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">{error}</p>}
      {message && <p role="status" className="mx-5 mt-4 rounded-control border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      <form className="grid gap-4 border-b border-line-subtle p-5 md:grid-cols-2" onSubmit={create}>
        <h3 className="font-semibold text-ink md:col-span-2">Record a request</h3>
        <label className="text-sm font-medium text-ink">Pupil
          <select className={field} name="studentId" required>
            {students.map(student => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.studentNumber}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-ink">Request type
          <select className={field} name="requestType">
            <option value="export">Data access or export</option>
            <option value="rectify">Correction</option>
            <option value="restrict">Processing restriction</option>
            <option value="anonymize">Erasure request</option>
          </select>
        </label>
        <label className="text-sm font-medium text-ink">Requester name
          <input className={field} name="requesterName" required maxLength={180} />
        </label>
        <label className="text-sm font-medium text-ink">Requester role
          <select className={field} name="requesterRole">
            <option value="guardian">Guardian</option>
            <option value="student">Student</option>
            <option value="representative">Representative</option>
            <option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm font-medium text-ink">Requester email
          <input className={field} name="requesterEmail" type="email" required maxLength={255} />
        </label>
        <label className="text-sm font-medium text-ink md:col-span-2">Request details
          <textarea className={`${field} min-h-24`} name="justification" required minLength={10} maxLength={2000} />
        </label>
        <div className="md:col-span-2">
          <Button type="submit" disabled={pending || !students.length} className="min-h-11">
            {pending ? "Recording..." : "Record request"}
          </Button>
        </div>
      </form>
      <div className="p-5">
        <h3 className="font-semibold text-ink">Request ledger</h3>
        <div className="mt-3 space-y-4">
          {data.requests.map(request => (
            <article key={request.id} className="rounded-control border border-line-subtle bg-surface p-4 shadow-subtle">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="font-semibold text-ink">{request.studentFirstName} {request.studentLastName} · {words(request.requestType)}</h4>
                  <p className="mt-1 text-xs text-secondary">{request.requesterName} ({words(request.requesterRole)}) · {request.requesterEmail}</p>
                  <p className="mt-1 text-xs text-muted">Recorded {new Date(request.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p>
                </div>
                <Badge tone={request.status === "completed" ? "green" : request.status === "rejected" ? "danger" : "amber"}>
                  {words(request.status)}
                </Badge>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm text-secondary">{request.justification}</p>
              {request.status !== "completed" && request.status !== "rejected" && (
                <div className="mt-4 space-y-3 border-t border-line-subtle pt-3">
                  {request.requestType === "anonymize" && (
                    <p className="text-sm text-warning font-medium">Erasure remains open until the school&apos;s retention and dependency review is complete.</p>
                  )}
                  <label className="block text-sm font-medium text-ink">Decision and action note
                    <textarea
                      className={`${field} min-h-20`}
                      value={notes[request.id] ?? ""}
                      onChange={event => setNotes(current => ({ ...current, [request.id]: event.target.value }))}
                      maxLength={2000}
                      placeholder="Record verification, decision and any action taken outside the app"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={pending || (notes[request.id] ?? "").trim().length < 10 || request.requestType === "anonymize"}
                      onClick={() => decide(request.id, "completed")}
                    >
                      Record completed decision
                    </Button>
                    <Button
                      type="button"
                      variant="danger"
                      disabled={pending || (notes[request.id] ?? "").trim().length < 10}
                      onClick={() => decide(request.id, "rejected")}
                    >
                      Record rejection
                    </Button>
                  </div>
                </div>
              )}
            </article>
          ))}
          {!data.requests.length && <p className="text-sm text-secondary">No privacy requests have been recorded for this school.</p>}
        </div>
      </div>
    </section>
  );
}
