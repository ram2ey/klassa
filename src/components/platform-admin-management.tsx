"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPlatformAdminAction, reactivatePlatformAdminAction, revokePlatformAdminSessionsAction, suspendPlatformAdminAction } from "@/app/actions/platform-admin-actions";
import type { getPlatformInvitationData } from "@/lib/school-invitations";

type Admin = Awaited<ReturnType<typeof getPlatformInvitationData>>["platformAdmins"][number];
type Props = { admins: Admin[]; currentUserId: string };
const field = "mt-1 block h-10 w-full border border-slate-300 bg-white px-3 text-sm";

export function PlatformAdminManagement({ admins, currentUserId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [suspendId, setSuspendId] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        const result = await createPlatformAdminAction({ name: String(values.get("name")),
          username: String(values.get("username")), temporaryPassword: String(values.get("temporaryPassword")) });
        form.reset();
        setMessage(`Platform administrator created. Login: ${result.tenantId} / ${result.username}. Share the temporary password privately.`);
        router.refresh();
      } catch {
        setError("Could not create the account. Check whether the username is already in use and retry.");
      }
    });
  }

  function suspend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!suspendId) return;
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        await suspendPlatformAdminAction({ userId: suspendId, reason });
        setSuspendId(null); setReason("");
        setMessage("Platform administrator suspended and all sessions revoked.");
        router.refresh();
      } catch {
        setError("Could not suspend this account. At least one active platform administrator must remain.");
      }
    });
  }

  function reactivate(userId: string, name: string) {
    if (!window.confirm(`Reactivate ${name}'s platform account?`)) return;
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        await reactivatePlatformAdminAction({ userId });
        setMessage("Platform administrator reactivated.");
        router.refresh();
      } catch {
        setError("Could not reactivate this account. Retry after checking your connection.");
      }
    });
  }

  function revoke(userId: string, name: string) {
    if (!window.confirm(`Sign ${name} out of every session?`)) return;
    setMessage(""); setError("");
    startTransition(async () => {
      try {
        const result = await revokePlatformAdminSessionsAction({ userId });
        setMessage(`${result.revokedCount} session${result.revokedCount === 1 ? "" : "s"} revoked.`);
        router.refresh();
      } catch {
        setError("Could not revoke these sessions. Retry after checking your connection.");
      }
    });
  }

  return <section className="border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4"><h3 className="font-bold">Platform administrators</h3>
      <p className="mt-1 text-xs text-slate-500">Maintain a backup administrator. Every new account must change its temporary password and enroll an authenticator.</p></div>
    {message && <p role="status" className="mx-5 mt-4 border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p>}
    {error && <p role="alert" className="mx-5 mt-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="divide-y divide-slate-100">{admins.map(admin => <div key={admin.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
      <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{admin.name}{admin.id === currentUserId ? " (you)" : ""}</p>
        <p className="mt-1 text-xs text-slate-500">Login: {admin.username?.replace(":", " / ") ?? "Unavailable"} · Added {new Date(admin.createdAt).toLocaleDateString()}</p></div>
      <span className={`px-2 py-1 text-xs font-semibold ${admin.suspendedAt ? "bg-red-50 text-red-700" : admin.mustChangePassword || !admin.twoFactorEnabled ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
        {admin.suspendedAt ? "Suspended" : admin.mustChangePassword ? "Password change due" : admin.twoFactorEnabled ? "MFA ready" : "MFA setup due"}</span>
      <button type="button" disabled={pending || !admin.hasActiveSession || admin.id === currentUserId} onClick={() => revoke(admin.id, admin.name)}
        className="border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-40">Revoke sessions</button>
      {admin.suspendedAt
        ? <button type="button" disabled={pending} onClick={() => reactivate(admin.id, admin.name)} className="border border-emerald-300 px-3 py-2 text-xs font-semibold text-emerald-700 disabled:opacity-40">Reactivate</button>
        : <button type="button" disabled={pending || admin.id === currentUserId || admins.filter(item => !item.suspendedAt).length <= 1}
            onClick={() => { setSuspendId(admin.id); setReason(""); setError(""); }} className="border border-red-300 px-3 py-2 text-xs font-semibold text-red-700 disabled:opacity-40">Suspend</button>}
    </div>)}</div>
    <form onSubmit={create} className="grid gap-4 border-t border-slate-200 bg-slate-50 p-5 sm:grid-cols-2">
      <div className="sm:col-span-2"><h4 className="text-sm font-bold">Add platform administrator</h4><p className="mt-1 text-xs text-slate-500">Share credentials through a private channel. Sign-in tenant ID is platform.</p></div>
      <label className="text-xs font-semibold">Full name<input name="name" required minLength={2} maxLength={180} className={field} /></label>
      <label className="text-xs font-semibold">Username<input name="username" required minLength={3} maxLength={64} pattern="[a-z0-9][a-z0-9._-]*" autoCapitalize="none" spellCheck={false} className={field} /></label>
      <label className="text-xs font-semibold sm:col-span-2">Temporary password<input name="temporaryPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={field} /></label>
      <div className="sm:col-span-2"><button type="submit" disabled={pending} className="bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Create administrator</button></div>
    </form>
    {suspendId && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="platform-admin-suspend-title" className="w-full max-w-md bg-white p-6 shadow-xl">
        <h3 id="platform-admin-suspend-title" className="text-lg font-bold">Suspend platform administrator</h3>
        <p className="mt-2 text-sm text-slate-600">This revokes every session. The reason is saved in the platform audit log.</p>
        <form onSubmit={suspend} className="mt-5 space-y-4"><label className="block text-sm font-semibold">Reason
          <textarea autoFocus required minLength={8} maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 block min-h-24 w-full border border-slate-300 p-3 font-normal" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => { setSuspendId(null); setReason(""); setError(""); }} className="border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="bg-red-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Suspend and revoke sessions</button></div></form>
      </div>
    </div>}
  </section>;
}
