"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { recordPlatformAccessReviewAction } from "@/app/actions/platform-access-review-actions";
import { PlatformAccountControls } from "@/components/platform-account-controls";
import type { getPlatformInvitationData } from "@/lib/school-invitations";
import { accessReviewState } from "@/lib/access-review-policy";

type Data = Awaited<ReturnType<typeof getPlatformInvitationData>>;
type Member = Data["memberships"][number];
type Filter = "all" | "dormant" | "no_record" | "review_due" | "password_due" | "suspended" | "follow_up";
const PAGE_SIZE = 25;

function ReviewControl({ member }: { member: Member }) {
  const [open, setOpen] = useState(false);
  const [decision, setDecision] = useState<"retain" | "follow_up">("retain");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    startTransition(async () => {
      try {
        await recordPlatformAccessReviewAction({ organizationId: member.organizationId,
          userId: member.userId, decision, note });
        setOpen(false); setNote("");
        router.refresh();
      } catch {
        setError("Could not save the review. Follow-up decisions need a reason of at least eight characters.");
      }
    });
  }
  return <>
    <button type="button" onClick={() => { setOpen(true); setError(""); }} className="border border-blue-300 px-2 py-1 text-xs font-semibold text-blue-700">Record review</button>
    {open && <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby={`review-title-${member.id}`} className="w-full max-w-md bg-white p-6 shadow-xl">
        <h3 id={`review-title-${member.id}`} className="text-lg font-bold">Review {member.name}&apos;s access</h3>
        <p className="mt-2 text-sm text-slate-600">Confirm the school role or flag it for follow-up. This decision is recorded in the audit log. Use the account controls to change access.</p>
        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block text-sm font-semibold">Decision<select value={decision} onChange={event => setDecision(event.target.value as typeof decision)} className="mt-1 block h-10 w-full border border-slate-300 px-3 font-normal">
            <option value="retain">Retain access</option><option value="follow_up">Follow up</option></select></label>
          <label className="block text-sm font-semibold">Note{decision === "follow_up" ? " (required)" : " (optional)"}
            <textarea value={note} onChange={event => setNote(event.target.value)} required={decision === "follow_up"} minLength={decision === "follow_up" ? 8 : undefined} maxLength={500}
              className="mt-1 block min-h-24 w-full border border-slate-300 p-3 font-normal" /></label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex justify-end gap-2"><button type="button" disabled={pending} onClick={() => { setOpen(false); setNote(""); }} className="border border-slate-300 px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={pending} className="bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40">Save review</button></div>
        </form>
      </div>
    </div>}
  </>;
}

