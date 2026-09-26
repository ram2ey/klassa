"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createSchoolGdprRequestAction, decideSchoolGdprRequestAction,
  generateSchoolGdprExtractAction } from "@/app/actions/school-gdpr-actions";
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
  const [decisionNotes, setDecisionNotes] = useState<Record<string, string>>({});

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

  function generate(requestId: string) {
    setError(""); setMessage("");
    start(async () => {
      try {
        const result = await generateSchoolGdprExtractAction(requestId);
        if (!result.success) { setError(result.error); return; }
        const url = URL.createObjectURL(new Blob([JSON.stringify(result.extract, null, 2)], { type: "application/json" }));
        const anchor = document.createElement("a");
        anchor.href = url; anchor.download = `student-data-${requestId}.json`; anchor.click();
        window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        setMessage("JSON extract generated. Review it and verify the requester before release."); router.refresh();
      } catch { setError("The data extract could not be generated. Refresh and try again."); }
    });
  }

  function decide(requestId: string, status: "completed" | "rejected") {
    setError(""); setMessage("");
    start(async () => {
      try {
        const result = await decideSchoolGdprRequestAction({ requestId, status, note: decisionNotes[requestId] ?? "" });
        if (!result.success) { setError(result.error); return; }
        setDecisionNotes(current => ({ ...current, [requestId]: "" }));
        setMessage(status === "completed" ? "Request marked fulfilled." : "Request marked rejected."); router.refresh();
      } catch { setError("The request decision could not be saved. Refresh and try again."); }
    });
  }

  return <section className="border border-slate-200 bg-white">
    <div className="border-b border-slate-200 p-5"><h2 className="font-bold">Data rights requests</h2><p className="mt-1 text-sm text-slate-600">Record requests and generate a student record extract for administrator review. Verify the requester and review third-party information before releasing any data.</p></div>
    {error && <p role="alert" className="mx-5 mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mx-5 mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <form className="grid gap-3 border-b border-slate-200 p-5 md:grid-cols-2" onSubmit={create}>
      <h3 className="font-semibold md:col-span-2">Record a request</h3>
      <label className="text-sm font-medium">Student<select className={field} name="studentId" required>{students.map(student => <option key={student.id} value={student.id}>{student.firstName} {student.lastName} · {student.studentNumber}</option>)}</select></label>
      <label className="text-sm font-medium">Request type<select className={field} name="requestType"><option value="export">Data access or export</option><option value="rectify">Rectification</option><option value="restrict">Processing restriction</option><option value="anonymize">Erasure request</option></select></label>
      <label className="text-sm font-medium">Requester name<input className={field} name="requesterName" required maxLength={180} /></label>
      <label className="text-sm font-medium">Requester role<select className={field} name="requesterRole"><option value="guardian">Guardian</option><option value="student">Student</option><option value="representative">Representative</option><option value="other">Other</option></select></label>
      <label className="text-sm font-medium">Requester email<input className={field} name="requesterEmail" type="email" required maxLength={255} /></label>
      <label className="text-sm font-medium md:col-span-2">Request details<textarea className={`${field} min-h-24`} name="justification" required minLength={10} maxLength={2000} /></label>
      <button className={`${button} justify-self-start`} disabled={pending || !students.length}>Record request</button>
    </form>
    <div className="p-5"><h3 className="font-semibold">Request ledger</h3><div className="mt-3 space-y-4">{data.requests.map(request => <article key={request.id} className="border border-slate-200 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h4 className="font-semibold">{request.studentFirstName} {request.studentLastName} · {words(request.requestType)}</h4><p className="mt-1 text-xs text-slate-600">{request.requesterName} ({words(request.requesterRole)}) · {request.requesterEmail}</p><p className="mt-1 text-xs text-slate-500">Recorded {new Date(request.createdAt).toLocaleDateString("en-GB", { timeZone: "UTC" })}</p></div><span className="border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-semibold">{words(request.status)}</span></div>
      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{request.justification}</p>
      {request.requestType === "export" && request.status !== "rejected" && <div className="mt-3"><button className={button} type="button" disabled={pending} onClick={() => generate(request.id)}>Generate JSON extract</button><p className="mt-1 text-xs text-slate-500">Includes student details, enrollment history, submitted attendance and published report results. Sensitive cases and third-party contacts are excluded.</p></div>}
      {request.status !== "completed" && request.status !== "rejected" && <div className="mt-4 space-y-2 border-t border-slate-100 pt-3"><label className="block text-sm font-medium">Decision note<textarea className={`${field} min-h-20`} value={decisionNotes[request.id] ?? ""} onChange={event => setDecisionNotes(current => ({ ...current, [request.id]: event.target.value }))} maxLength={2000} placeholder="Record verification, delivery, or rejection reason" /></label><div className="flex flex-wrap gap-2"><button type="button" className={button} disabled={pending || (decisionNotes[request.id] ?? "").trim().length < 10 || (request.requestType === "export" && !request.processedAt)} onClick={() => decide(request.id, "completed")}>Mark fulfilled</button><button type="button" className={button} disabled={pending || (decisionNotes[request.id] ?? "").trim().length < 10} onClick={() => decide(request.id, "rejected")}>Reject request</button></div></div>}
    </article>)}{!data.requests.length && <p className="text-sm text-slate-500">No data rights requests have been recorded for this school.</p>}</div></div>
  </section>;
}
