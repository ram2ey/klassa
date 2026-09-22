"use client";

import { useState } from "react";
import { authClient as client } from "@/lib/auth-client";
import { phoneNumberSchema } from "@/lib/phone";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function Login() {
  const [twoFactor, setTwoFactor] = useState(false);
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const [legacyEmail, setLegacyEmail] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <main className="mx-auto max-w-md p-8 text-slate-900">
    <h1 className="text-2xl font-bold">Klassa staff sign in</h1>
    <p className="mt-2 text-sm text-slate-600">Use your existing school account.</p>
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
          const parsed = phoneNumberSchema.safeParse(String(data.get("phone")));
          if (!legacyEmail && !parsed.success) { setError(parsed.error.issues[0].message); return; }
          const result = legacyEmail
            ? await client.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) })
            : await client.signIn.phoneNumber({ phoneNumber: parsed.success ? parsed.data : "", password: String(data.get("password")) });
          if (result.error) { setError(result.error.message ?? "Sign in failed."); return; }
          if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) { setTwoFactor(true); return; }
        }
        router.replace("/"); router.refresh();
      } catch { setError("Sign in is unavailable. Contact your school administrator."); }
      finally { setPending(false); }
    }}>
      {twoFactor ? <label className="block text-sm">{useRecoveryCode ? "Recovery code" : "Authenticator code"}<input name="code" required autoComplete="one-time-code" inputMode={useRecoveryCode ? "text" : "numeric"} pattern={useRecoveryCode ? undefined : "[0-9]{6}"}
        className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label> : <>
        {legacyEmail ? <label className="block text-sm">Existing account email<input name="email" type="email" required autoComplete="username" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
          : <label className="block text-sm">Mobile number<input name="phone" type="tel" required autoComplete="username" placeholder="+354 555 1234" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>}
        <label className="block text-sm">Password<input name="password" type="password" required autoComplete="current-password" className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending}>{twoFactor ? "Verify" : "Sign in"}</Button>
      <Button type="button" variant="ghost" disabled={pending} onClick={() => { setError(""); if (twoFactor) setUseRecoveryCode(!useRecoveryCode); else setLegacyEmail(!legacyEmail); }}>
        {twoFactor ? (useRecoveryCode ? "Use authenticator" : "Use a recovery code") : (legacyEmail ? "Use mobile number" : "Use an existing email account")}
      </Button>
      <p className="text-xs text-slate-600">New account? Open the invitation link sent to your mobile. Contact your administrator if you need help accessing your account.</p>
    </form>
  </main>;
}
