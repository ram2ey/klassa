"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { selectSchoolAction } from "@/app/actions/school-access-actions";
import { Button } from "@/components/ui/button";
import { AccountSignOut } from "@/components/account-sign-out";

export function SchoolSelector({ schools }: { schools: { id: string; name: string; role: string }[] }) {
  const [pending, startTransition] = useTransition(); const [error, setError] = useState(""); const router = useRouter();
  return <main className="mx-auto max-w-xl space-y-5 p-6"><header className="flex items-center justify-between gap-3"><h1 className="text-2xl font-bold">Choose your school</h1><AccountSignOut /></header>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {!schools.length && <p>No school memberships yet. Open the SMS invitation sent by your administrator.</p>}
    {schools.map(school => <section key={school.id} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-4">
      <div><h2 className="font-semibold">{school.name}</h2><p className="text-sm text-slate-600">{school.role.replaceAll("_", " ")}</p></div>
      <Button disabled={pending} onClick={() => startTransition(async () => {
        setError(""); try { await selectSchoolAction(school.id); router.replace("/"); router.refresh(); }
        catch { setError("Unable to open that school. Your membership may have changed."); }
      })}>Open school</Button>
    </section>)}
  </main>;
}
