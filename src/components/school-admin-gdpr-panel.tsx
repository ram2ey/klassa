"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchoolGdprRequestAction, decideSchoolGdprRequestAction } from "@/app/actions/school-gdpr-actions";
import type { SchoolGdprData } from "@/lib/school-gdpr-data";
import type { SchoolAdminData } from "@/lib/school-admin-data";

const field = "mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm";
const button = "min-h-11 border border-blue-700 px-4 py-2 text-sm font-semibold text-blue-800 disabled:opacity-50";
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
        const result = await createSchoolGdprRequestAction({ studentId: String(values.get("studentId") ?? ""),
          requestType: String(values.get("requestType") ?? "export") as "export",
          requesterName: String(values.get("requesterName") ?? ""),
          requesterRole: String(values.get("requesterRole") ?? "guardian") as "guardian",
          requesterEmail: String(values.get("requesterEmail") ?? ""),
          justification: String(values.get("justification") ?? "") });
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

  return <section className="border border-slate-200 bg-white">
    <div className="border-b border-slate-200 p-5"><h2 className="font-bold">Privacy requests</h2><p className="mt-1 text-sm text-slate-600">Record a request and the administrator&apos;s decision. Complete any record correction or disclosure through the school&apos;s verified process, then describe what was done in the decision note.</p></div>
    {error && <p role="alert" className="mx-5 mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mx-5 mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <form className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-2" onSubmit={create}>
      <h3 className="font-semibold md:col-span-2">Record a request</h3>
      <label className="text-sm font-medium">Pupil<select className={field} name="studentId" required>{students.map(student => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.studentNumber}</option>)}</select></label>
      <label className="text-sm font-medium">Request type<select className={field} name="requestType"><option value="export">Data access or export</option><option value="rectify">Correction</option><option value="restrict">Processing restriction</option><option value="anonymize">Erasure request</option></select></label>
      <label className="text-sm font-medium">Requester name<input className={field} name="requesterName" required maxLength={180} /></label>
      <label className="text-sm font-medium">Requester role<select className={field} name="requesterRole"><option value="guardian">Guardian</option><option value="student">Student</option><option value="representative">Representative</option><option value="other">Other</option></select></label>
      <label className="text-sm font-medium">Requester email<input className={field} name="requesterEmail" type="email" required maxLength={255} /></label>
      <label className="text-sm font-medium md:col-span-2">Request details<textarea className={`${field} min-h-24`} name="justification" required minLength={10} maxLength={2000} /></label>
      <button className={`${button} justify-self-start`} disabled={pending || !students.length}>Record request</button>
    </form>
    <div className="p-5"><h3 className="font-semibold">Request ledger</h3><div className="mt-3 space-y-4">{data.requests.map(request => <article key={request.id} className="border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{request.studentFirstName} {request.studentLastName} · {words(request.requestType)}</h4><p className="mt-1 text-xs text-slate-600">{request.requesterName} ({words(request.requesterRole)}) · {request.requesterEmail}</p><p className="mt-1 text-xs text-slate-500">Recorded {new Date(request.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p></div><span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold">{words(request.status)}</span></div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{request.justification}</p>
      {request.status !== "completed" && request.status !== "rejected" && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
        {request.requestType === "anonymize" && <p className="text-sm text-amber-800">Erasure remains open until the school&apos;s retention and dependency review is complete.</p>}
        <label className="block text-sm font-medium">Decision and action note<textarea className={`${field} min-h-20`} value={notes[request.id] ?? ""} onChange={event => setNotes(current => ({ ...current, [request.id]: event.target.value }))} maxLength={2000} placeholder="Record verification, decision and any action taken outside the app" /></label>
        <div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={pending || (notes[request.id] ?? "").trim().length < 10 || request.requestType === "anonymize"} onClick={() => decide(request.id, "completed")}>Record completed decision</button><button type="button" className={button} disabled={pending || (notes[request.id] ?? "").trim().length < 10} onClick={() => decide(request.id, "rejected")}>Record rejection</button></div>
      </div>}
    </article>)}{!data.requests.length && <p className="text-sm text-slate-500">No privacy requests have been recorded for this school.</p>}</div></div>
  </section>;
}
