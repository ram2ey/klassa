"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { acknowledgePlatformIncidentAction, resolvePlatformIncidentAction } from "@/app/actions/platform-incident-actions";
import type { getPlatformIncidentData } from "@/lib/platform-incidents";
import { formatGMTDateTime } from "@/lib/timezone";

type Data = Awaited<ReturnType<typeof getPlatformIncidentData>>;
type Incident = Data["incidents"][number];

export function PlatformIncidentPanel({ data }: { data: Data }) {
  const [resolving, setResolving] = useState<Incident | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const active = data.incidents.filter(incident => !incident.resolvedAt);
  const resolved = data.incidents.filter(incident => !!incident.resolvedAt).slice(0, 20);

  function acknowledge(id: string) {
    setError("");
    startTransition(async () => {
      try { await acknowledgePlatformIncidentAction(id); router.refresh(); }
      catch { setError("Could not acknowledge the incident. Refresh and retry."); }
    });
  }

  function resolve(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!resolving) return;
    setError("");
    startTransition(async () => {
      try {
        await resolvePlatformIncidentAction({ id: resolving.id, note });
        setResolving(null); setNote(""); router.refresh();
      } catch { setError("Could not resolve the incident. Refresh and retry."); }
    });
  }

  function history(incidentId: string) {
    return data.events.filter(event => event.incidentId === incidentId).reverse();
  }

  return <div className="space-y-6">
    <section className="border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4"><div><h2 className="font-bold">Active incidents</h2><p className="mt-1 text-xs text-slate-500">Stored across restarts and app instances · {active.length} active</p></div><button type="button" onClick={() => router.refresh()} className="border border-slate-300 px-3 py-2 text-xs font-semibold">Refresh status</button></div>
      {error && !resolving && <p role="alert" className="m-5 border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {active.length ? <div className="divide-y divide-slate-100">{active.map(incident => <article key={incident.id} className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold">{incident.title}</h3><Status incident={incident} /></div><p className="mt-1 text-xs text-slate-500">{incident.code} · Opened {formatGMTDateTime(incident.triggeredAt)} · Last observed {formatGMTDateTime(incident.lastObservedAt)}</p></div><div className="flex gap-2">{!incident.acknowledgedAt && <button type="button" disabled={pending} onClick={() => acknowledge(incident.id)} className="border border-slate-300 px-3 py-2 text-xs font-semibold disabled:opacity-50">Acknowledge</button>}<button type="button" disabled={pending} onClick={() => { setError(""); setResolving(incident); }} className="border border-blue-300 px-3 py-2 text-xs font-semibold text-blue-700 disabled:opacity-50">Resolve</button></div></div>
        <p className="mt-3 text-sm text-slate-700">{incident.details}</p><EventHistory events={history(incident.id)} />
      </article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">No active incidents.</p>}
    </section>
    <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">Resolved history</h2><p className="mt-1 text-xs text-slate-500">Recent incident resolutions remain available after server restarts.</p></div>{resolved.length ? <div className="divide-y divide-slate-100">{resolved.map(incident => <article key={incident.id} className="p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-sm font-bold">{incident.title}</h3><p className="mt-1 text-xs text-slate-500">{incident.code} · Opened {formatGMTDateTime(incident.triggeredAt)}</p></div><span className="bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">Resolved {formatGMTDateTime(incident.resolvedAt!)}</span></div>{incident.resolutionNote && <p className="mt-3 text-sm text-slate-700">{incident.resolutionNote}</p>}<EventHistory events={history(incident.id)} /></article>)}</div> : <p className="p-8 text-center text-sm text-slate-500">No resolved incidents yet.</p>}</section>
    {resolving && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation"><div role="dialog" aria-modal="true" aria-labelledby="resolve-incident-title" className="w-full max-w-md bg-white p-6 shadow-xl"><h2 id="resolve-incident-title" className="text-lg font-bold">Resolve {resolving.title}</h2><p className="mt-2 text-sm text-slate-600">Record what was done. If the condition still exceeds its threshold, a new incident may open on the next health check.</p><form onSubmit={resolve} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Resolution note<textarea autoFocus required minLength={8} maxLength={500} value={note} onChange={event => setNote(event.target.value)} className="mt-1 block min-h-24 w-full border border-slate-300 p-3 font-normal" /></label>{error && <p role="alert" className="text-sm text-red-700">{error}</p>}<div className="flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => { setResolving(null); setNote(""); setError(""); }} className="border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button><button disabled={pending} className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Resolving…" : "Resolve incident"}</button></div></form></div></div>}
  </div>;
}

function Status({ incident }: { incident: Incident }) { return <><span className={`px-2 py-1 text-[11px] font-bold uppercase ${incident.severity === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-700"}`}>{incident.severity}</span>{incident.acknowledgedAt && <span className="bg-blue-50 px-2 py-1 text-[11px] font-semibold text-blue-700">Acknowledged</span>}</>; }
function EventHistory({ events }: { events: Data["events"] }) { return <div className="mt-4 border-t border-slate-100 pt-3"><p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">History</p><div className="mt-2 space-y-1">{events.map(event => <p key={event.id} className="text-xs text-slate-600">{formatGMTDateTime(event.createdAt)} · {event.action.replaceAll("_", " ")} · {event.actorName ?? "System"}{event.note ? ` · ${event.note}` : ""}</p>)}</div></div>; }
