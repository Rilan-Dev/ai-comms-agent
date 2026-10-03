const metrics = [
  { label: "Unread mail", value: "24", delta: "+8 today", tone: "blue" },
  { label: "Needs action", value: "7", delta: "3 high priority", tone: "amber" },
  { label: "AI conversations", value: "18", delta: "12 voice · 6 chat", tone: "violet" },
  { label: "Automations", value: "12", delta: "11 healthy", tone: "green" },
] as const;

const activity = [
  { time: "2 min ago", title: "Daily briefing prepared", detail: "24 emails · 7 action items", icon: "✦" },
  { time: "18 min ago", title: "Email account synced", detail: "Gmail · 42 new messages", icon: "↻" },
  { time: "43 min ago", title: "Reply draft created", detail: "Alice · Q4 roadmap", icon: "✎" },
  { time: "1 hr ago", title: "WhatsApp command completed", detail: "“Summarize today”", icon: "◌" },
];

const quickActions = [
  ["Connect email", "/mail/accounts", "Add Gmail, Zoho or IMAP/SMTP"],
  ["Create agent", "/agents/new", "Configure an assistant for your team"],
  ["Schedule briefing", "/schedules", "Send a daily summary to WhatsApp"],
];

export default function HomePage() {
  return (
    <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.10),transparent_32%),radial-gradient(circle_at_20%_20%,rgba(14,165,233,.07),transparent_28%)]">
      <main className="mx-auto max-w-[1500px] space-y-8 p-5 sm:p-7 lg:p-9">
        <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              All systems operational
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Good morning, Rilan.</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Your communications are under control. Clara is monitoring your inbox, preparing actions, and keeping your channels in sync.
            </p>
          </div>
          <a href="/agents/new" className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background shadow-sm transition hover:-translate-y-0.5">
            + Create agent
          </a>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.label} className="group rounded-2xl border bg-background/85 p-5 shadow-[0_8px_30px_rgba(15,23,42,.04)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">{metric.label}</span>
                <span className={`h-2 w-2 rounded-full bg-${metric.tone}-500`} />
              </div>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-3xl font-semibold tracking-tight">{metric.value}</span>
                <span className="pb-1 text-xs font-medium text-muted-foreground">{metric.delta}</span>
              </div>
            </div>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.35fr_.65fr]">
          <div className="rounded-2xl border bg-background/90 p-6 shadow-[0_8px_30px_rgba(15,23,42,.04)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold">Today’s briefing</p>
                <p className="mt-1 text-xs text-muted-foreground">AI-generated from your connected mailboxes</p>
              </div>
              <a href="/mail/inbox" className="text-xs font-semibold text-primary hover:underline">Open inbox →</a>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">Important</p><p className="mt-2 text-2xl font-semibold">7</p><p className="mt-1 text-xs text-muted-foreground">emails need attention</p></div>
              <div className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">Action items</p><p className="mt-2 text-2xl font-semibold">4</p><p className="mt-1 text-xs text-muted-foreground">across 3 threads</p></div>
              <div className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">Suggested drafts</p><p className="mt-2 text-2xl font-semibold">3</p><p className="mt-1 text-xs text-muted-foreground">awaiting your review</p></div>
            </div>
            <div className="mt-5 rounded-xl border p-4">
              <p className="text-sm font-medium">Clara’s focus</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">The Q4 roadmap thread from Alice is the highest-priority conversation. A reply draft is ready and references the latest meeting notes.</p>
            </div>
          </div>

          <div className="rounded-2xl border bg-foreground p-6 text-background shadow-[0_12px_40px_rgba(15,23,42,.14)]">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-background/10 text-lg">✦</div>
              <div><p className="text-sm font-semibold">Ask Clara</p><p className="text-xs text-background/60">Chat or realtime voice</p></div>
            </div>
            <p className="mt-7 text-xl font-medium leading-8">“What needs my attention today?”</p>
            <div className="mt-6 rounded-xl bg-background/10 p-3 text-sm text-background/70">AI & Voice workspace is ready for provider configuration.</div>
            <a href="/ai-voice" className="mt-5 inline-flex w-full items-center justify-center rounded-xl bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-background/90">Open AI workspace</a>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
          <div className="rounded-2xl border bg-background/90 p-6">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Quick setup</p><p className="mt-1 text-xs text-muted-foreground">Connect the pieces that make the agent useful.</p></div></div>
            <div className="mt-5 space-y-2">
              {quickActions.map(([title, href, detail]) => (
                <a key={href} href={href} className="flex items-center justify-between rounded-xl border p-4 transition hover:-translate-y-0.5 hover:bg-muted/50">
                  <div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{detail}</p></div>
                  <span className="text-muted-foreground">→</span>
                </a>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-background/90 p-6">
            <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Recent activity</p><p className="mt-1 text-xs text-muted-foreground">What your communications agent has been doing.</p></div><a href="/activity" className="text-xs font-semibold text-primary hover:underline">View all →</a></div>
            <div className="mt-5 divide-y">
              {activity.map((item) => (
                <div key={item.title} className="flex gap-4 py-4 first:pt-0 last:pb-0">
                  <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-muted text-sm">{item.icon}</div>
                  <div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><p className="truncate text-sm font-medium">{item.title}</p><span className="shrink-0 text-[11px] text-muted-foreground">{item.time}</span></div><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
