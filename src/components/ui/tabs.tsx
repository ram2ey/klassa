"use client";
import { useId, useState, type ReactNode } from "react";

export function Tabs({ label, items, defaultValue }: { label: string; items: { value: string; label: string; content: ReactNode }[]; defaultValue?: string }) {
  const id = useId();
  const [value, setValue] = useState(defaultValue ?? items[0]?.value);
  const selected = items.find(item => item.value === value) ?? items[0];
  return <div><div role="tablist" aria-label={label} className="flex gap-2 overflow-x-auto border-b border-line-subtle">{items.map((item, index) => <button type="button" key={item.value} role="tab" id={`${id}-tab-${item.value}`} aria-controls={`${id}-panel-${item.value}`} aria-selected={item === selected} tabIndex={item === selected ? 0 : -1} className={`min-h-11 shrink-0 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${item === selected ? "border-primary text-selected" : "border-transparent text-secondary hover:bg-surface-subtle hover:text-ink"}`} onClick={() => setValue(item.value)} onKeyDown={event => {
    let target: number;
    if (event.key === "ArrowRight") target = (index + 1) % items.length;
    else if (event.key === "ArrowLeft") target = (index - 1 + items.length) % items.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = items.length - 1;
    else return;
    event.preventDefault(); setValue(items[target].value);
    const buttons = event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[target].focus();
  }}>{item.label}</button>)}</div>{items.map(item => <div key={item.value} role="tabpanel" id={`${id}-panel-${item.value}`} aria-labelledby={`${id}-tab-${item.value}`} hidden={item !== selected} tabIndex={0} className="pt-5">{item.content}</div>)}</div>;
}
