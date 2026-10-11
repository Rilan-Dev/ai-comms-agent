"use client";

import { useEffect, useState } from "react";

type Overview = {
  metrics: Record<string, number>;
  activity: { id: string; title: string; detail: string; createdAt: string }[];
};

const metricMeta = [
  { key: "unread_mail", label: "Unread messages", icon: "mail", tone: "bg-sky-50 text-sky-700" },
  { key: "action_required", label: "Needs attention", icon: "inbox", tone: "bg-amber-50 text-amber-700" },
  { key: "pending_approvals", label: "Pending approvals", icon: "shield", tone: "bg-rose-50 text-rose-700" },
  { key: "active_agents", label: "Active agents", icon: "bot", tone: "bg-emerald-50 text-emerald-700" },
] as const;

function MetricIcon({ name }: { name: string }) {
  const paths: Record<string, React.ReactNode> = {
    mail: <><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/></>,
    inbox: <><path d="M4 4h16l2 11h-6l-2 3h-4l-2-3H2z"/><path d="M2 15h6m8 0h6"/></>,
    shield: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/><path d="m9 12 2 2 4-4"/></>,
    bot: <><rect x="4" y="7" width="16" height="13" rx="3"/><path d="M12 3v4M9 12h.01M15 12h.01M9 16h6"/></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="size-[18px]">{paths[name]}</svg>;
}

export default function HomePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetch("/api/overview").then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.message ?? "Overview could not be loaded.");
      setData(body);
    }).catch((e) => setError(e instanceof Error ? e.message : "Overview could not be loaded."));
  }, []);

  const metric = (key: string) => data?.metrics[key] ?? 0;

  return <main className="min-h-full bg-[radial-gradient(circle_at_90%_0%,oklch(0.88_0.105_152/.16),transparent_28%)]">
    <div className="mx-auto max-w-[1500px] space-y-9 px-5 py-7 sm:px-7 sm:py-9 lg:px-10">
      <section className="flex flex-col justify-between gap-6 border-b border-border pb-8 lg:flex-row lg:items-end">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[.14em] text-muted-foreground">
            <span className={`size-1.5 rounded-full ${error ? "bg-amber-500" : "bg-emerald-600"}`} />
            {error ? "Configuration required" : data ? "Live workspace" : "Loading workspace"}
          </div>
          <h1 className="font-display text-4xl font-medium leading-[1.08] tracking-tight sm:text-5xl lg:text-[56px]">Your communications,<br/><span className="text-muted-foreground">in good hands.</span></h1>
          <p className="mt-5 max-w-[580px] text-sm leading-6 text-muted-foreground">One considered workspace for your agents, inbox, messaging, knowledge and realtime AI. Your organization data stays the source of truth.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a href="/agents/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition hover:opacity-85"><span aria-hidden="true">＋</span> Create agent</a>
          <a href="/chat" className="inline-flex h-10 items-center gap-2 rounded-md border border-border bg-card px-4 text-sm font-medium transition hover:bg-secondary"><span aria-hidden="true">✳</span> Ask Clara</a>
        </div>
      </section>

      {error && <div role="alert" className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800"><p className="font-semibold">Workspace data unavailable</p><p className="mt-1 leading-6">{error} Connect PostgreSQL and an authenticated organization context to load live workspace state.</p></div>}

      <section aria-label="Workspace metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricMeta.map((item) => <article key={item.key} className="rounded-md border border-border bg-card p-5 transition-colors hover:bg-card/80">
          <div className="flex items-start justify-between gap-3"><p className="text-[13px] font-medium text-muted-foreground">{item.label}</p><span className={`grid size-9 place-items-center rounded-md ${item.tone}`}><MetricIcon name={item.icon}/></span></div>
          <p className="mt-6 font-display text-4xl font-medium tracking-tight tabular-nums">{data ? metric(item.key) : "—"}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{data ? "From your organization" : "Waiting for persisted data"}</p>
        </article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        <article className="rounded-md border border-border bg-card p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="font-display text-xl font-medium">Workspace snapshot</p><p className="mt-1 text-xs text-muted-foreground">A live view of work in progress.</p></div><a href="/operations" className="shrink-0 text-xs font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">Operations ↗</a></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Active automations", key: "active_automations", href: "/automations" },
              { label: "Active voice sessions", key: "active_voice_sessions", href: "/ai-voice" },
              { label: "Pending approvals", key: "pending_approvals", href: "/mail/drafts" },
            ].map((item) => <a key={item.key} href={item.href} className="rounded-md bg-secondary/70 p-4 transition hover:bg-secondary"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-3 font-display text-2xl font-medium">{data ? metric(item.key) : "—"}</p><p className="mt-2 text-[10px] text-muted-foreground">View details ↗</p></a>)}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-md border border-border p-4"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-accent text-accent-foreground"><span aria-hidden="true">✳</span></span><div><p className="text-sm font-semibold">Clara intelligence</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Ask about your connected mail and work across channels. Provider or knowledge configuration gaps are surfaced rather than simulated.</p><a href="/chat" className="mt-3 inline-flex text-xs font-semibold underline decoration-border underline-offset-4">Start a conversation ↗</a></div></div>
        </article>

        <article className="flex flex-col rounded-md bg-foreground p-6 text-background sm:p-7">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.18em] text-background/60"><span className="size-1.5 rounded-full bg-emerald-400"/> Clara workspace</div>
          <h2 className="mt-7 font-display text-3xl font-medium leading-tight">A calmer way to manage every conversation.</h2>
          <p className="mt-4 text-sm leading-6 text-background/65">Review important mail, prepare drafts, and coordinate agent actions with approvals and audit trails.</p>
          <div className="mt-auto grid gap-2 pt-8">
            <a href="/mail/inbox" className="flex items-center justify-between rounded-md bg-background px-4 py-3 text-sm font-semibold text-foreground transition hover:opacity-90">Open priority inbox <span aria-hidden="true">↗</span></a>
            <a href="/ai-voice" className="flex items-center justify-between rounded-md border border-background/20 px-4 py-3 text-sm font-medium text-background transition hover:bg-background/10">Explore AI & voice <span aria-hidden="true">↗</span></a>
          </div>
        </article>
      </section>

      <section className="rounded-md border border-border bg-card p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-medium">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Organization-scoped audit activity.</p></div><a href="/activity" className="text-xs font-semibold underline decoration-border underline-offset-4">View all ↗</a></div>
        <div className="mt-5 divide-y divide-border">
          {!data ? <div className="py-8 text-sm text-muted-foreground">Loading persisted activity…</div> : data.activity.length === 0 ? <div className="py-8 text-sm text-muted-foreground">No activity has been recorded yet.</div> : data.activity.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="mt-1.5 size-1.5 rounded-full bg-success"/><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div></div><time className="pl-4 text-[11px] text-muted-foreground sm:shrink-0">{new Date(item.createdAt).toLocaleString()}</time></div>)}
        </div>
      </section>
      <footer className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground sm:flex-row"><span>Comms Agent · AI-native communications workspace</span><span>Actions remain permissioned and auditable.</span></footer>
    </div>
  </main>;
}
