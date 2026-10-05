import { cn } from "@/lib/utils";

const tones = {
  blue: "border-primary/20 bg-primary-subtle text-selected",
  primary: "border-primary/20 bg-primary-subtle text-selected",
  green: "border-success/20 bg-success-subtle text-success",
  amber: "border-warning/20 bg-warning-subtle text-warning",
  danger: "border-danger/20 bg-danger-subtle text-danger",
  slate: "border-line-subtle bg-surface-subtle text-secondary",
} as const;

export function Badge({ children, tone = "slate", className }: { children: React.ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn("inline-flex min-h-6 items-center gap-1.5 rounded-small border px-2 py-0.5 text-xs font-semibold", tones[tone], className)}>{children}</span>;
}
