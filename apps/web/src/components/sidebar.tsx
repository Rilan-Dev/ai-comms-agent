"use client";

import { usePathname, useRouter } from "next/navigation";

const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: "⌂" },
  { label: "Agents", href: "/agents", icon: "✦" },
  { label: "Mail", href: "/mail/accounts", icon: "✉", children: [
    { label: "Accounts", href: "/mail/accounts" }, { label: "Inbox", href: "/mail/inbox" }, { label: "Threads", href: "/mail/threads" }, { label: "Drafts", href: "/mail/drafts" },
  ]},
  { label: "WhatsApp", href: "/whatsapp", icon: "◌" },
  { label: "Automations", href: "/automations", icon: "↯" },
  { label: "Schedules", href: "/schedules", icon: "◷" },
  { label: "Chat", href: "/chat", icon: "◫" },
  { label: "AI & Voice", href: "/ai-voice", icon: "◉" },
  { label: "Knowledge", href: "/knowledge", icon: "▱" },
  { label: "Activity", href: "/activity", icon: "⌁" },
  { label: "Audit", href: "/audit", icon: "◇" },
  { label: "Operations", href: "/operations", icon: "⌁" },
  { label: "Settings", href: "/settings", icon: "⚙" },
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }
  return (
    <aside className="hidden w-[252px] shrink-0 flex-col border-r bg-background/95 md:flex">
      <div className="flex h-[72px] items-center gap-3 border-b px-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-foreground text-sm font-bold text-background shadow-sm">C</div>
        <div><p className="text-sm font-semibold tracking-tight">Clara Comms</p><p className="text-[11px] text-muted-foreground">AI communications</p></div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[.16em] text-muted-foreground">Workspace</p>
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return <li key={item.href}>
              <a href={item.href} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150 ${active ? "bg-foreground text-background shadow-sm" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>
                <span className={`grid h-7 w-7 place-items-center rounded-lg text-sm ${active ? "bg-background/15" : "bg-transparent"}`}>{item.icon}</span><span>{item.label}</span>
              </a>
              {"children" in item && item.children && active && <ul className="ml-9 mt-1 space-y-0.5 border-l pl-2">{item.children.map((child) => {
                const childActive = pathname === child.href;
                return <li key={child.href}><a href={child.href} aria-current={childActive ? "page" : undefined} className={`block rounded-lg px-3 py-2 text-xs transition ${childActive ? "bg-muted font-semibold text-foreground" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}>{child.label}</a></li>;
              })}</ul>}
            </li>;
          })}
        </ul>
      </nav>
      <div className="border-t p-3 space-y-2"><a href="/operations" className="block rounded-xl border bg-muted/40 p-3 transition hover:bg-muted"><p className="text-xs font-semibold">Operations</p><p className="mt-1 text-[11px] text-muted-foreground">Health, runtime signals and infrastructure status</p></a><button type="button" onClick={() => void signOut()} className="w-full rounded-xl px-3 py-2 text-left text-xs font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">Sign out</button></div>
    </aside>
  );
}
