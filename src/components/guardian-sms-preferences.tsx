"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateGuardianSmsPreferencesAction } from "@/app/actions/guardian-portal-actions";
import { recordGuardianSmsPreferencesAction } from "@/app/actions/guardian-sms-preferences-actions";
import { Button } from "@/components/ui/button";

type Profile = { guardianId: string; schoolId: string; label: string; announcements: boolean };

export function GuardianSmsPreferences({ profiles, staff = false }: { profiles: Profile[]; staff?: boolean }) {
  const [selected, setSelected] = useState(profiles[0]?.guardianId ?? "");
  const [announcements, setAnnouncements] = useState(profiles[0]?.announcements ?? true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  if (!profiles.length) return null;

  return (
    <section className="rounded-card border border-line-subtle bg-surface p-6 shadow-card">
      <h2 className="text-lg font-bold text-ink">School announcement SMS preferences</h2>
      <p className="mt-1.5 text-sm text-secondary">Choose whether to receive routine school announcements by SMS. This setting applies to the selected school contact.</p>
      {staff && <p className="mt-1.5 text-sm text-secondary">Record the guardian&apos;s requested choice and how they confirmed it.</p>}
      <form className="mt-5 space-y-4" onSubmit={event => {
        event.preventDefault(); setError(""); setMessage("");
        const profile = profiles.find(item => item.guardianId === selected);
        if (!profile) return;
        const form = new FormData(event.currentTarget);
        start(async () => {
          try {
            const result = staff ? await recordGuardianSmsPreferencesAction({
              guardianId: selected,
              announcements,
              evidence: String(form.get("evidence") ?? ""),
            }) : await updateGuardianSmsPreferencesAction({
              guardianId: selected,
              schoolId: profile.schoolId,
              announcements,
            });
            if (!result.success) { setError(result.error); return; }
            setMessage("SMS preferences saved."); router.refresh();
          } catch { setError("SMS preferences could not be saved. Refresh and try again."); }
        });
      }}>
        <label className="block text-sm font-medium text-ink">{staff ? "Guardian" : "School contact"}
          <select value={selected} disabled={pending} required className="ui-field mt-1.5 w-full" onChange={event => {
            setSelected(event.target.value); setAnnouncements(profiles.find(item => item.guardianId === event.target.value)?.announcements ?? true);
            setError(""); setMessage("");
          }}>
            {profiles.map(profile => <option key={profile.guardianId} value={profile.guardianId}>{profile.label}</option>)}
          </select>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink cursor-pointer">
          <input type="checkbox" checked={announcements} disabled={pending} onChange={event => setAnnouncements(event.target.checked)} className="h-4 w-4 accent-primary" />
          Receive school announcement SMS
        </label>
        {staff && (
          <label className="block text-sm font-medium text-ink">Guardian confirmation
            <input key={selected} name="evidence" required minLength={8} maxLength={500} disabled={pending} placeholder="e.g. Requested by phone on 4 October" className="ui-field mt-1.5 w-full" />
          </label>
        )}
        {error && <p role="alert" className="rounded-control border border-danger/20 bg-danger-subtle p-3 text-sm text-danger">{error}</p>}
        {message && <p role="status" className="rounded-control border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
        <Button disabled={pending} className="min-h-11">{pending ? "Saving…" : "Save SMS preferences"}</Button>
      </form>
    </section>
  );
}
