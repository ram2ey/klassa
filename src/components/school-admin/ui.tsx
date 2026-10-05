"use client";
import { type ReactNode } from "react";
import { panelStyle, words } from "./shared";
import { CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { AlertTriangle, Check } from "lucide-react";

export function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: ReactNode }) {
  return <article className={`${panelStyle} p-6`}><div className="flex justify-between gap-3"><div><h2 className="text-sm font-medium text-secondary">{label}</h2><p className="mt-3 text-3xl font-semibold tabular-nums text-ink">{value}</p></div><span className="grid h-11 w-11 shrink-0 place-items-center rounded-control bg-primary-subtle text-selected">{icon}</span></div><p className="mt-3 text-xs text-secondary">{detail}</p></article>;
}

export function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <CardHeader title={title} description={description} action={action} />;
}

export function Empty({ text }: { text: string }) { return <EmptyState title={text} />; }

export function Status({ value }: { value: string }) {
  const ready = ["active", "ready", "current"].includes(value);
  const pending = ["pending", "password change due"].includes(value);
  return <Badge tone={ready ? "green" : pending ? "amber" : "slate"} className="whitespace-nowrap">{ready ? <Check size={14} aria-hidden="true" /> : pending ? <AlertTriangle size={14} aria-hidden="true" /> : null}{words(value)}</Badge>;
}

export function DataTable({ caption, headers, rows, empty }: { caption: string; headers: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="border-b border-line-subtle bg-surface-subtle text-[11px] uppercase tracking-wide text-secondary"><tr>{headers.map(header => <th scope="col" className="whitespace-nowrap px-5 py-3 font-semibold" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-line-subtle">{rows.map(row => <tr key={row.key} className="hover:bg-surface-subtle">{row.cells.map((cell, index) => <td key={headers[index]} className="px-5 py-3.5 align-middle">{cell}</td>)}</tr>)}</tbody></table></div>;
}
