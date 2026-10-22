"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const NAV_ITEMS = [
  { label: "Overview", href: "/overview", icon: "grid" },
  { label: "Chat", href: "/chat", icon: "sparkles" },
  { label: "Agents", href: "/agents", icon: "bot" },
  { label: "Mail", href: "/mail/inbox", icon: "mail", children: [
    { label: "Inbox", href: "/mail/inbox" }, { label: "Drafts", href: "/mail/drafts" },
    { label: "Threads", href: "/mail/threads" }, { label: "Accounts", href: "/mail/accounts" },
  ]},
  { label: "WhatsApp", href: "/whatsapp", icon: "message" },
  { label: "Automations", href: "/automations", icon: "zap" },
  { label: "Schedules", href: "/schedules", icon: "clock" },
  { label: "Knowledge", href: "/knowledge", icon: "book" },
  { label: "Activity", href: "/activity", icon: "activity" },
  { label: "Audit", href: "/audit", icon: "shield" },
  { label: "Operations", href: "/operations", icon: "pulse" },
  { label: "AI Provider Setup", href: "/settings/ai-provider-setup", icon: "key" },
  { label: "Settings", href: "/settings", icon: "settings" },
] as const;

function NavIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8A8.5 8.5 0 0 1 8.7 3.9a8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></>,
    zap: <path d="m13 2-3 8h7l-6 12 1-9H6l7-11z"/>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    sparkles: <><path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-2-5.8L4 11l6-2.2L12 3z"/><path d="m19 14 1.2 2.8L23 18l-2.8 1.2L19 22l-1.2-2.8L15 18l2.8-1.2L19 14z"/></>,
    audio: <><path d="M2 10v4M6 6v12M10 3v18M14 7v10M18 5v14M22 10v4"/></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 0 4 22z"/><path d="M4 5.5v14A2.5 2.5 0 0 1 6.5 17H20"/></>,
    activity: <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></>,
    pulse: <><path d="M3 12h4l3-8 4 16 3-8h4"/></>,
    key: <><circle cx="7.5" cy="15.5" r="3.5"/><path d="M10 13 19 4M16 7l3 3M14 9l3 3"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.7 1l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.7-1l-1.7.6-1.4-2.4L7.3 15a8 8 0 0 1 0-2l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.7-1l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.7 1l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 2z"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-[17px] w-[17px] shrink-0">{paths[name]}</svg>;
}

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mailExpanded, setMailExpanded] = useState(true);
  const sidebarRef = useRef<HTMLElement>(null);
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const closeMobileButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeMobileButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setMobileOpen(false);
        return;
      }
      if (event.key !== "Tab" || !sidebarRef.current) return;
      const focusable = Array.from(sidebarRef.current.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        sidebarRef.current.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      (mobileTriggerRef.current ?? previousFocus)?.focus();
    };
  }, [mobileOpen]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return <>
    {mobileOpen && <button aria-label="Close navigation" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-40 bg-foreground/30 md:hidden" />}
    <aside ref={sidebarRef} id="workspace-sidebar" role={mobileOpen ? "dialog" : undefined} aria-modal={mobileOpen ? true : undefined} aria-label={mobileOpen ? "Workspace navigation" : undefined} tabIndex={mobileOpen ? -1 : undefined} className={`fixed inset-y-0 left-0 z-50 flex w-[248px] shrink-0 flex-col border-r border-border bg-sidebar transition-transform duration-200 md:translate-x-0 ${mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}>
      <div className="flex h-[76px] items-center justify-between px-6">
        <a href="/overview" className="flex items-center gap-2.5" aria-label="Comms Agent home" onClick={() => setMobileOpen(false)}>
          <span className="flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground"><NavIcon name="audio" /></span>
          <span className="text-[18px] font-semibold tracking-tight">comms<span className="text-muted-foreground">/</span>agent</span>
        </a>
        <button ref={closeMobileButtonRef} type="button" className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-secondary md:hidden" onClick={() => setMobileOpen(false)} aria-label="Close navigation">×</button>
      </div>
      <div className="mx-4 mt-3 flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground text-[11px] font-semibold text-background">R</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">Workspace</span><span className="block text-[11px] text-muted-foreground">Communications</span></span>
        <span className="text-xs text-muted-foreground" aria-hidden="true">⌄</span>
      </div>
      <nav className="mt-8 flex-1 overflow-y-auto px-3 pb-4" aria-label="Main navigation">
        <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-[.16em] text-muted-foreground">Workspace</p>
        <ul className="space-y-0.5">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href + "/")) || ("children" in item && item.children?.some((child) => pathname === child.href || pathname.startsWith(child.href + "/")));
            return <li key={item.href}>
              <div className="flex min-w-0 items-center gap-1">
                <a href={item.href} aria-current={active ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`flex h-10 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors ${active ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>
                  <NavIcon name={item.icon} /><span>{item.label}</span>
                </a>
                {"children" in item && item.children ? (
                  <button type="button" aria-expanded={mailExpanded} aria-controls="mail-navigation" aria-label={mailExpanded ? "Collapse Mail folders" : "Expand Mail folders"} onClick={() => setMailExpanded((open) => !open)} className="grid size-9 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">
                    <span aria-hidden="true" className={`transition-transform ${mailExpanded ? "rotate-180" : ""}`}>⌄</span>
                  </button>
                ) : null}
              </div>
              {"children" in item && item.children && mailExpanded && <ul id="mail-navigation" className="ml-[21px] mt-1 space-y-0.5 border-l border-border pl-3">{item.children.map((child) => {
                const childActive = pathname === child.href;
                return <li key={child.href}><a href={child.href} aria-current={childActive ? "page" : undefined} onClick={() => setMobileOpen(false)} className={`block rounded-md px-3 py-2 text-xs transition-colors ${childActive ? "bg-accent/60 font-semibold text-accent-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}>{child.label}</a></li>;
              })}</ul>}
            </li>;
          })}
        </ul>
      </nav>
      <div className="border-t border-border p-3">
        <a href="/operations" className="mb-2 flex items-start gap-3 rounded-md border border-border bg-background p-3 transition hover:bg-secondary"><span className="mt-0.5 text-success"><NavIcon name="pulse" /></span><span><span className="block text-xs font-semibold">System status</span><span className="mt-1 block text-[11px] leading-4 text-muted-foreground">Runtime signals and operations</span></span></a>
        <button type="button" onClick={() => void signOut()} className="w-full rounded-md px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground">Sign out</button>
      </div>
    </aside>
    <button ref={mobileTriggerRef} type="button" onClick={() => setMobileOpen(true)} className="fixed bottom-4 left-4 z-30 grid size-11 place-items-center rounded-full border border-border bg-card text-foreground shadow-lg md:hidden" aria-label="Open navigation" aria-expanded={mobileOpen} aria-controls="workspace-sidebar"><NavIcon name="grid" /></button>
  </>;
}
