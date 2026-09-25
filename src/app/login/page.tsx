"use client";

import { useState } from "react";
import { authClient as client } from "@/lib/auth-client";
import { loginUsername } from "@/lib/login-identity";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Login() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <main className="mx-auto max-w-md p-8 text-slate-900">
    <h1 className="text-2xl font-bold">Klassa sign in</h1>
    <p className="mt-2 text-sm text-slate-600">Staff and guardians: use the school tenant ID, username, and password provided to you.</p>
    <form className="mt-6 space-y-4" onSubmit={async event => {
      event.preventDefault(); setPending(true); setError("");
      const data = new FormData(event.currentTarget);
      try {
        if (twoFactor) {
          const result = useRecoveryCode
            ? await client.twoFactor.verifyBackupCode({ code: String(data.get("code")) })
            : await client.twoFactor.verifyTotp({ code: String(data.get("code")) });
          if (result.error) { setError(result.error.message ?? "Verification failed."); return; }
        } else {
          let username: string;
          try { username = loginUsername(String(data.get("tenantId")), String(data.get("username"))); }
          catch { setError("Enter a valid tenant ID and username supplied by your administrator."); return; }
          const result = await client.signIn.username({ username, password: String(data.get("password")) });
          if (result.error) { setError("Sign in failed. Check your tenant ID, username and password."); return; }
          if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) { setTwoFactor(true); return; }
        }
        router.replace("/"); router.refresh();
      } catch { setError("Sign in is unavailable. Contact your school administrator."); }
      finally { setPending(false); }
    }}>
      {twoFactor ? <label className="block text-sm">{useRecoveryCode ? "Recovery code" : "Authenticator code"}<input name="code" required autoComplete="one-time-code" inputMode={useRecoveryCode ? "text" : "numeric"} pattern={useRecoveryCode ? undefined : "[0-9]{6}"}
        className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label> : <>
        <label className="block text-sm">Tenant ID<input name="tenantId" required maxLength={80} autoCapitalize="none" spellCheck={false} placeholder="northfield" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
        <label className="block text-sm">Username<input name="username" required minLength={3} maxLength={64} autoComplete="username" autoCapitalize="none" spellCheck={false} placeholder="j.smith" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
        <label className="block text-sm">Password<input name="password" type="password" required autoComplete="current-password" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending}>{twoFactor ? "Verify" : "Sign in"}</Button>
      {twoFactor && <Button type="button" variant="ghost" disabled={pending} onClick={() => { setError(""); setUseRecoveryCode(!useRecoveryCode); }}>
        {useRecoveryCode ? "Use authenticator" : "Use a recovery code"}
      </Button>}
      <p className="text-xs text-slate-600">New staff and guardian accounts must change their temporary password after first sign-in. Platform administrators use tenant ID platform and an authenticator. Contact your school if you need help signing in.</p>
    </form>
  </main>;
}
