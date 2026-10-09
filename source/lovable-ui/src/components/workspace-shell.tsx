import { Link, useRouterState } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Activity,
  AudioLines,
  Bell,
  BookOpen,
  Bot,
  ChevronDown,
  Command,
  LayoutGrid,
  Mail,
  Menu,
  Mic2,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkle,
  X,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const navigation = [
  { label: "Overview", icon: LayoutGrid, to: "/" as const },
  { label: "Inbox", icon: Mail, to: "/mail/inbox" as const },
  { label: "Connections", icon: Settings2, to: "/settings/connections" as const },
];
const planned = [
  { label: "Agents", icon: Bot },
  { label: "Automations", icon: Zap },
  { label: "Voice", icon: Mic2 },
  { label: "Knowledge", icon: BookOpen },
  { label: "Activity", icon: Activity },
];

export function WorkspaceShell({
  children,
  title,
  subtitle,
  actions,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const path = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="workspace min-h-screen bg-background text-foreground">
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/30 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-border bg-sidebar transition-transform duration-200 lg:!translate-x-0 ${mobileOpen ? "!translate-x-0" : "!-translate-x-full"}`}
      >
        <div className="flex h-[76px] items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-2.5"
            onClick={() => setMobileOpen(false)}
            aria-label="Comms home"
          >
            <span className="brand-mark flex size-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <AudioLines size={19} strokeWidth={2.5} />
            </span>
            <span className="text-[19px] font-semibold tracking-normal">
              comms<span className="text-muted-foreground">/</span>agent
            </span>
          </Link>
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Close menu"
            onClick={() => setMobileOpen(false)}
          >
            <X />
          </Button>
        </div>
        <div className="mx-4 mt-3 flex items-center gap-3 rounded-md border border-border bg-background px-3 py-2.5">
          <span className="flex size-8 shrink-0 items-center justify-center rounded bg-foreground text-[11px] font-semibold text-background">
            R
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs font-semibold">Rilan Workspace</span>
            <span className="block text-[11px] text-muted-foreground">Personal workspace</span>
          </span>
          <ChevronDown size={14} className="text-muted-foreground" />
        </div>
        <nav className="mt-9 flex-1 overflow-y-auto px-3" aria-label="Main navigation">
          <p className="px-3 pb-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Workspace
          </p>
          <div className="space-y-0.5">
            {navigation.map(({ label, icon: Icon, to }) => (
              <Link
                key={label}
                to={to}
                onClick={() => setMobileOpen(false)}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-[13px] font-medium transition-colors ${path === to ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"}`}
              >
                <Icon size={17} />
                {label}
                {label === "Inbox" && (
                  <span className="ml-auto rounded bg-primary px-1.5 py-0.5 text-[10px] text-primary-foreground">
                    1
                  </span>
                )}
              </Link>
            ))}
          </div>
          <p className="px-3 pb-3 pt-9 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Operate
          </p>
          <div className="space-y-0.5">
            {planned.map(({ label, icon: Icon }) => (
              <div
                key={label}
                className="flex h-10 items-center gap-3 px-3 text-[13px] text-muted-foreground/70"
                title="Coming in a future phase"
              >
                <Icon size={17} />
                {label}
                <span className="ml-auto text-[10px] opacity-60">Soon</span>
              </div>
            ))}
          </div>
        </nav>
        <div className="border-t border-border p-4">
          <div className="flex items-center gap-2.5 rounded-md bg-secondary p-3">
            <span className="flex size-8 items-center justify-center rounded bg-primary text-primary-foreground">
              <Sparkle size={15} />
            </span>
            <span className="flex-1">
              <span className="block text-xs font-semibold">Agent online</span>
              <span className="block text-[11px] text-muted-foreground">Monitoring your inbox</span>
            </span>
            <span className="size-1.5 rounded-full bg-success" />
          </div>
          <div className="mt-5 flex items-center gap-3 px-1">
            <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
              RJ
            </span>
            <span className="flex-1 text-xs font-medium">Mohammed Rilan</span>
            <SlidersHorizontal size={15} className="text-muted-foreground" />
          </div>
        </div>
      </aside>
      <div className="min-h-screen lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-border bg-background/95 px-5 backdrop-blur-sm sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <Menu />
            </Button>
            <div>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>Workspace</span>
                <span>/</span>
                <span>{title}</span>
              </div>
              <h1 className="mt-0.5 text-[18px] font-semibold leading-tight sm:text-[20px]">
                {title}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Search"
              title="Search"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={18} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              title="Notifications"
              onClick={() => setNoticeOpen(!noticeOpen)}
            >
              <Bell size={18} />
            </Button>
            <span className="mx-1 hidden h-5 w-px bg-border sm:block" />
            <span className="hidden size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground sm:flex">
              RJ
            </span>
          </div>
          {noticeOpen && (
            <div className="absolute right-5 top-[66px] w-[min(340px,calc(100vw-40px))] rounded-md border border-border bg-popover p-5 shadow-lg">
              <div className="mb-3 flex items-center justify-between">
                <strong className="text-sm">Notifications</strong>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7"
                  aria-label="Close notifications"
                  onClick={() => setNoticeOpen(false)}
                >
                  <X size={14} />
                </Button>
              </div>
              <p className="text-xs leading-5 text-muted-foreground">
                A draft response to Alice Morgan is waiting for your review.
              </p>
              <Link
                to="/mail/inbox"
                onClick={() => setNoticeOpen(false)}
                className="mt-3 inline-block text-xs font-semibold underline underline-offset-4"
              >
                Review in inbox
              </Link>
            </div>
          )}
        </header>
        <main className="mx-auto max-w-[1560px] px-5 pb-16 pt-8 sm:px-8 lg:px-10 lg:pt-10">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>{subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}</div>
            {actions}
          </div>
          {children}
        </main>
      </div>
      {searchOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/40 px-4 pt-[14vh]"
          onClick={() => setSearchOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-md border border-border bg-background p-3 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border px-2 pb-3">
              <Search size={18} className="text-muted-foreground" />
              <input
                autoFocus
                placeholder="Search conversations..."
                aria-label="Search conversations"
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchOpen(false);
                }}
              />
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                aria-label="Close search"
                onClick={() => setSearchOpen(false)}
              >
                <X size={15} />
              </Button>
            </div>
            <p className="px-2 pt-3 text-xs text-muted-foreground">
              Search will become available when accounts are connected.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
