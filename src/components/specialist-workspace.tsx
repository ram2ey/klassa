"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountSignOut } from "@/components/account-sign-out";
import { saveSchoolWorkflowAction } from "@/app/actions/school-workflow-actions";
import type { SpecialistData } from "@/lib/specialist-data";
import type { WorkflowCommand } from "@/lib/school-workflow-policy";
import type { announcements } from "@/db/schema";
import { formatGMTDateTime } from "@/lib/timezone";

const input = "mt-1 block min-h-11 w-full border border-slate-300 bg-white px-3 py-2 text-sm";
const primary = "min-h-11 bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";
const secondary = "min-h-11 border border-slate-300 bg-white px-4 py-2 text-sm font-semibold disabled:opacity-50";
const words = (value: string) => value.replaceAll("_", " ").replace(/\b\w/g, letter => letter.toUpperCase());
const value = (form: FormData, name: string) => String(form.get(name) ?? "");

function Select({ name, label, options, initial }: { name: string; label: string; options: { id: string; name: string }[]; initial?: string }) {
  return <label className="block text-sm font-medium">{label}<select className={input} name={name} required defaultValue={initial ?? ""}>
    <option value="">Choose {label.toLowerCase()}</option>{options.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
  </select></label>;
}
function Field({ name, label, type = "text", initial }: { name: string; label: string; type?: string; initial?: string }) {
  return <label className="block text-sm font-medium">{label}<input className={input} name={name} type={type} defaultValue={initial} required /></label>;
}
function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-4 border border-slate-200 bg-white p-5"><h2 className="text-lg font-bold">{title}</h2>{children}</section>;
}

