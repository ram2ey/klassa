"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AccountSignOut } from "@/components/account-sign-out";
import { reactivatePlatformSchoolAction, suspendPlatformSchoolAction, updatePlatformSchoolAction } from "@/app/actions/platform-school-actions";
import type { getPlatformSchoolDetailData } from "@/lib/platform-school-data";
import { formatGMTDate, formatGMTDateTime, SCHOOL_TIME_ZONE_LABEL } from "@/lib/timezone";

type Data = NonNullable<Awaited<ReturnType<typeof getPlatformSchoolDetailData>>>;
const steps = [
  { key: "schoolAdmin", label: "Active school administrator", guidance: "Assign an active school administrator account." },
  { key: "academicYear", label: "Academic year", guidance: "Ask the school administrator to create an academic year." },
  { key: "safeguardingLead", label: "Active safeguarding lead", guidance: "Assign an active safeguarding lead account." },
  { key: "roster", label: "Student roster", guidance: "Ask the school administrator to enroll or import students." },
] as const;

export function PlatformSchoolDetail({ data }: { data: Data }) {
  const { school } = data;
  const [name, setName] = useState(school.name);
  const [reason, setReason] = useState("");
  const [suspendOpen, setSuspendOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const complete = steps.filter(step => data.setup[step.key]).length;

  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    startTransition(async () => {
      try {
        await updatePlatformSchoolAction({ organizationId: school.id, name });
        setMessage("School details saved."); router.refresh();
      } catch { setError("School details could not be saved. Check the name and retry."); }
    });
  }

  function suspend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setMessage("");
    startTransition(async () => {
      try {
        await suspendPlatformSchoolAction({ organizationId: school.id, reason });
        setSuspendOpen(false); setReason("");
        setMessage("School suspended. School accounts have been signed out."); router.refresh();
      } catch { setError("Suspension failed. Check that every account belongs only to this school, then retry."); }
    });
  }

  function reactivate() {
    if (!window.confirm(`Reactivate ${school.name}? School accounts will be able to sign in again.`)) return;
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        await reactivatePlatformSchoolAction(school.id);
        setMessage("School reactivated."); router.refresh();
      } catch { setError("School could not be reactivated. Check your connection and retry."); }
    });
  }

  return <div className="min-h-screen bg-slate-50 text-slate-900">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4 lg:px-8">
      <div><Link href="/platform" className="text-xs font-semibold text-blue-700 hover:underline">← Platform console</Link><p className="mt-1 text-sm font-bold">School details</p></div>
      <AccountSignOut />
    </header>
    <main className="mx-auto max-w-6xl space-y-6 p-5 lg:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><p className="text-xs font-semibold uppercase tracking-widest text-blue-700">{school.slug}</p><h1 className="mt-1 text-3xl font-bold">{school.name}</h1><p className="mt-2 text-sm text-slate-500">Created {formatGMTDate(school.createdAt)} · {SCHOOL_TIME_ZONE_LABEL}</p></div>
        <span className={`px-3 py-1.5 text-xs font-bold ${school.suspendedAt ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700"}`}>{school.suspendedAt ? "Suspended" : "Active"}</span>
      </div>
      {message && <p role="status" className="border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
      {!suspendOpen && error && <p role="alert" className="border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Staff accounts" value={data.staff.length} />
        <Metric label="Active sessions" value={data.staff.filter(member => member.hasActiveSession).length} />
        <Metric label="Setup complete" value={`${complete}/4`} />
        <Metric label="Students" value={data.studentCount} />
      </div>
      <section className="border border-slate-200 bg-white p-5"><h2 className="font-bold">School data portability</h2><p className="mt-1 text-sm text-slate-600">Download the school&apos;s records as JSON for a controlled tenant transfer. The file contains personal and sensitive records; store it securely.</p><a href={`/platform/schools/${school.id}/export`} className="mt-3 inline-flex min-h-11 items-center bg-blue-700 px-4 text-sm font-semibold text-white">Download school export</a></section>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="border border-slate-200 bg-white"><Heading title="School profile" description="The tenant ID remains fixed so existing login names keep working." />
          <form onSubmit={save} className="space-y-4 p-5"><label className="block text-sm font-semibold">School name<input required minLength={2} maxLength={180} value={name} onChange={event => setName(event.target.value)} className="mt-1 block h-10 w-full border border-slate-300 px-3 font-normal" /></label>
            <p className="text-xs text-slate-500">Timezone is fixed at {SCHOOL_TIME_ZONE_LABEL}.</p>
            <button disabled={pending} className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Save changes</button></form></section>
        <section className="border border-slate-200 bg-white"><Heading title="Access control" description="School suspension is reversible and recorded in the audit log." />
          <div className="space-y-4 p-5"><p className="text-sm text-slate-600">{school.suspendedAt ? `Suspended ${formatGMTDateTime(school.suspendedAt)}. School accounts cannot sign in.` : "Active school accounts can sign in. Suspension signs them out and blocks access until reactivation."}</p>
            {school.suspendedAt
              ? <button type="button" onClick={reactivate} disabled={pending} className="bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Reactivate school</button>
              : <button type="button" onClick={() => { setError(""); setSuspendOpen(true); }} disabled={pending} className="border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50">Suspend school</button>}</div></section>
      </div>
      <section className="border border-slate-200 bg-white"><Heading title="Setup follow-up" description={`${complete} of 4 tracked steps complete`} /><div className="grid gap-px bg-slate-200 sm:grid-cols-2">{steps.map(step => <div key={step.key} className="bg-white p-5"><p className="text-sm font-semibold">{data.setup[step.key] ? "✓" : "○"} {step.label}</p><p className="mt-1 text-xs text-slate-500">{data.setup[step.key] ? "Complete" : step.guidance}</p></div>)}</div></section>
      <section className="border border-slate-200 bg-white"><Heading title="Staff status" description="School membership and account status" /><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">Account</th><th className="px-5 py-3">Session</th></tr></thead><tbody>{data.staff.map(member => <tr key={member.userId} className="border-t border-slate-100"><td className="px-5 py-3"><p className="font-semibold">{member.name}</p><p className="text-xs text-slate-500">{member.username ?? "No login"}</p></td><td className="px-5 py-3 capitalize">{member.role.replaceAll("_", " ")}</td><td className="px-5 py-3">{member.suspendedAt ? "Suspended" : member.mustChangePassword ? "Password change due" : "Ready"}</td><td className="px-5 py-3">{member.hasActiveSession ? "Active" : "Offline"}</td></tr>)}</tbody></table>{!data.staff.length && <p className="p-5 text-sm text-slate-500">No staff accounts yet.</p>}</div></section>
      <section className="border border-slate-200 bg-white"><Heading title="Recent activity" description="Latest 15 audited events for this school" /><div className="divide-y divide-slate-100">{data.activity.map(event => <div key={event.id} className="flex flex-wrap justify-between gap-2 p-5 text-sm"><div><p className="font-semibold">{event.action}</p><p className="mt-1 text-xs text-slate-500">{event.actorName ?? "System"} · {event.entityType}</p></div><time className="text-xs text-slate-500">{formatGMTDateTime(event.createdAt)}</time></div>)}{!data.activity.length && <p className="p-5 text-sm text-slate-500">No audit events yet.</p>}</div></section>
    </main>
    {suspendOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="suspend-school-title" className="w-full max-w-md bg-white p-6 shadow-xl"><h2 id="suspend-school-title" className="text-lg font-bold">Suspend {school.name}</h2><p className="mt-2 text-sm text-slate-600">School accounts will be signed out and blocked from signing in. Enter a reason for the audit log.</p><form onSubmit={suspend} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Reason<textarea autoFocus required minLength={8} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 block min-h-24 w-full border border-slate-300 p-3 font-normal" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => { setSuspendOpen(false); setReason(""); setError(""); }} className="border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={pending} className="bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Suspending…" : "Suspend school"}</button></div></form></div></div>}
  </div>;
}

function Heading({ title, description }: { title: string; description: string }) { return <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs text-slate-500">{description}</p></div>; }
function Metric({ label, value }: { label: string; value: number | string }) { return <div className="border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></div>; }
