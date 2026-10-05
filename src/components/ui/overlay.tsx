"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { IconButton } from "./button";

/** Native modal dialog supplies focus containment, Escape and focus restoration. */
export function Overlay({ open, onClose, title, description, children, variant = "dialog", side = "right", size = "default" }: { open: boolean; onClose: () => void; title: string; description?: string; children: ReactNode; variant?: "dialog" | "drawer"; side?: "left" | "right"; size?: "default" | "wide" }) {
  const ref = useRef<HTMLDialogElement>(null);
  const id = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog?.open) dialog?.showModal();
    if (!open && dialog?.open) dialog.close();
    return () => { if (dialog?.open) dialog.close(); };
  }, [open]);
  const requestClose = () => { ref.current?.close(); onClose(); };
  return <dialog ref={ref} aria-labelledby={`${id}-title`} aria-describedby={description ? `${id}-description` : undefined} onCancel={event => { event.preventDefault(); requestClose(); }} onClick={event => {
    if (event.target !== event.currentTarget) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) requestClose();
  }} className={`ui-overlay fixed overflow-y-auto p-0 ${variant === "drawer" ? `inset-y-0 m-0 h-dvh max-h-none w-[min(360px,calc(100%_-_24px))] ${side === "left" ? "left-0 right-auto rounded-l-none" : "left-auto right-0 rounded-r-none"}` : `inset-0 m-auto max-h-[90dvh] ${size === "wide" ? "w-[min(960px,calc(100%_-_32px))]" : "w-[min(560px,calc(100%_-_32px))]"}`}`}>
    <div className="flex items-start justify-between gap-4 border-b border-line-subtle p-6"><div><h2 id={`${id}-title`} className="text-lg font-semibold">{title}</h2>{description && <p id={`${id}-description`} className="mt-1 text-sm text-secondary">{description}</p>}</div><IconButton label={`Close ${title}`} onClick={requestClose}><X size={20} aria-hidden="true" /></IconButton></div><div className="p-6">{children}</div>
  </dialog>;
}
