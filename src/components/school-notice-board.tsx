import type { announcements } from "@/db/schema";

export function SchoolNoticeBoard({ notices }: { notices: (typeof announcements.$inferSelect)[] }) {
  if (!notices.length) return null;
  return <section className="mx-auto max-w-5xl space-y-3 p-5" aria-label="School announcements">
    <h2 className="text-lg font-bold">School announcements</h2>
    {notices.map(notice => <article key={notice.id} className="border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-semibold">{notice.title}</h3><span className="text-xs text-slate-500">{notice.priority}</span></div>
      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{notice.content}</p>
    </article>)}
  </section>;
}
