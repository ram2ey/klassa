"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { provisionGuardianPortalAccountAction } from "@/app/actions/guardian-portal-actions";
import { Button } from "@/components/ui/button";

export function GuardianPortalAccess({ guardianId, guardianName, enabled, eligible }: {
  guardianId: string; guardianName: string; enabled: boolean; eligible: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<{ tenantId: string; username: string; password: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  if (enabled) return <span className="inline-flex min-h-10 items-center border border-emerald-200 bg-emerald-50 px-3 text-xs font-medium text-emerald-800">Portal enabled</span>;
  if (!eligible) return <span title="Link this contact to a student with legal responsibility first." className="inline-flex min-h-10 items-center border border-slate-200 px-3 text-xs text-slate-500">Legal link required</span>;

  return <>
    <Button variant="secondary" className="min-h-10" onClick={() => { setError(""); setOpen(true); }}>Enable portal<span className="sr-only"> for {guardianName}</span></Button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/40 p-4" onMouseDown={event => { if (event.target === event.currentTarget && !pending && !created) { setOpen(false); setCreated(null); } }}>
      <section role="dialog" aria-modal="true" aria-labelledby="guardian-portal-title" className="w-full max-w-lg border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-200 p-5"><h2 id="guardian-portal-title" className="text-lg font-bold">Enable guardian portal</h2><p className="mt-1 text-sm text-slate-600">Create a sign-in for {guardianName}. Access is limited to linked students for whom this contact has legal responsibility.</p></div>
        {created ? <div className="space-y-4 p-5"><p role="status" className="text-sm font-semibold text-emerald-800">Portal account created. Share these sign-in details privately.</p><dl className="grid gap-3 border border-slate-200 bg-slate-50 p-4 text-sm"><div><dt className="text-slate-500">Tenant ID</dt><dd className="font-mono">{created.tenantId}</dd></div><div><dt className="text-slate-500">Username</dt><dd className="font-mono">{created.username}</dd></div><div><dt className="text-slate-500">Temporary password</dt><dd className="font-mono">{created.password}</dd></div></dl><p className="text-xs text-slate-600">The guardian must change this password after sign-in.</p><div className="flex justify-end"><Button className="min-h-11" onClick={() => { setOpen(false); setCreated(null); router.refresh(); }}>Done</Button></div></div> : <form className="space-y-4 p-5" onSubmit={event => {
          event.preventDefault(); setError(""); const form = new FormData(event.currentTarget);
          const password = String(form.get("temporaryPassword") ?? "");
          startTransition(async () => {
            try {
              const result = await provisionGuardianPortalAccountAction({ guardianId,
                username: String(form.get("username") ?? ""), temporaryPassword: password });
              if (!result.success) { setError(result.error); return; }
              setCreated({ tenantId: result.tenantId, username: result.username, password });
            } catch { setError("The portal account could not be created. Refresh the page and try again."); }
          });
        }}>
          <label className="block text-sm font-medium">Username<input name="username" required minLength={3} maxLength={64} autoCapitalize="none" spellCheck={false} className="mt-1.5 block min-h-11 w-full border border-slate-300 px-3" /></label>
          <label className="block text-sm font-medium">Temporary password<input name="temporaryPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className="mt-1.5 block min-h-11 w-full border border-slate-300 px-3" /><span className="mt-1 block text-xs font-normal text-slate-500">At least 12 characters. The guardian must change it after their first sign-in.</span></label>
          <p className="border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Share the tenant ID, username, and temporary password through a verified private channel. Klassa does not send guardian invitations yet.</p>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2"><Button type="button" variant="secondary" className="min-h-11" disabled={pending} onClick={() => { setOpen(false); setCreated(null); }}>Cancel</Button><Button type="submit" className="min-h-11" disabled={pending}>{pending ? "Creating…" : "Create portal account"}</Button></div>
        </form>}
      </section>
    </div>}
  </>;
}
