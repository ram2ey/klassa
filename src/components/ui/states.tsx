import type { ReactNode } from "react";
import { AlertTriangle, CircleAlert, Inbox, LoaderCircle } from "lucide-react";

export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 px-6 py-12 text-center"><span className="rounded-control bg-primary-subtle p-3 text-selected"><Inbox size={24} aria-hidden="true" /></span><h3 className="text-base font-semibold text-ink">{title}</h3>{description && <p className="max-w-md text-sm text-secondary">{description}</p>}{action}</div>;
}
export function LoadingState({ label = "Loading records…" }: { label?: string }) {
  return <div role="status" className="flex items-center justify-center gap-3 p-8 text-sm text-secondary"><LoaderCircle size={20} aria-hidden="true" className="animate-spin motion-reduce:animate-none" />{label}</div>;
}
export function ErrorState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div role="alert" className="flex flex-wrap items-start gap-3 rounded-control border border-danger/20 bg-danger-subtle p-4 text-danger"><CircleAlert size={20} aria-hidden="true" className="shrink-0" /><div className="min-w-0 flex-1"><h3 className="text-sm font-semibold">{title}</h3>{description && <p className="mt-1 text-sm">{description}</p>}</div>{action}</div>;
}
export function WarningNotice({ children }: { children: ReactNode }) {
  return <div role="status" className="flex items-start gap-3 rounded-control border border-warning/20 bg-warning-subtle p-4 text-sm text-warning"><AlertTriangle size={20} aria-hidden="true" className="shrink-0" /><div><span className="font-semibold">Warning: </span>{children}</div></div>;
}
