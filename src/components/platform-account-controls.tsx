"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetStaffPasswordAction, revokeStaffSessionsAction } from "@/app/actions/platform-account-actions";

type Props = { userId: string; organizationId: string; name: string; hasActiveSession: boolean };

export function PlatformAccountControls({ userId, organizationId, name, hasActiveSession }: Props) {
  const [resetOpen, setResetOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function revoke() {
    if (!window.confirm(`Sign ${name} out of every session?`)) return;
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        const result = await revokeStaffSessionsAction({ userId, organizationId });
        setMessage(result.revokedCount ? `${result.revokedCount} session${result.revokedCount === 1 ? "" : "s"} revoked.` : "No active sessions remained.");
        router.refresh();
      } catch {
        setError("Sessions could not be revoked. Check your connection and retry.");
      }
    });
  }

  function reset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    startTransition(async () => {
      try {
        await resetStaffPasswordAction({ userId, organizationId, temporaryPassword });
        setTemporaryPassword("");
        setResetOpen(false);
        setMessage("Password reset. All sessions were revoked. Share the temporary password securely.");
        router.refresh();
      } catch {
        setError("Password could not be reset. Check the account and retry.");
      }
    });
  }

  return <>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={revoke} disabled={pending || !hasActiveSession} className="border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Revoke sessions</button>
      <button type="button" onClick={() => { setError(""); setResetOpen(true); }} disabled={pending} className="border border-slate-300 px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40">Reset password</button>
    </div>
    {message && <p role="status" className="mt-2 max-w-64 text-xs text-emerald-700">{message}</p>}
    {!resetOpen && error && <p role="alert" className="mt-2 max-w-64 text-xs text-red-700">{error}</p>}
    {resetOpen && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={`reset-title-${userId}`} className="w-full max-w-md bg-white p-6 text-slate-900 shadow-xl">
        <h2 id={`reset-title-${userId}`} className="text-lg font-bold">Reset {name}&apos;s password</h2>
        <p className="mt-2 text-sm text-slate-600">This signs the user out everywhere. They must change the temporary password at next sign-in.</p>
        <form onSubmit={reset} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">New temporary password
            <input autoFocus type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={temporaryPassword} onChange={event => setTemporaryPassword(event.target.value)} className="mt-1 block h-10 w-full border border-slate-300 px-3 font-normal" />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2">
            <button type="button" disabled={pending} onClick={() => { setResetOpen(false); setTemporaryPassword(""); setError(""); }} className="border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={pending} className="bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{pending ? "Resetting…" : "Reset password"}</button>
          </div>
        </form>
      </div>
    </div>}
  </>;
}
