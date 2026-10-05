"use client";
import type { ComponentProps, ReactElement } from "react";
import { cloneElement, useId } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: ComponentProps<"input">) { return <input className={cn("ui-field", className)} {...props} />; }
export function Select({ className, ...props }: ComponentProps<"select">) { return <select className={cn("ui-field", className)} {...props} />; }
export function Textarea({ className, ...props }: ComponentProps<"textarea">) { return <textarea className={cn("ui-field min-h-28 resize-y", className)} {...props} />; }

type ControlProps = { id?: string; required?: boolean; "aria-describedby"?: string; "aria-invalid"?: boolean | "true" | "false" };
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactElement<ControlProps> }) {
  const generatedId = useId();
  const id = children.props.id ?? generatedId;
  const description = [children.props["aria-describedby"], hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-medium text-ink">{label}{children.props.required && <span className="ml-1 text-danger" aria-hidden="true">*</span>}</label>{cloneElement(children, { id, "aria-describedby": description, "aria-invalid": error ? true : children.props["aria-invalid"] })}{hint && <p id={`${id}-hint`} className="text-xs text-secondary">{hint}</p>}{error && <p id={`${id}-error`} role="alert" className="text-xs font-medium text-danger">{error}</p>}</div>;
}
