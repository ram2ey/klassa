"use client";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { AccountSignOut } from "@/components/account-sign-out";
import { useRouter } from "next/navigation";

export function MfaSetup() {
  const [setup, setSetup] = useState<{ secret: string; backupCodes: string[] } | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  return <main className="mx-auto max-w-lg space-y-5 p-6 text-slate-900">
    <header className="flex items-center justify-between gap-3"><h1 className="text-xl font-bold">Secure your account</h1><AccountSignOut /></header>
    <p className="text-sm text-slate-600">Add Klassa to your authenticator app. Platform administration remains locked until you verify the first code.</p>
    <form className="space-y-4 rounded border border-slate-200 bg-white p-5" onSubmit={async event => {
      event.preventDefault(); setPending(true); setError("");
      const data = new FormData(event.currentTarget);
      try {
        if (!setup) {
          const result = await authClient.twoFactor.enable({ password: String(data.get("password")) });
          if (result.error || !result.data) { setError(result.error?.message ?? "Unable to set up MFA."); return; }
          if (result.data.method !== "totp") { setError("Authenticator setup is unavailable."); return; }
          setSetup({ secret: new URL(result.data.totpURI).searchParams.get("secret") ?? "", backupCodes: result.data.backupCodes });
        } else {
          const result = await authClient.twoFactor.verifyTotp({ code: String(data.get("code")) });
          if (result.error) { setError(result.error.message ?? "Verification failed."); return; }
          setSetup(null); router.replace("/"); router.refresh();
        }
      } catch { setError("Unable to complete setup. Please retry."); } finally { setPending(false); }
    }}>
      {!setup ? <label className="block text-sm">Confirm your password<input type="password" name="password" autoComplete="current-password" required className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label> : <>
        <p className="text-sm">Choose “Enter setup key” in your authenticator, name the account Klassa, and use this key with time-based codes:</p>
        <code className="block break-all rounded bg-slate-100 p-3 text-sm select-all">{setup.secret}</code>
        <h2 className="font-semibold">Save your recovery codes</h2><p className="text-sm text-slate-600">Keep these somewhere private and separate from your phone. Each code works once.</p>
        <pre className="overflow-x-auto rounded bg-slate-100 p-3 text-sm">{setup.backupCodes.join("\n")}</pre>
        <label className="flex gap-2 text-sm"><input type="checkbox" required />I saved my recovery codes.</label>
        <label className="block text-sm">Authenticator code<input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required className="mt-1 block w-full rounded border border-slate-300 px-3 py-2" /></label>
      </>}
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending}>{setup ? "Verify and continue" : "Set up authenticator"}</Button>
    </form>
  </main>;
}
