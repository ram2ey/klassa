import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Check, Circle, ClipboardCheck, GraduationCap, School, Users } from "lucide-react";
import { Card, CardContent, CardHeader, PageHeading } from "./ui/card";
import { Button } from "./ui/button";
import { EmptyState } from "./ui/states";
import { Badge } from "./ui/badge";

export type OverviewAction = { label: string; description?: string; href?: string; onClick?: () => void };
export type OverviewModel = {
  description: string;
  metrics: { label: string; value: string | number; detail: string; icon: "students" | "classes" | "staff" | "attendance"; href?: string }[];
  attendance: { total: number; attended: number; absent: number; scope: string; href?: string; onClick?: () => void };
  steps?: { label: string; done: boolean; href: string; description: string }[];
  tasks?: { label: string; count: number; href: string; detail: string }[];
  actions: OverviewAction[];
  activity?: { id: string; action: string; actor: string; timestamp: string; dateTime?: string }[];
  activityHref?: string;
  notices?: { id: string; title: string; content: string }[];
  guidance?: string;
};
const icons = { students: GraduationCap, classes: School, staff: Users, attendance: ClipboardCheck };

function Action({ action, primary = false }: { action: OverviewAction; primary?: boolean }) {
  const content = <>{action.label}<ArrowUpRight size={16} aria-hidden="true" /></>;
  return action.href ? <Button asChild variant={primary ? "primary" : "secondary"}><Link href={action.href}>{content}</Link></Button> : <Button variant={primary ? "primary" : "secondary"} onClick={action.onClick}>{content}</Button>;
}

export function OverviewDashboard({ model, headingAction }: { model: OverviewModel; headingAction?: ReactNode }) {
  const done = model.steps?.filter(step => step.done).length ?? 0;
  return <div className="space-y-6">
    <PageHeading title="Overview" description={model.description} action={headingAction} />
    {model.guidance && <div className="rounded-card border border-line bg-primary-subtle p-5 text-sm text-selected"><strong>Getting started</strong><p className="mt-1">{model.guidance}</p></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{model.metrics.map(metric => {
      const Icon = icons[metric.icon];
      const content = <><div className="flex items-start justify-between gap-3"><div><h2 className="text-sm font-medium text-secondary">{metric.label}</h2><p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{metric.value}</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-primary-subtle text-selected"><Icon size={22} aria-hidden="true" /></span></div><p className="mt-3 text-xs leading-5 text-secondary">{metric.detail}</p></>;
      return <article key={metric.label} className="ui-card min-w-0">{metric.href ? <Link className="block rounded-card p-6 hover:bg-primary-subtle" href={metric.href}>{content}</Link> : <div className="p-6">{content}</div>}</article>;
    })}</div>
    <div className="grid items-start gap-6 xl:grid-cols-[1.35fr_1fr]">
      <div className="space-y-6">
        <Card><CardHeader title="Attendance summary" description={model.attendance.scope} action={<Action action={{ label: "Open attendance", href: model.attendance.href, onClick: model.attendance.onClick }} />} />
          {model.attendance.total ? <CardContent><div className="flex flex-wrap items-baseline gap-3"><p className="text-4xl font-semibold tabular-nums text-ink">{Math.round(model.attendance.attended / model.attendance.total * 100)}%</p><p className="text-sm text-secondary">Present or late / all recorded marks</p></div><dl className="mt-6 grid gap-4 sm:grid-cols-3">{[["Present or late", model.attendance.attended], ["Absent", model.attendance.absent], ["Other marks", model.attendance.total - model.attendance.attended - model.attendance.absent]].map(([label, value]) => <div key={label}><dt className="text-xs text-secondary">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{value}</dd></div>)}</dl><p className="mt-5 text-xs text-secondary">{model.attendance.total} submitted or locked marks. Other marks include excused statuses. Multiple periods can produce multiple marks per pupil.</p></CardContent> : <EmptyState title="No submitted attendance marks yet" description="Submitted and locked sessions will populate this summary. Draft marks are excluded." />}
        </Card>
        {model.steps && <Card><CardHeader title="School setup" description="Complete these steps to prepare your school year." action={<Badge tone={done === model.steps.length ? "green" : "amber"}>{done} of {model.steps.length} complete</Badge>} /><CardContent className="pb-0"><progress aria-label="School setup progress" value={done} max={model.steps.length} className="h-2 w-full accent-primary" /></CardContent><ol className="divide-y divide-line-subtle px-6">{model.steps.map(step => <li key={step.label}><Link href={step.href} className="flex min-h-20 items-center gap-3 py-4 hover:text-selected"><span className={step.done ? "text-success" : "text-muted"}>{step.done ? <Check size={20} aria-hidden="true" /> : <Circle size={20} aria-hidden="true" />}</span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{step.label}<span className="sr-only"> · {step.done ? "Complete" : "To do"}</span></p><p className="mt-1 text-xs text-secondary">{step.description}</p></div><ArrowUpRight size={16} aria-hidden="true" /></Link></li>)}</ol></Card>}
        {model.tasks && <Card><CardHeader title="Needs attention" description="Review outstanding work in the relevant workspace." /><div className="divide-y divide-line-subtle px-6">{model.tasks.map(task => <Link key={task.label} href={task.href} className="flex min-h-20 items-center gap-3 py-4 hover:text-selected"><div className="min-w-0 flex-1"><p className="text-sm font-medium">{task.label}</p><p className="mt-1 text-xs text-secondary">{task.detail}</p></div><Badge tone={task.count ? "amber" : "slate"}>{task.count}</Badge><ArrowUpRight size={16} aria-hidden="true" /></Link>)}</div></Card>}
      </div>
      <div className="space-y-6">
        <Card><CardHeader title="Quick actions" description="Go directly to your daily work." /><CardContent className="space-y-4">{model.actions.map((action, index) => <div key={action.label}><Action action={action} primary={index === 0} />{action.description && <p className="mt-2 text-xs text-secondary">{action.description}</p>}</div>)}</CardContent></Card>
        {model.activity && <Card><CardHeader title="Recent activity" description="Latest recorded changes in this school." action={model.activityHref && <Button asChild variant="ghost" size="sm"><Link href={model.activityHref}>View history</Link></Button>} />{model.activity.length ? <ol className="divide-y divide-line-subtle px-6">{model.activity.slice(0, 6).map(event => <li key={event.id} className="py-4"><p className="break-words text-sm font-medium">{event.action}</p><p className="mt-1 text-xs text-secondary">By {event.actor}</p><time dateTime={event.dateTime} className="mt-2 block text-xs text-muted">{event.timestamp}</time></li>)}</ol> : <EmptyState title="No recent activity" description="Changes will appear here as your school starts using the workspace." />}</Card>}
        {model.notices && <Card><CardHeader title="Latest notices" />{model.notices.length ? <div className="divide-y divide-line-subtle px-6">{model.notices.slice(0, 3).map(notice => <article key={notice.id} className="py-4"><h3 className="text-sm font-semibold">{notice.title}</h3><p className="mt-2 whitespace-pre-wrap break-words text-sm text-secondary">{notice.content}</p></article>)}</div> : <EmptyState title="No published notices" description="Published school and class notices will appear here." />}</Card>}
      </div>
    </div>
  </div>;
}
