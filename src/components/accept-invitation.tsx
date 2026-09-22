"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { acceptSchoolInvitationAction, inspectSchoolInvitationAction } from "@/app/actions/invitation-actions";
import { authClient } from "@/lib/auth-client";
import { phoneNumberSchema } from "@/lib/phone";
import { Button } from "@/components/ui/button";
import type { inspectSchoolInvitation } from "@/lib/school-invitations";

export function AcceptInvitation() {
  const token = useRef<string | null>(null);
  const [invitation, setInvitation] = useState<Awaited<ReturnType<typeof inspectSchoolInvitation>> | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [activated, setActivated] = useState(false);
  const router = useRouter();
  useEffect(() => {
    let cancelled = false;
    token.current ??= window.location.hash.slice(1);
    window.history.replaceState(null, "", window.location.pathname);
    inspectSchoolInvitationAction(token.current).then(result => {
      if (cancelled) return;
      if (result.success) setInvitation(result.invitation); else setError(result.error);
    }).catch(() => { if (!cancelled) setError("Unable to load the invitation. Reopen the SMS link and try again."); });
    return () => { cancelled = true; };
  }, []);
  return <main className="mx-auto max-w-lg space-y-5 p-6 text-slate-900">
    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Klassa · School invitation</p>
    <h1 className="text-2xl font-bold">Join your school</h1>
    {error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {!invitation && !error && <p role="status">Checking your invitation…</p>}
    {activated ? <p role="status">Your account is ready. <Link href="/login" className="text-blue-700 underline">Sign in to continue.</Link></p> : invitation && <>
      <div className="rounded border border-slate-200 bg-white p-4"><h2 className="font-bold">{invitation.schoolName}</h2>
        <p className="mt-1 text-sm text-slate-600">{invitation.role.replaceAll("_", " ")} · Invitation for {invitation.phoneHint}</p></div>
      {invitation.mode === "sign-in" ? <p className="text-sm">You already have a Klassa account. <Link href="/login" className="text-blue-700 underline">Sign in</Link>, then reopen this SMS link to add the school. Your existing password and authenticator will stay the same.</p> :
        <form className="space-y-4" onSubmit={async event => {
          event.preventDefault(); setPending(true); setError("");
          const data = new FormData(event.currentTarget);
          const phone = phoneNumberSchema.safeParse(String(data.get("phone")));
          if (!phone.success) { setError(phone.error.issues[0].message); setPending(false); return; }
          const password = invitation.mode === "new" ? String(data.get("password")) : undefined;
          try {
            const result = await acceptSchoolInvitationAction({ token: token.current ?? "", phoneNumber: phone.data,
              name: invitation.mode === "new" ? String(data.get("name")) : "Existing account", password });
            if (!result.success) { setError(result.error); return; }
            setActivated(true); token.current = null;
            if (!result.existingAccount && password) {
              const login = await authClient.signIn.phoneNumber({ phoneNumber: phone.data, password });
              if (login.error) { setError("Account created. Sign in to finish authenticator setup."); return; }
              router.replace("/setup-mfa");
            } else router.replace("/schools");
            router.refresh();
          } catch { setError("Unable to complete activation. Reopen the invitation or try signing in if your account was already created."); }
          finally { setPending(false); }
        }}>
          <label className="block text-sm">Your mobile number<input name="phone" type="tel" autoComplete="tel" placeholder="+354 555 1234" required className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
          {invitation.mode === "new" && <>
            <label className="block text-sm">Your name<input name="name" autoComplete="name" required minLength={2} maxLength={180} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
            <label className="block text-sm">Choose a password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /><span className="mt-1 block text-xs text-slate-500">At least 12 characters. Next, you’ll set up an authenticator app.</span></label>
          </>}
          <Button type="submit" disabled={pending}>{invitation.mode === "new" ? "Activate account" : "Accept school membership"}</Button>
        </form>}
    </>}
  </main>;
}
