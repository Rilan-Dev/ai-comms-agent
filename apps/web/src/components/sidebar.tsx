const NAV_ITEMS = [
  { label: "Overview", href: "/", icon: "home" },
  {
    label: "Agents",
    href: "/agents",
    icon: "bot",
    children: [
      { label: "All Agents", href: "/agents" },
      { label: "Create Agent", href: "/agents/new" },
    ],
  },
  {
    label: "Mail",
    href: "/mail/accounts",
    icon: "mail",
    children: [
      { label: "Accounts", href: "/mail/accounts" },
      { label: "Inbox", href: "/mail/inbox" },
      { label: "Threads", href: "/mail/threads" },
      { label: "Drafts", href: "/mail/drafts" },
    ],
  },
  { label: "WhatsApp", href: "/whatsapp", icon: "message" },
  { label: "Automations", href: "/automations", icon: "zap" },
  { label: "Schedules", href: "/schedules", icon: "clock" },
  { label: "AI & Voice", href: "/ai-voice", icon: "mic" },
  { label: "Knowledge", href: "/knowledge", icon: "book" },
  { label: "Activity", href: "/activity", icon: "activity" },
  { label: "Audit", href: "/audit", icon: "shield" },
  { label: "Settings", href: "/settings", icon: "settings" },
] as const;

export function Sidebar() {
  return (
    <aside className="flex w-64 flex-col border-r bg-muted/30">
      <div className="flex h-14 items-center border-b px-4">
        <span className="text-lg font-bold">ai-comms-agent</span>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => (
            <li key={item.href}>
              <a
                href={item.href}
                className="flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
              >
                {item.label}
              </a>
              {"children" in item && item.children && (
                <ul className="ml-4 mt-1 space-y-1 border-l pl-2">
                  {item.children.map((child) => (
                    <li key={child.href}>
                      <a
                        href={child.href}
                        className="flex items-center rounded-md px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        {child.label}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