export function SpecialistWorkspace({ data, notices, section }: { data: SpecialistData; notices: (typeof announcements.$inferSelect)[]; section: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [revealed, setRevealed] = useState<{ caseId: string; notes: string[] } | null>(null);
  const isDsl = data.actor.role === "safeguarding_lead";
  const roleName = data.actor.role === "safeguarding_lead" ? "Safeguarding lead" : data.actor.role === "senco" ? "SENCO" : "School nurse";
  const tabs = [{ id: "overview", label: "Overview" }, { id: "cases", label: "Cases" },
    { id: "directives", label: "Staff directives" }, ...(isDsl ? [{ id: "court", label: "Court restrictions" }] : []),
    { id: "notices", label: "Notices" }];
  const current = tabs.find(tab => tab.id === section) ?? tabs[0];
  const studentName = (id: string) => { const student = data.students.find(row => row.id === id); return student ? `${student.firstName} ${student.lastName}` : "Student"; };
  const studentOptions = data.students.map(student => ({ id: student.id, name: `${student.firstName} ${student.lastName} (${student.studentNumber})` }));
  const caseOptions = data.cases.map(row => ({ id: row.id, name: `${row.caseNumber} · ${studentName(row.studentId)}` }));
  const save = (command: WorkflowCommand) => start(async () => {
    setMessage(""); setRevealed(null);
    const result = await saveSchoolWorkflowAction(command);
    setMessage(result.success ? "Saved successfully." : result.error);
    if (result.success) {
      if (command.kind === "sensitive_access") setRevealed({ caseId: command.caseId, notes: result.notes ?? [] });
      router.refresh();
    }
  });
  const submit = (event: React.FormEvent<HTMLFormElement>, make: (form: FormData) => WorkflowCommand) => {
    event.preventDefault(); save(make(new FormData(event.currentTarget)));
  };

  return <div className="min-h-screen bg-slate-50 text-slate-900 lg:grid lg:grid-cols-[230px_minmax(0,1fr)]">
    <a href="#specialist-content" className="sr-only focus:not-sr-only focus:fixed focus:z-50 focus:bg-white focus:p-3">Skip to content</a>
    <aside className="bg-slate-950 p-5 text-white lg:sticky lg:top-0 lg:h-screen"><Link href="/" className="text-lg font-bold">Klassa</Link><p className="mt-1 text-xs text-slate-300">{roleName} workspace</p>
      <nav aria-label="Specialist navigation" className="mt-8 flex gap-2 overflow-x-auto lg:flex-col">{tabs.map(tab => <Link key={tab.id} href={`/?section=${tab.id}`}
        aria-current={current.id === tab.id ? "page" : undefined} className={`min-h-11 shrink-0 px-3 py-3 text-sm ${current.id === tab.id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-white/10"}`}>{tab.label}</Link>)}</nav>
      <Link href="/schools" className="mt-6 inline-flex min-h-11 items-center text-xs text-blue-300">Switch school</Link>
    </aside>
    <div className="min-w-0"><header className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-wide text-blue-700">{roleName}</p><p className="font-bold">{data.school.name}</p></div><AccountSignOut /></header>
      <main id="specialist-content" className="mx-auto max-w-6xl space-y-6 p-4 sm:p-8"><div><h1 className="text-2xl font-bold">{current.label}</h1><p className="mt-1 text-sm text-slate-600">{data.actor.name} · {data.areas.map(words).join(", ")}</p></div>
        {message && <p role="status" className="border border-blue-200 bg-blue-50 p-3 text-sm text-blue-950">{message}</p>}
        {current.id === "overview" && <><div className="grid gap-4 sm:grid-cols-3">{[
          { label: "Open cases", value: data.cases.filter(row => row.status === "open").length, href: "cases" },
          { label: "Under review", value: data.cases.filter(row => row.status === "under_review").length, href: "cases" },
          { label: "Active directives", value: data.alerts.filter(row => row.isActive && (!row.expiresAt || row.expiresAt > new Date())).length, href: "directives" },
        ].map(item => <Link key={item.label} href={`/?section=${item.href}`} className="border border-slate-200 bg-white p-5"><p className="text-xs uppercase text-slate-500">{item.label}</p><p className="mt-2 text-3xl font-bold">{item.value}</p></Link>)}</div>
          <Box title="Recent cases">{data.cases.slice(0, 8).map(row => <p key={row.id} className="border-b border-slate-100 py-2 text-sm"><strong>{row.caseNumber}</strong> · {studentName(row.studentId)} · {words(row.area)} · {words(row.status)}</p>)}{!data.cases.length && <p className="text-sm text-slate-500">No cases in your permitted areas.</p>}</Box>
          {isDsl && <Box title="Enforced court restrictions"><p className="text-sm">{data.restrictions.filter(row => row.isEnforced).length} restrictions are currently marked enforced. Review dates and details before relying on an order.</p><Link href="/?section=court" className="inline-flex min-h-11 items-center font-semibold text-blue-700 underline">Review restrictions</Link></Box>}</>}
        {current.id === "cases" && <><Box title="Create case"><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_case", studentId: value(form, "studentId"), caseNumber: value(form, "caseNumber"), area: value(form, "area") as SpecialistData["areas"][number], confidentialityTier: value(form, "tier") as "confidential", title: value(form, "title") }))}>
          <Select name="studentId" label="Student" options={studentOptions} /><Field name="caseNumber" label="Case number" /><Select name="area" label="Case area" options={data.areas.map(area => ({ id: area, name: words(area) }))} /><Select name="tier" label="Confidentiality" options={["standard_sensitive", "confidential", "strictly_confidential"].map(item => ({ id: item, name: words(item) }))} /><Field name="title" label="Case title" /><button className={primary} disabled={pending || !data.students.length}>Create case</button>
        </form></Box><Box title="Case register"><div className="space-y-4">{data.cases.map(row => <article key={row.id} className="space-y-4 border border-slate-200 p-4"><div><h3 className="font-bold">{row.caseNumber} · {row.title}</h3><p className="text-sm text-slate-600">{studentName(row.studentId)} · {words(row.area)} · {words(row.status)} · {data.notes.filter(note => note.caseId === row.id).length} encrypted notes</p></div>
          <form className="space-y-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_note", caseId: row.id, note: value(form, "note") }))}><label className="block text-sm font-medium">Add encrypted note<textarea name="note" className={`${input} min-h-24`} required /></label><button className={secondary} disabled={pending}>Add note</button></form>
          <form className="flex flex-wrap items-end gap-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_access", caseId: row.id, accessReason: value(form, "reason") }))}><div className="min-w-60 flex-1"><Field name="reason" label="Reason for viewing notes" /></div><button className={secondary} disabled={pending}>Open notes</button></form>
          {revealed?.caseId === row.id && <div className="border border-amber-200 bg-amber-50 p-3"><div className="flex justify-between gap-3"><strong>Decrypted notes</strong><button className="underline" onClick={() => setRevealed(null)}>Close</button></div>{revealed.notes.map((note, index) => <p className="mt-2 whitespace-pre-wrap text-sm" key={index}>{note}</p>)}{!revealed.notes.length && <p className="mt-2 text-sm">No notes.</p>}</div>}
          <form className="flex flex-wrap items-end gap-2" onSubmit={event => submit(event, form => ({ kind: "sensitive_case_status", caseId: row.id, status: value(form, "status") as "open", reason: value(form, "reason") }))}><Select name="status" label="Status" initial={row.status} options={["open", "under_review", "monitoring", "closed"].map(item => ({ id: item, name: words(item) }))} /><Field name="reason" label="Reason for change" /><button className={secondary} disabled={pending}>Update status</button></form>
        </article>)}{!data.cases.length && <p className="text-sm text-slate-500">No cases yet.</p>}</div></Box>
          <Box title="Recent case access">{data.accessLogs.map(log => <p key={log.id} className="border-b border-slate-100 py-2 text-sm">{data.cases.find(row => row.id === log.caseId)?.caseNumber ?? "Case"} · {log.accessReason} · {formatGMTDateTime(log.accessedAt)}</p>)}{!data.accessLogs.length && <p className="text-sm text-slate-500">No access recorded yet.</p>}</Box></>}
        {current.id === "directives" && <><Box title="Create staff directive"><p className="text-sm text-slate-600">Write only the action staff need to take. Case notes remain restricted.</p><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => { const caseId = value(form, "caseId"); return { kind: "need_to_know", caseId, studentId: data.cases.find(row => row.id === caseId)?.studentId ?? "", category: value(form, "category"), severity: value(form, "severity") as "routine", directiveSummary: value(form, "summary"), actionRequired: value(form, "action") }; })}>
          <Select name="caseId" label="Case" options={caseOptions} /><Field name="category" label="Category" /><Select name="severity" label="Severity" options={["routine", "urgent", "critical"].map(item => ({ id: item, name: words(item) }))} /><Field name="summary" label="Short directive" /><label className="block text-sm font-medium sm:col-span-2">Action required<textarea name="action" className={`${input} min-h-24`} required /></label><button className={primary} disabled={pending || !data.cases.length}>Create directive</button>
        </form></Box><Box title="Directives">{data.alerts.map(alert => <article key={alert.id} className="flex flex-wrap justify-between gap-3 border-b border-slate-100 py-3 text-sm"><div><strong>{studentName(alert.studentId)} · {alert.directiveSummary}</strong><p className="mt-1 whitespace-pre-wrap">{alert.actionRequired}</p><p className="mt-1 text-xs text-slate-500">{words(alert.severity)} · {alert.isActive ? "Active" : "Resolved"}</p></div>{alert.isActive && <button className={secondary} disabled={pending} onClick={() => { const reason = window.prompt("Reason for resolving this directive"); if (reason) save({ kind: "need_to_know_resolve", alertId: alert.id, reason }); }}>Resolve</button>}</article>)}{!data.alerts.length && <p className="text-sm text-slate-500">No directives for your cases.</p>}</Box></>}
        {current.id === "court" && isDsl && <><Box title="Record court restriction"><form className="grid gap-3 sm:grid-cols-2" onSubmit={event => submit(event, form => ({ kind: "court_restriction", studentId: value(form, "studentId"), restrictedPersonName: value(form, "person"), orderType: value(form, "orderType") as "restraining_order", docketNumber: value(form, "docket"), issuingCourt: value(form, "court"), summary: value(form, "summary"), effectiveDate: value(form, "effectiveDate"), expirationDate: value(form, "expirationDate"), prohibitPickup: form.has("pickup"), prohibitDisclosure: form.has("disclosure"), prohibitDirectContact: form.has("contact") }))}>
          <Select name="studentId" label="Student" options={studentOptions} /><Field name="person" label="Restricted person" /><Select name="orderType" label="Order type" options={["restraining_order", "custody_restriction", "prohibited_contact", "non_disclosure"].map(item => ({ id: item, name: words(item) }))} /><Field name="docket" label="Docket number" /><Field name="court" label="Issuing court" /><Field name="effectiveDate" label="Effective date" type="date" /><label className="block text-sm font-medium">Expiration date (optional)<input className={input} name="expirationDate" type="date" /></label><label className="block text-sm font-medium sm:col-span-2">Order summary<textarea name="summary" className={`${input} min-h-24`} required /></label><div className="flex flex-wrap gap-4 text-sm sm:col-span-2"><label><input name="pickup" type="checkbox" defaultChecked /> Prohibit pickup</label><label><input name="disclosure" type="checkbox" defaultChecked /> Prohibit disclosure</label><label><input name="contact" type="checkbox" defaultChecked /> Prohibit contact</label></div><button className={primary} disabled={pending || !data.students.length}>Record restriction</button>
        </form></Box><Box title="Court restrictions">{data.restrictions.map(row => <article key={row.id} className="flex flex-wrap justify-between gap-3 border-b border-slate-100 py-3 text-sm"><div><strong>{studentName(row.studentId)} · {row.restrictedPersonName}</strong><p>{words(row.orderType)} · {row.issuingCourt} · {row.docketNumber}</p><p className="mt-1 whitespace-pre-wrap">{row.summary}</p><p className="mt-1 text-xs text-slate-500">{row.isEnforced ? "Enforced" : "Inactive"} · {row.effectiveDate}{row.expirationDate ? ` to ${row.expirationDate}` : ""}</p></div><button className={secondary} disabled={pending} onClick={() => { const reason = window.prompt(`Reason to ${row.isEnforced ? "deactivate" : "reactivate"} this restriction`); if (reason) save({ kind: "court_restriction_status", restrictionId: row.id, isEnforced: !row.isEnforced, reason }); }}>{row.isEnforced ? "Deactivate" : "Reactivate"}</button></article>)}{!data.restrictions.length && <p className="text-sm text-slate-500">No court restrictions recorded.</p>}</Box></>}
        {current.id === "notices" && <Box title="School notices">{notices.map(row => <article key={row.id} className="border-b border-slate-100 py-3"><h3 className="font-semibold">{row.title}</h3><p className="mt-1 whitespace-pre-wrap text-sm">{row.content}</p></article>)}{!notices.length && <p className="text-sm text-slate-500">No published notices.</p>}</Box>}
      </main>
    </div>
  </div>;
}
