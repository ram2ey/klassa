import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: ComponentProps<"section">) {
  return <section className={cn("ui-card min-w-0", className)} {...props} />;
}
export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center justify-between gap-4 border-b border-line-subtle p-6", className)}><div className="min-w-0"><h2 className="text-base font-semibold text-ink">{title}</h2>{description && <p className="mt-1 text-sm text-secondary">{description}</p>}</div>{action}</div>;
}
export function CardContent({ className, ...props }: ComponentProps<"div">) {
  return <div className={cn("p-6", className)} {...props} />;
}
export function PageHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>{description && <p className="mt-2 text-sm text-secondary">{description}</p>}</div>{action}</div>;
}
