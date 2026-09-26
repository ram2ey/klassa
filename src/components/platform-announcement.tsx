"use client";

import { useState, useTransition } from "react";
import { publishPlatformAnnouncementAction } from "@/app/actions/platform-announcement-actions";

export function PlatformAnnouncement() {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState("");
  return <section className="border border-slate-200 bg-white"><div className="border-b border-slate-200 p-5"><h2 className="font-bold">Platform announcement</h2><p className="mt-1 text-xs text-slate-500">Publish a maintenance notice to all current schools.</p></div>
    <form className="grid gap-3 p-5" onSubmit={event => { event.preventDefault(); const form = event.currentTarget;
      const fields = new FormData(form); start(async () => { try {
        const result = await publishPlatformAnnouncementAction({ title: String(fields.get("title")), content: String(fields.get("content")) });
        setMessage(`Published to ${result.schoolCount} schools.`); form.reset();
      } catch { setMessage("The announcement could not be published."); } });
    }}><label className="text-sm font-medium">Title<input name="title" required minLength={3} maxLength={200} className="mt-1 block min-h-11 w-full border border-slate-300 px-3" /></label>
      <label className="text-sm font-medium">Message<textarea name="content" required minLength={10} maxLength={5000} className="mt-1 block min-h-28 w-full border border-slate-300 p-3" /></label>
      <button disabled={pending} className="justify-self-start bg-blue-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">Publish to all schools</button>
      {message && <p role="status" className="text-sm">{message}</p>}</form></section>;
}