export function PlatformAccessReviews({ data }: { data: Data }) {
  const [search, setSearch] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const now = data.loadedAt;
  const schoolNames = useMemo(() => new Map(data.schools.map(school => [school.id, school.name])), [data.schools]);
  const reviewerNames = useMemo(() => new Map(data.platformAdmins.map(admin => [admin.id, admin.name])), [data.platformAdmins]);
  const stats = data.memberships.filter(member => !schoolId || member.organizationId === schoolId)
    .map(member => ({ member, state: accessReviewState(member, now) }));
  const filtered = stats.filter(({ member, state }) => {
    if (search && !`${member.name} ${member.username ?? ""} ${member.role} ${schoolNames.get(member.organizationId) ?? ""}`.toLowerCase().includes(search.toLowerCase())) return false;
    return filter === "all" || (filter === "dormant" && state.dormant) || (filter === "no_record" && state.noRecord)
      || (filter === "review_due" && state.reviewDue) || (filter === "password_due" && member.mustChangePassword)
      || (filter === "suspended" && !!member.suspendedAt) || (filter === "follow_up" && member.accessReviewDecision === "follow_up");
  });
  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  return <section className="border border-slate-200 bg-white shadow-sm">
    <div className="border-b border-slate-200 px-5 py-4"><h2 className="font-bold">Staff access review</h2>
      <p className="mt-1 text-xs text-slate-500">Reviews are due every 90 days or after an access change. Dormant means no recorded sign-in for at least 90 days; older sign-ins may have no recorded date.</p></div>
    <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-3">
      <div><p className="text-xs font-semibold text-slate-500">Review due</p><p className="text-2xl font-bold">{stats.filter(item => item.state.reviewDue).length}</p></div>
      <div><p className="text-xs font-semibold text-slate-500">Dormant accounts</p><p className="text-2xl font-bold">{stats.filter(item => item.state.dormant).length}</p></div>
      <div><p className="text-xs font-semibold text-slate-500">No sign-in record</p><p className="text-2xl font-bold">{stats.filter(item => item.state.noRecord).length}</p></div>
    </div>
    <div className="flex flex-wrap gap-3 border-b border-slate-200 p-4">
      <label className="min-w-44 text-xs font-semibold">School<select value={schoolId} onChange={event => { setSchoolId(event.target.value); setPage(1); }} className="mt-1 block h-10 w-full border border-slate-300 px-3 font-normal">
        <option value="">All schools</option>{data.schools.map(school => <option key={school.id} value={school.id}>{school.name}</option>)}
      </select></label>
      <label className="min-w-52 flex-1 text-xs font-semibold">Search<input type="search" value={search} onChange={event => { setSearch(event.target.value); setPage(1); }} placeholder="Name, login, role or school" className="mt-1 block h-10 w-full border border-slate-300 px-3 font-normal" /></label>
      <label className="text-xs font-semibold">Show<select value={filter} onChange={event => { setFilter(event.target.value as Filter); setPage(1); }} className="mt-1 block h-10 w-full border border-slate-300 px-3 font-normal">
        <option value="all">All accounts</option><option value="review_due">Review due</option><option value="dormant">Dormant (90+ days)</option>
        <option value="no_record">No sign-in record</option><option value="password_due">Password change due</option><option value="follow_up">Follow-up flagged</option><option value="suspended">Suspended</option>
      </select></label>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-[10px] font-semibold uppercase tracking-wider text-slate-500"><tr>
      {["Account", "School / role", "Last sign-in", "Security", "Review", "Actions"].map(header => <th key={header} className="px-4 py-3">{header}</th>)}</tr></thead><tbody>
      {filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(({ member, state }) => <tr key={member.id} className="border-t border-slate-100 align-top">
        <td className="px-4 py-4"><p className="font-semibold">{member.name}</p><p className="mt-1 text-xs text-slate-500">{member.username?.replace(":", " / ") ?? "No login assigned"}</p></td>
        <td className="px-4 py-4"><p>{schoolNames.get(member.organizationId) ?? "Unknown school"}</p><p className="mt-1 text-xs text-slate-500">{member.role.replaceAll("_", " ")}</p></td>
        <td className="px-4 py-4">{member.lastSignedInAt ? <><time dateTime={new Date(member.lastSignedInAt).toISOString()}>{new Date(member.lastSignedInAt).toLocaleDateString()}</time>
          {state.dormant && <p className="mt-1 text-xs font-semibold text-amber-700">Dormant</p>}</> : <span className="text-slate-500">No recorded sign-in</span>}</td>
        <td className="px-4 py-4"><p>{member.suspendedAt ? "Suspended" : member.mustChangePassword ? "Password change due" : "Password ready"}</p>
          <p className="mt-1 text-xs text-slate-500">{member.hasActiveSession ? "Active session" : "No active session"}</p></td>
        <td className="px-4 py-4"><p className={state.reviewDue ? "font-semibold text-amber-700" : member.accessReviewDecision === "follow_up" ? "font-semibold text-red-700" : "font-semibold text-emerald-700"}>
          {state.reviewDue ? "Review due" : member.accessReviewDecision === "follow_up" ? "Follow-up" : "Retained"}</p>
          {member.accessReviewedAt && <p className="mt-1 text-xs text-slate-500">{new Date(member.accessReviewedAt).toLocaleDateString()} · {reviewerNames.get(member.accessReviewedBy ?? "") ?? "Former admin"}</p>}</td>
        <td className="px-4 py-4"><div className="flex flex-wrap gap-2"><ReviewControl member={member} />
          <PlatformAccountControls userId={member.userId} organizationId={member.organizationId} name={member.name} hasActiveSession={member.hasActiveSession} suspended={!!member.suspendedAt} /></div></td>
      </tr>)}</tbody></table></div>
    {!filtered.length && <p className="p-8 text-center text-sm text-slate-500">No accounts match this review.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4 text-xs"><span>{filtered.length} matching account{filtered.length === 1 ? "" : "s"}</span>
      <div className="flex items-center gap-2"><button disabled={safePage <= 1} onClick={() => setPage(safePage - 1)} className="border border-slate-300 px-3 py-2 disabled:opacity-40">Previous</button>
        <span>Page {safePage} of {pageCount}</span><button disabled={safePage >= pageCount} onClick={() => setPage(safePage + 1)} className="border border-slate-300 px-3 py-2 disabled:opacity-40">Next</button></div></div>
  </section>;
}
