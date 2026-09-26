"use client";

import { useState, useTransition } from "react";
import { searchPlatformGuardiansAction } from "@/app/actions/platform-guardian-actions";

type Results = Awaited<ReturnType<typeof searchPlatformGuardiansAction>>;

export function PlatformGuardianSearch() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>([]);
  const [searched, setSearched] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Find guardian accounts</h2><p className="mt-1 text-xs text-slate-500">Search across schools to help with account access.</p></div>
    <form className="flex flex-wrap gap-3 p-5" onSubmit={event => { event.preventDefault(); start(async () => {
      setError(""); try { setResults(await searchPlatformGuardiansAction(query)); setSearched(true); }
      catch { setError("Guardian search could not be completed."); }
    }); }}><label className="flex-1 text-sm font-medium">Name, email or phone<input className="mt-1 block min-h-11 w-full border border-slate-300 px-3" value={query} onChange={event => setQuery(event.target.value)} minLength={2} maxLength={100} required /></label><button className="self-end bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={pending}>Search</button></form>
    {error && <p role="alert" className="px-5 pb-4 text-sm text-red-700">{error}</p>}
    {searched && <div className="overflow-x-auto p-5 pt-0"><table className="w-full text-left text-sm"><thead><tr className="border-b"><th className="py-2">Guardian</th><th>School</th><th>Contact</th><th>Portal account</th><th>Linked students</th></tr></thead><tbody>{results.map(row => <tr key={row.id} className="border-b"><td className="py-3 font-medium">{row.firstName} {row.lastName}</td><td>{row.schoolName}</td><td>{row.email ?? row.phone ?? "—"}</td><td>{row.userId ? "Linked" : "Not linked"}</td><td>{row.linkedStudents}</td></tr>)}</tbody></table>{!results.length && <p className="py-4 text-sm text-slate-500">No guardians matched.</p>}</div>}
  </section>;
}
