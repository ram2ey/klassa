"use client";

import { useRef, useState, useTransition } from "react";
import { MessageSquare, Send } from "lucide-react";
import { countSmsSegments } from "@/lib/sms-segments";

type Scope = "whole_school" | "grade" | "class";
type Dispatch = { id: string; recipientName: string; recipientPhone: string; message: string; status: string; sentAt: Date | string };

export interface ParentSmsInput { scope: Scope; targetId: string; message: string }
export interface ParentSmsQueueInput extends ParentSmsInput { requestId: string }
interface Props {
  grades: Array<{ id: string; name: string }>;
  classes: Array<{ id: string; name: string; gradeLevelId?: string | null }>;
  dispatches?: Dispatch[];
  onPreview: (input: ParentSmsInput) => Promise<{ success: boolean; recipientCount?: number; unreachableCount?: number; error?: string }>;
  onQueue: (input: ParentSmsQueueInput) => Promise<{ success: boolean; queuedCount?: number; unreachableCount?: number; error?: string }>;
}

export function ParentSmsAnnouncements({ grades, classes, dispatches = [], onPreview, onQueue }: Props) {
  const [scope, setScope] = useState<Scope>("whole_school");
  const [targetId, setTargetId] = useState("all");
  const [message, setMessage] = useState("");
  const [preview, setPreview] = useState<{ recipientCount: number; unreachableCount: number } | null>(null);
  const [notice, setNotice] = useState<{ success: boolean; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const requestId = useRef<string | null>(null);
  const queueing = useRef(false);
  const input: ParentSmsInput = { scope, targetId: scope === "whole_school" ? "all" : targetId, message };
  const segments = countSmsSegments(message.trim());

  function review(event: React.FormEvent) {
    event.preventDefault();
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await onPreview(input);
        if (!result.success) { setPreview(null); setNotice({ success: false, text: result.error ?? "Could not review recipients." }); return; }
        setPreview({ recipientCount: result.recipientCount ?? 0, unreachableCount: result.unreachableCount ?? 0 });
        requestId.current ??= crypto.randomUUID();
      } catch {
        setPreview(null);
        setNotice({ success: false, text: "Could not review recipients. Please try again." });
      }
    });
  }

  function queue() {
    if (!preview || !requestId.current || queueing.current) return;
    queueing.current = true;
    const submission = { ...input, requestId: requestId.current };
    setNotice(null);
    startTransition(async () => {
      try {
        const result = await onQueue(submission);
        if (!result.success) { setNotice({ success: false, text: result.error ?? "The SMS could not be queued." }); return; }
        setNotice({ success: true, text: `${result.queuedCount ?? 0} parent message${result.queuedCount === 1 ? "" : "s"} queued. ${result.unreachableCount ?? 0} number${result.unreachableCount === 1 ? "" : "s"} skipped.` });
        setPreview(null);
        setMessage("");
        requestId.current = null;
      } catch {
        setNotice({ success: false, text: "Could not confirm queueing. Retry to check this announcement safely." });
      } finally { queueing.current = false; }
    });
  }

  function changeScope(value: Scope) {
    setScope(value);
    setTargetId(value === "grade" ? grades[0]?.id ?? "" : value === "class" ? classes[0]?.id ?? "" : "all");
    setPreview(null);
    requestId.current = null;
  }

  return <section className="space-y-5">
    <div className="border border-line bg-surface p-5">
      <div className="flex items-center gap-2"><MessageSquare className="h-5 w-5 text-primary"/><h2 className="text-lg font-bold text-ink">Parent SMS announcement</h2></div>
      <p className="mt-2 text-sm text-secondary">Send a staff-written notice to guardians with confirmed Ghanaian phone numbers. Keep private pupil details out of group messages.</p>
      {notice && <p role="status" className={`mt-4 border p-3 text-sm ${notice.success ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-rose-200 bg-rose-50 text-rose-900"}`}>{notice.text}</p>}
      <form className="mt-5 space-y-4" onSubmit={review}>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-medium">Recipients
            <select disabled={pending} className="mt-1 min-h-11 w-full border border-line bg-surface px-3" value={scope} onChange={event => changeScope(event.target.value as Scope)}>
              <option value="whole_school">Whole school</option><option value="grade">Grade</option><option value="class">Class</option>
            </select>
          </label>
          {scope !== "whole_school" && <label className="block text-sm font-medium">{scope === "grade" ? "Grade" : "Class"}
            <select disabled={pending} className="mt-1 min-h-11 w-full border border-line bg-surface px-3" value={targetId} required onChange={event => { setTargetId(event.target.value); setPreview(null); requestId.current = null; }}>
              {(scope === "grade" ? grades : classes).map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </label>}
        </div>
        <label className="block text-sm font-medium">Message
          <textarea disabled={pending} className="mt-1 min-h-28 w-full border border-line p-3" maxLength={320} minLength={5} required value={message} onChange={event => { setMessage(event.target.value); setPreview(null); requestId.current = null; }}/>
        </label>
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-muted"><span>{message.length}/320 characters · {segments} SMS segment{segments === 1 ? "" : "s"}</span><button className="min-h-11 border border-line px-4 font-semibold text-ink disabled:opacity-50" disabled={pending || message.trim().length < 5 || (scope === "grade" && !grades.length) || (scope === "class" && !classes.length)}>Review recipients</button></div>
      </form>
      {preview && <div className="mt-4 border border-primary/20 bg-primary-subtle p-4 text-sm text-ink"><p><strong>{preview.recipientCount}</strong> reachable guardian numbers will receive this notice. <strong>{preview.unreachableCount}</strong> missing, unconfirmed, opted-out or restricted numbers will be skipped.</p><p className="mt-1 text-xs">Sending queues the messages for delivery. Delivery results appear below after the worker checks with mNotify.</p><button className="mt-3 inline-flex min-h-11 items-center gap-2 bg-primary px-4 font-semibold text-white disabled:opacity-50" disabled={pending || preview.recipientCount === 0} onClick={queue}><Send className="h-4 w-4"/>{pending ? "Queueing…" : `Queue ${preview.recipientCount} message${preview.recipientCount === 1 ? "" : "s"}`}</button></div>}
    </div>
    <div className="border border-line bg-surface p-5"><h3 className="font-semibold text-ink">Recent delivery status</h3>
      {dispatches.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[640px] text-left text-sm"><thead><tr className="border-b border-line text-xs text-muted"><th className="py-2 pr-3">Guardian</th><th className="py-2 pr-3">Phone</th><th className="py-2 pr-3">Status</th><th className="py-2">Queued</th></tr></thead><tbody>{dispatches.map(row => <tr key={row.id} className="border-b border-line-subtle"><td className="py-2 pr-3">{row.recipientName}</td><td className="py-2 pr-3">{row.recipientPhone}</td><td className="py-2 pr-3 capitalize">{row.status.replaceAll("_", " ")}</td><td className="py-2">{new Date(row.sentAt).toLocaleString("en-GH", { timeZone: "Etc/GMT" })} GMT</td></tr>)}</tbody></table></div> : <p className="mt-2 text-sm text-muted">No parent SMS has been queued.</p>}
    </div>
  </section>;
}
