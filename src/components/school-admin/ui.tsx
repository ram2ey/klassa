"use client";
import { type ReactNode } from "react";
import { panelStyle, words } from "./shared";

export function Metric({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: ReactNode }) {
  return <article className={`${panelStyle} p-5`}><div className="flex justify-between gap-3"><div><h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</h2><p className="mt-3 text-3xl font-bold tabular-nums">{value}</p></div><span className="grid h-11 w-11 place-items-center bg-blue-50 text-blue-700">{icon}</span></div><p className="mt-3 text-xs text-slate-500">{detail}</p></article>;
}

export function PanelHeading({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 p-5"><div><h2 className="font-bold">{title}</h2>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div>{action}</div>;
}

export function Empty({ text }: { text: string }) { return <p className="px-6 py-12 text-center text-sm text-slate-500">{text}</p>; }

export function Status({ value }: { value: string }) {
  const ready = ["active", "ready", "current"].includes(value);
  const pending = ["pending", "password change due"].includes(value);
  return <span className={`inline-block whitespace-nowrap border px-2 py-1 text-xs font-medium ${ready ? "border-emerald-200 bg-emerald-50 text-emerald-800" : pending ? "border-amber-200 bg-amber-50 text-amber-800" : "border-slate-200 bg-slate-50 text-slate-600"}`}>{words(value)}</span>;
}

export function DataTable({ caption, headers, rows, empty }: { caption: string; headers: string[]; rows: { key: string; cells: ReactNode[] }[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">{caption}</caption><thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500"><tr>{headers.map(header => <th scope="col" className="whitespace-nowrap px-5 py-3 font-semibold" key={header}>{header}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map(row => <tr key={row.key} className="hover:bg-slate-50/70">{row.cells.map((cell, index) => <td key={headers[index]} className="px-5 py-3.5 align-middle">{cell}</td>)}</tr>)}</tbody></table></div>;
}
