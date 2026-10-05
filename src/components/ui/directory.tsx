"use client";
import { useId, useRef, useEffect, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { Card, CardHeader } from "./card";
import { Button } from "./button";
import { Field, Input, Select } from "./field";
import { EmptyState } from "./states";
import { Badge } from "./badge";

export type DirectoryRow = { id: string; name: string; search: string; cells: Record<string, ReactNode>; values?: Record<string, string | number>; filters?: Record<string, string> };
export type DirectoryColumn = { key: string; label: string; sortable?: boolean };
export type DirectoryFilter = { key: string; label: string; options: { value: string; label: string }[] };
function PageCheckbox({ checked, mixed, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { mixed: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (ref.current) ref.current.indeterminate = mixed; }, [mixed]);
  return <input {...props} ref={ref} type="checkbox" checked={checked} aria-checked={mixed ? "mixed" : checked} className="h-4 w-4 accent-primary" />;
}

export function Directory({ title, description, rows, columns, filters = [], query: controlledQuery, onQueryChange, actions, toolbar, bulkActions, selected, onSelectionChange, selectionDisabled, emptyAction, emptyTitle = "No records yet", emptyDescription = "Add your first record to get started.", onClearFilters, onExport, hasExternalFilters, resetKey, resultLabel = "records" }: {
  title: string; description?: string; rows: DirectoryRow[]; columns: DirectoryColumn[]; filters?: DirectoryFilter[];
  query?: string; onQueryChange?: (value: string) => void; actions?: ReactNode; toolbar?: ReactNode; bulkActions?: ReactNode;
  selected?: string[]; onSelectionChange?: (ids: string[]) => void; selectionDisabled?: boolean;
  emptyTitle?: string; emptyDescription?: string; emptyAction?: ReactNode; onClearFilters?: () => void; onExport?: (ids: string[]) => void; hasExternalFilters?: boolean; resetKey?: string; resultLabel?: string;
}) {
  const id = useId();
  const [localQuery, setLocalQuery] = useState("");
  const query = controlledQuery ?? localQuery;
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [sort, setSort] = useState(columns.find(column => column.sortable)?.key ?? "");
  const [descending, setDescending] = useState(false);
  const [page, setPageNumber] = useState(1);
  const [pageScope, setPageScope] = useState("");
  const [size, setSize] = useState(10);
  const scope = JSON.stringify([query, filterValues, resetKey, size]);
  const setPage = (value: number) => { setPageNumber(value); setPageScope(scope); };
  const setQuery = (value: string) => { if (onQueryChange) onQueryChange(value); else setLocalQuery(value); setPage(1); };
  const filtered = rows.filter(row => row.search.toLowerCase().includes(query.trim().toLowerCase()) && filters.every(filter => !filterValues[filter.key] || row.filters?.[filter.key] === filterValues[filter.key])).sort((a, b) => String(a.values?.[sort] ?? a.name).localeCompare(String(b.values?.[sort] ?? b.name), undefined, { numeric: true }) * (descending ? -1 : 1));
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const current = pageScope === scope ? Math.min(page, pages) : 1;
  const visible = filtered.slice((current - 1) * size, current * size);
  const activeFilters = !!hasExternalFilters || !!query.trim() || Object.values(filterValues).some(Boolean);
  const clear = () => { setQuery(""); setFilterValues({}); setPage(1); onClearFilters?.(); };
  const selectedOnPage = visible.filter(row => selected?.includes(row.id)).length;
  const sortBy = (key: string) => { if (key === sort) setDescending(value => !value); else { setSort(key); setDescending(false); } setPage(1); };
  return <Card aria-label={title}>
    <CardHeader title={title} description={description} action={<div className="flex flex-wrap gap-2">{onExport && <Button variant="secondary" disabled={!filtered.length} onClick={() => onExport(filtered.map(row => row.id))}>Export CSV</Button>}{actions}</div>} />
    <div className="space-y-4 border-b border-line-subtle p-6">
      <div className="flex flex-wrap items-end gap-4"><div className="min-w-0 flex-[2_1_240px]"><div className="relative"><Field label={`Search ${resultLabel}`}><Input aria-label={`Search ${resultLabel}`} className="pl-10" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search name, ID or contact…" /></Field><Search size={18} aria-hidden="true" className="pointer-events-none absolute bottom-3 left-3 text-muted" /></div></div>
        {filters.map(filter => <div key={filter.key} className="min-w-0 flex-[1_1_160px]"><Field label={filter.label}><Select value={filterValues[filter.key] ?? ""} onChange={event => { setFilterValues({ ...filterValues, [filter.key]: event.target.value }); setPage(1); }}><option value="">{filter.label === "Status" ? "All statuses" : filter.label === "Class" ? "All classes" : "All"}</option>{filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select></Field></div>)}
        {activeFilters && <Button variant="ghost" onClick={clear}>Clear filters</Button>}
      </div>{toolbar}
    </div>
    {bulkActions}
    <p id={`${id}-scroll`} className="px-6 pt-4 text-xs text-secondary md:hidden">Scroll the table sideways to view all details.</p>
    {filtered.length ? <div role="region" aria-label={`${title} table`} aria-describedby={`${id}-scroll`} tabIndex={0} className="overflow-x-auto rounded-control focus-visible:outline-offset-[-2px]">
      <table className="w-full min-w-[720px] text-left text-sm"><caption className="sr-only">{title}</caption><thead className="border-b border-line-subtle bg-surface-subtle text-xs text-secondary"><tr>
        {onSelectionChange && <th scope="col" className="w-14 p-4"><label className="grid min-h-11 min-w-11 place-items-center"><span className="sr-only">Select all visible {resultLabel}</span><PageCheckbox aria-label={`Select all visible ${resultLabel}`} checked={!!visible.length && selectedOnPage === visible.length} mixed={selectedOnPage > 0 && selectedOnPage < visible.length} disabled={selectionDisabled} onChange={event => onSelectionChange(event.target.checked ? [...new Set([...(selected ?? []), ...visible.map(row => row.id)])] : (selected ?? []).filter(value => !visible.some(row => row.id === value)))} /></label></th>}
        {columns.map(column => <th key={column.key} scope="col" aria-sort={column.sortable ? sort === column.key ? descending ? "descending" : "ascending" : "none" : undefined} className="whitespace-nowrap px-6 py-3 font-medium">{column.sortable ? <button type="button" className="inline-flex min-h-11 items-center gap-2 hover:text-selected" onClick={() => sortBy(column.key)} aria-label={`Sort by ${column.label}`}>{column.label}{sort === column.key && (descending ? <ArrowDown size={14} aria-hidden="true" /> : <ArrowUp size={14} aria-hidden="true" />)}</button> : column.label}</th>)}
      </tr></thead><tbody className="divide-y divide-line-subtle">{visible.map(row => <tr key={row.id} className={selected?.includes(row.id) ? "bg-primary-subtle" : "hover:bg-surface-subtle"}>
        {onSelectionChange && <td className="p-4"><label className="grid min-h-11 min-w-11 place-items-center"><span className="sr-only">Select {row.name}</span><input type="checkbox" aria-label={`Select ${row.name}`} disabled={selectionDisabled} checked={selected?.includes(row.id) ?? false} onChange={event => onSelectionChange(event.target.checked ? [...new Set([...(selected ?? []), row.id])] : (selected ?? []).filter(value => value !== row.id))} className="h-4 w-4 accent-primary" /></label></td>}
        {columns.map(column => <td key={column.key} className="max-w-sm px-6 py-4 align-middle break-words">{row.cells[column.key]}</td>)}
      </tr>)}</tbody></table>
    </div> : <EmptyState title={rows.length || activeFilters ? "No records match this view" : emptyTitle} description={rows.length || activeFilters ? "Try another search or clear your filters." : emptyDescription} action={rows.length || activeFilters ? <Button variant="secondary" onClick={clear}>Clear filters</Button> : emptyAction} />}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line-subtle p-6 text-sm text-secondary"><p role="status" aria-live="polite">Showing {filtered.length ? (current - 1) * size + 1 : 0}–{Math.min(current * size, filtered.length)} of {filtered.length} {resultLabel}</p><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-xs">Rows per page<Select aria-label={`${title} rows per page`} className="w-20" value={size} onChange={event => { setSize(Number(event.target.value)); setPage(1); }}>{[10, 25, 50].map(value => <option key={value}>{value}</option>)}</Select></label><Button variant="secondary" disabled={current === 1} onClick={() => setPage(current - 1)}>Previous</Button><span className="text-xs">Page {current} of {pages}</span><Button variant="secondary" disabled={current === pages} onClick={() => setPage(current + 1)}>Next</Button></div></div>
  </Card>;
}

export function DirectoryIdentity({ name, detail, onClick }: { name: string; detail?: string; onClick?: () => void }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map(value => value[0]).join("");
  return <div className="flex min-w-48 items-center gap-3"><span aria-hidden="true" className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary-subtle text-xs font-semibold text-selected">{initials}</span><div className="min-w-0">{onClick ? <button onClick={onClick} className="min-h-11 text-left font-semibold text-ink hover:text-selected hover:underline">{name}</button> : <p className="font-semibold text-ink">{name}</p>}{detail && <p className="mt-1 text-xs text-secondary">{detail}</p>}</div></div>;
}
export function DirectoryStatus({ value }: { value: string }) {
  return <Badge tone={value.toLowerCase() === "active" ? "green" : value.toLowerCase() === "pending" ? "amber" : "slate"}>{value.replace(/^./, letter => letter.toUpperCase())}</Badge>;
}
