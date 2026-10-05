"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown, GraduationCap, Menu, UserRound } from "lucide-react";
import { AccountSignOut } from "@/components/account-sign-out";
import { IconButton } from "@/components/ui/button";
import { Overlay } from "@/components/ui/overlay";
import { cn } from "@/lib/utils";

export type WorkspaceNavItem = { id: string; label: string; icon: ReactNode; href?: string };
export type WorkspaceNavGroup = { label: string; items: WorkspaceNavItem[] };

type WorkspaceShellProps = {
  schoolName: string;
  academicYear?: string;
  actorName: string;
  roleLabel: string;
  navigationLabel: string;
  groups: WorkspaceNavGroup[];
  activeId: string;
  contentId: string;
  children: ReactNode;
  onNavigate?: (id: string) => void;
  switchSchoolHref?: string;
  accountActions?: ReactNode;
  banner?: ReactNode;
  toolbar?: ReactNode;
};

/** Presentation only: callers supply authorized navigation and scoped content. */
export function WorkspaceShell({ schoolName, academicYear, actorName, roleLabel, navigationLabel, groups, activeId, contentId, children, onNavigate, switchSchoolHref, accountActions, banner, toolbar }: WorkspaceShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navId = useId();
  const account = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const closeAccount = (event: PointerEvent) => {
      if (account.current?.open && !account.current.contains(event.target as Node)) account.current.open = false;
    };
    document.addEventListener("pointerdown", closeAccount);
    return () => document.removeEventListener("pointerdown", closeAccount);
  }, []);

  useEffect(() => {
    if (!window.matchMedia) return;
    const media = window.matchMedia("(min-width: 1024px)");
    const closeMobile = () => { if (media.matches) setMobileOpen(false); };
    media.addEventListener("change", closeMobile);
    return () => media.removeEventListener("change", closeMobile);
  }, []);

  const navigate = (id: string) => { setMobileOpen(false); if (account.current) account.current.open = false; onNavigate?.(id); };
  const navigation = (compact: boolean, mobile: boolean) => <nav id={mobile ? `${navId}-mobile` : navId} aria-label={navigationLabel} className="space-y-6">
    {groups.filter(group => group.items.length > 0).map(group => <div key={group.label}>
      <p className={cn("mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-muted", compact && "sr-only")}>{group.label}</p>
      <ul className="space-y-1">{group.items.map(item => {
        const selected = activeId === item.id;
        const className = cn("flex min-h-11 w-full items-center gap-3 rounded-control px-3 py-2 text-left text-sm font-medium transition-colors", compact && "justify-center px-0", selected ? "bg-primary-subtle text-selected" : "text-secondary hover:bg-surface-subtle hover:text-ink");
        const content = <><span className="shrink-0 [&_svg]:h-5 [&_svg]:w-5" aria-hidden="true">{item.icon}</span><span className={compact ? "sr-only" : "min-w-0 flex-1 break-words"}>{item.label}</span>{selected && !compact && <ChevronRight size={14} aria-hidden="true" className="shrink-0" />}</>;
        return <li key={item.id}>{item.href ? <Link href={item.href} className={className} title={compact ? item.label : undefined} aria-current={selected ? "page" : undefined} onClick={() => navigate(item.id)}>{content}</Link> : <button type="button" className={className} title={compact ? item.label : undefined} aria-current={selected ? "page" : undefined} onClick={() => navigate(item.id)}>{content}</button>}</li>;
      })}</ul>
    </div>)}
  </nav>;

  return <div className="min-h-screen bg-canvas text-ink">
    <a href={`#${contentId}`} className="sr-only rounded-control bg-surface p-3 text-selected focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100]">Skip to content</a>
    {banner}
    <div className={cn("lg:grid", collapsed ? "lg:grid-cols-[72px_minmax(0,1fr)]" : "lg:grid-cols-[260px_minmax(0,1fr)]")}>
      <aside aria-label="Workspace sidebar" className="sticky top-0 hidden h-dvh min-w-0 flex-col border-r border-line-subtle bg-surface lg:flex">
        <div className={cn("flex min-h-20 items-center border-b border-line-subtle", collapsed ? "flex-col gap-2 p-3" : "justify-between px-5")}>
          <Link href="/" aria-label="Klassa home" className="flex min-h-11 min-w-0 items-center gap-3 rounded-control text-ink"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-control bg-primary text-white"><GraduationCap size={23} aria-hidden="true" /></span>{!collapsed && <span className="text-xl font-semibold tracking-tight">Klassa</span>}</Link>
          <IconButton label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-expanded={!collapsed} aria-controls={navId} onClick={() => setCollapsed(value => !value)}>{collapsed ? <ChevronRight size={18} aria-hidden="true" /> : <ChevronLeft size={18} aria-hidden="true" />}</IconButton>
        </div>
        <div className={cn("min-h-0 flex-1 overflow-y-auto py-6 scrollbar-thin", collapsed ? "px-2" : "px-3")}>{navigation(collapsed, false)}</div>
        <div className={cn("border-t border-line-subtle", collapsed ? "p-3 text-center" : "p-5")}>
          {collapsed ? <span title={roleLabel} className="inline-flex h-10 w-10 items-center justify-center rounded-control bg-primary-subtle text-selected"><UserRound size={20} aria-label={roleLabel} /></span> : <><p className="break-words text-sm font-semibold">{actorName}</p><p className="mt-1 text-xs text-secondary">{roleLabel}</p>{switchSchoolHref && <Link href={switchSchoolHref} className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-selected">Switch school<ChevronRight size={14} aria-hidden="true" /></Link>}</>}
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex min-h-20 items-center gap-3 border-b border-line-subtle bg-surface px-4 py-3 sm:px-6 lg:px-8">
          <div className="lg:hidden"><IconButton label="Open navigation" aria-expanded={mobileOpen} aria-controls={`${navId}-mobile`} onClick={() => setMobileOpen(true)}><Menu size={20} aria-hidden="true" /></IconButton></div>
          <div className="min-w-0 flex-1"><p title={schoolName} className="truncate text-sm font-semibold sm:text-base">{schoolName}</p><p title={academicYear ?? roleLabel} className="mt-1 truncate text-xs text-secondary">{academicYear ?? roleLabel}</p></div>
          <details ref={account} className="relative shrink-0" onKeyDown={event => {
            if (event.key === "Escape" && account.current?.open) { account.current.open = false; account.current.querySelector("summary")?.focus(); event.stopPropagation(); }
          }}>
            <summary aria-label="Account menu" className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-control px-2 text-sm hover:bg-surface-subtle [&::-webkit-details-marker]:hidden"><span className="grid h-9 w-9 place-items-center rounded-control bg-primary-subtle text-selected"><UserRound size={18} aria-hidden="true" /></span><span className="hidden max-w-40 truncate font-medium md:block">{actorName}</span><ChevronsUpDown size={14} aria-hidden="true" /></summary>
            <div className="absolute right-0 top-full z-30 mt-2 w-60 max-w-[calc(100vw-32px)] rounded-card border border-line-subtle bg-surface p-3 shadow-overlay"><div className="border-b border-line-subtle px-2 pb-3"><p className="break-words text-sm font-semibold">{actorName}</p><p className="mt-1 text-xs text-secondary">{roleLabel}</p></div>{switchSchoolHref && <Link href={switchSchoolHref} onClick={() => { if (account.current) account.current.open = false; }} className="my-2 flex min-h-11 items-center rounded-control px-2 text-sm text-selected hover:bg-primary-subtle">Switch school</Link>}<div className="mt-2">{accountActions ?? <AccountSignOut />}</div></div>
          </details>
        </header>
        {toolbar && <div className="flex flex-wrap items-center gap-3 border-b border-line-subtle bg-surface px-4 py-3 sm:px-6 lg:px-8">{toolbar}</div>}
        <main id={contentId} tabIndex={-1} className="mx-auto min-w-0 max-w-[1500px] space-y-6 p-4 outline-none sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
    <Overlay open={mobileOpen} onClose={() => setMobileOpen(false)} title="Navigation" description={roleLabel} variant="drawer" side="left">
      {navigation(false, true)}
      {switchSchoolHref && <Link href={switchSchoolHref} onClick={() => setMobileOpen(false)} className="mt-6 flex min-h-11 items-center rounded-control border-t border-line-subtle text-sm font-medium text-selected">Switch school</Link>}
    </Overlay>
  </div>;
}
