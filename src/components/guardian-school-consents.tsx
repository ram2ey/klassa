"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGuardianSchoolConsentAction } from "@/app/actions/guardian-portal-actions";
import type { GuardianPortalData } from "@/lib/guardian-portal-data";

type Consent = GuardianPortalData["consents"][number];

export function GuardianSchoolConsents({ consents }: { consents: Consent[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  if (!consents.length) return null;

  function update(consent: Consent, kind: "media" | "excursion", granted: boolean) {
    setMessage(""); setError("");
    start(async () => {
      try {
        const result = await updateGuardianSchoolConsentAction({ guardianId: consent.guardianId,
          schoolId: consent.schoolId, kind, granted });
        if (!result.success) { setError(result.error); return; }
        setMessage(`${kind === "media" ? "Media" : "Excursion"} consent ${granted ? "granted" : "revoked"} for ${consent.schoolName}.`);
        router.refresh();
      } catch { setError("The consent choice could not be saved. Refresh and try again."); }
    });
  }

  return <section className="border border-slate-200 bg-white">
    <div className="border-b border-slate-200 p-5"><h2 className="font-bold">School consents</h2><p className="mt-1 text-sm text-slate-600">Set media and excursion permission for the students linked to each guardian profile. These choices apply at the named school.</p></div>
    {error && <p role="alert" className="mx-5 mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {message && <p role="status" className="mx-5 mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    <div className="divide-y divide-slate-100">{consents.map(consent => <div key={`${consent.schoolId}:${consent.guardianId}`} className="space-y-4 p-5">
      <div><h3 className="font-semibold">{consent.schoolName}</h3><p className="mt-1 text-sm text-slate-600">Guardian: {consent.guardianName} · Students: {consent.studentNames.join(", ")}</p></div>
      {([{"kind":"media","label":"Media","description":"School photos and videos"}, {"kind":"excursion","label":"Excursions","description":"School trips and excursions"}] as const).map(choice => {
        const granted = choice.kind === "media" ? consent.mediaConsent : consent.excursionConsent;
        return <div key={choice.kind} className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 p-3"><div><h4 className="text-sm font-semibold">{choice.label}</h4><p className="mt-1 text-xs text-slate-600">{choice.description}</p><p className={`mt-1 text-xs font-semibold ${granted ? "text-emerald-800" : "text-slate-600"}`}>{granted ? "Granted" : "Not granted"}</p></div><button type="button" disabled={pending} className="min-h-11 border border-blue-700 px-4 text-sm font-semibold text-blue-800 disabled:opacity-50" onClick={() => update(consent, choice.kind, !granted)}>{granted ? `Revoke ${choice.label.toLowerCase()}` : `Grant ${choice.label.toLowerCase()}`}</button></div>;
      })}
    </div>)}</div>
  </section>;
}
