import { cn } from "@/lib/utils";

const tones = {
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  green: "border-green-200 bg-green-50 text-green-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  slate: "border-slate-200 bg-slate-50 text-slate-600",
} as const;

export function Badge({ children, tone = "slate", className }: { children: React.ReactNode; tone?: keyof typeof tones; className?: string }) {
  return <span className={cn("inline-flex h-6 items-center border px-2 text-[11px] font-semibold", tones[tone], className)}>{children}</span>;
}
