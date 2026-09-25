"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { changeTemporaryPasswordAction } from "@/app/actions/password-actions";
import { Button } from "@/components/ui/button";

const field = "mt-1 block w-full rounded border border-slate-300 px-3 py-2";

export function ChangeTemporaryPassword() {
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return <main className="mx-auto max-w-md p-8 text-slate-900">
    <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">First sign-in</p>
    <h1 className="mt-2 text-2xl font-bold">Choose your own password</h1>
    <p className="mt-2 text-sm text-slate-600">The password supplied by your administrator is temporary. Change it before continuing to your account.</p>
    <form className="mt-6 space-y-4" onSubmit={event => {
      event.preventDefault();
      const values = new FormData(event.currentTarget);
      setError("");
      startTransition(async () => {
        const result = await changeTemporaryPasswordAction({
          currentPassword: String(values.get("currentPassword")),
          newPassword: String(values.get("newPassword")),
          confirmation: String(values.get("confirmation")),
        });
        if (!result.success) { setError(result.error); return; }
        router.replace("/");
        router.refresh();
      });
    }}>
      <label className="block text-sm">Temporary password<input name="currentPassword" type="password" required autoComplete="current-password" className={field} /></label>
      <label className="block text-sm">New password<input name="newPassword" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={field} /></label>
      <label className="block text-sm">Confirm new password<input name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" className={field} /></label>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? "Changing password…" : "Change password"}</Button>
    </form>
  </main>;
}
