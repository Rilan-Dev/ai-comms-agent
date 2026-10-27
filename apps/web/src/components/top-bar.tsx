"use client";

import { useState } from "react";
import { FALLBACK_WORKSPACE_NAME } from "@/lib/branding";

export function TopBar({ workspaceName, organizationName }: { workspaceName?: string; organizationName?: string | null }) {
  const [searchOpen, setSearchOpen] = useState(false);
  const displayName = workspaceName?.trim() || FALLBACK_WORKSPACE_NAME;
  const orgName = organizationName?.trim() || "";
  const subtitle = orgName && orgName !== displayName ? orgName : "Communications workspace";
  return (
    <header className="sticky top-0 z-20 flex h-[64px] items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <div className="min-w-0"><p className="truncate text-[13px] font-semibold" title={displayName}>{displayName}</p><p className="truncate text-[11px] text-muted-foreground" title={subtitle}>{subtitle}</p></div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3">
        {searchOpen && <form action="/mail/inbox" className="hidden sm:block"><input autoFocus name="q" placeholder="Search your workspace…" aria-label="Search inbox" className="h-9 w-48 rounded-md border border-input bg-card px-3 text-xs outline-none focus:ring-2 focus:ring-ring/30 lg:w-64" /></form>}
        <button type="button" onClick={() => setSearchOpen(!searchOpen)} className="grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label={searchOpen ? "Close search" : "Search"} title="Search inbox">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-[17px]"><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 4.5 4.5"/></svg>
        </button>
        <a href="/activity" className="relative grid size-9 place-items-center rounded-md border border-border text-muted-foreground transition hover:bg-secondary hover:text-foreground" aria-label="Activity and notifications" title="Activity">
          <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="size-[17px]"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg>
        </a>
        <span className="mx-1 h-6 w-px bg-border" />
        <a href="/settings" className="flex items-center gap-2.5 rounded-md px-1 py-1 transition hover:bg-secondary">
          <span className="grid size-8 place-items-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">{displayName.charAt(0).toUpperCase() || "W"}</span>
          <span className="hidden text-left sm:block"><span className="block text-xs font-semibold">Workspace</span><span className="block text-[10px] text-muted-foreground">Settings & profile</span></span>
        </a>
      </div>
      {searchOpen && <form action="/mail/inbox" className="absolute left-4 right-4 top-[68px] rounded-md border border-border bg-card p-2 shadow-lg sm:hidden"><input autoFocus name="q" placeholder="Search inbox…" aria-label="Search inbox" className="h-10 w-full rounded-md bg-transparent px-3 text-sm outline-none" /></form>}
    </header>
  );
}
