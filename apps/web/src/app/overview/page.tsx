"use client";
import Link from "next/link";

import { useEffect, useState } from "react";
import {AutomaticCatchUp} from './automatic-catch-up';

type Overview = {
  organizationId: string;
  catchUpAvailable: boolean;
  metrics: Record<string, number | null>;
  activity: { id: string; title: string; detail: string; createdAt: string }[] | null;
};

const metricMeta = [
  { key: "unread_mail", label: "Unread messages", icon: "mail", tone: "workspace-stat-icon" },
  { key: "action_required", label: "Needs attention", icon: "inbox", tone: "workspace-stat-icon" },
  { key: "pending_approvals", label: "Pending approvals", icon: "shield", tone: "workspace-stat-icon" },
  { key: "active_agents", label: "Active agents", icon: "bot", tone: "workspace-stat-icon" },
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

  const metric = (key: string) => data?.metrics[key] == null ? "Access restricted" : data.metrics[key];

  return <main className="min-h-full bg-background">
    <div className="mx-auto max-w-[1500px] space-y-5 px-4 py-5 sm:px-7 sm:py-7 lg:px-9">
      {data?.catchUpAvailable&&data.organizationId&&<AutomaticCatchUp key={data.organizationId} organizationId={data.organizationId}/>}
      <section className="workspace-hero min-h-[245px] p-6 sm:p-8" aria-labelledby="overview-heading">
        <svg className="botanical-leaves pointer-events-none absolute -bottom-7 -right-6 hidden h-[260px] w-[320px] sm:block" viewBox="0 0 320 280" aria-hidden="true" fill="none">
          <path d="M162 289C165 203 215 121 281 8M181 228C123 170 98 119 86 37M193 212C250 178 273 131 301 101M209 154C200 111 196 68 209 31" stroke="currentColor" strokeWidth="3" strokeLinecap="round" opacity=".52"/>
          <path d="M283 14C212 27 194 77 220 115C258 100 285 71 283 14Z" fill="currentColor" opacity=".8"/>
          <path d="M86 37C63 100 105 153 143 165C157 112 126 69 86 37Z" fill="currentColor" opacity=".58"/>
          <path d="M304 99C239 104 216 147 228 181C269 174 300 140 304 99Z" fill="currentColor" opacity=".7"/>
          <path d="M211 34C173 64 175 110 202 135C228 105 225 64 211 34Z" fill="currentColor" opacity=".65"/>
          <path d="M278 154C226 149 202 188 210 225C252 222 271 191 278 154Z" fill="currentColor" opacity=".55"/>
          <path d="M118 151C78 183 95 219 131 238C160 213 152 174 118 151Z" fill="currentColor" opacity=".46"/>
        </svg>
        <div className="relative z-10 max-w-[640px]">
          <p className="hero-subtitle flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.16em]">
            <span className="size-2 rounded-full bg-success" aria-hidden="true" />
            {error ? "Configuration required" : data ? "Your communications workspace" : "Loading workspace"}
          </p>
          <h1 id="overview-heading" className="hero-title mt-5 max-w-[620px] text-3xl sm:text-[42px] lg:text-[47px]">Your AI communications<br/>team is on duty.</h1>
          <p className="hero-subtitle mt-5 max-w-[525px] text-sm leading-6">Manage email, WhatsApp and scheduled workflows in one secure workspace — so you can focus on what matters.</p>
        </div>
      </section>
      <nav className="flex flex-wrap gap-2" aria-label="Quick workspace actions">
        <a href="/chat" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:opacity-85">✳ Open AI chat ↗</a>
        <a href="/mail/inbox" className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition hover:bg-secondary">✉ Review inbox</a>
        <a href="/scheduled" className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition hover:bg-secondary">▦ Schedule tasks</a>
        <a href="/agents/new" className="inline-flex min-h-10 items-center gap-2 rounded-xl border bg-card px-4 text-sm font-medium transition hover:bg-secondary">＋ Create agent</a>
      </nav>

      {error && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800"><p className="font-semibold">Workspace data unavailable</p><p className="mt-1 leading-6">{error} Connect PostgreSQL and an authenticated organization context to load live workspace state.</p></div>}

      <p className="text-xs leading-5 text-muted-foreground">Workspace metrics are organization-wide, permission-scoped counts. Opening this page does not mark messages as read.</p>

      <section aria-label="Workspace metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metricMeta.map((item) => <article key={item.key} className="workspace-panel min-w-0 p-5 transition-colors hover:bg-secondary/20">
          <div className="flex items-start justify-between gap-3"><p className="text-[13px] font-medium text-muted-foreground">{item.label}</p><span className="workspace-stat-icon grid size-9 shrink-0 place-items-center rounded-xl" data-tone={item.key === "action_required" ? "attention" : item.key === "pending_approvals" ? "approval" : "normal"}><MetricIcon name={item.icon}/></span></div>
          <p className="mt-4 font-display text-4xl font-semibold tracking-tight tabular-nums">{data ? metric(item.key) : "—"}</p>
          <p className="mt-2 text-[11px] text-muted-foreground">{!data ? "Waiting for persisted data" : data.metrics[item.key] == null ? "Requires access" : "From your organization"}</p>
        </article>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]">
        <article className="workspace-panel p-5 sm:p-7">
          <div className="flex items-start justify-between gap-4"><div><p className="font-display text-xl font-semibold">Workspace snapshot</p><p className="mt-1 text-xs text-muted-foreground">A live view of work in progress.</p></div><a href="/operations" className="shrink-0 text-xs font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">Operations ↗</a></div>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Active scheduled tasks", key: "active_automations", href: "/scheduled" },
              { label: "Active voice sessions", key: "active_voice_sessions", href: "/ai-voice" },
              { label: "Pending approvals", key: "pending_approvals", href: "/mail/drafts" },
            ].map((item) => <a key={item.key} href={item.href} className="rounded-xl bg-secondary/70 p-4 transition hover:bg-secondary"><p className="text-xs text-muted-foreground">{item.label}</p><p className="mt-3 font-display text-2xl font-medium">{data ? metric(item.key) : "—"}</p><p className="mt-2 text-[10px] text-muted-foreground">{data?.metrics[item.key] == null && data ? "Requires access" : "View details ↗"}</p></a>)}
          </div>
          <div className="mt-5 flex items-start gap-3 rounded-xl border border-border p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent text-accent-foreground"><span aria-hidden="true">✳</span></span><div><p className="text-sm font-semibold">AI intelligence</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Ask about your connected mail and work across channels. Provider or knowledge configuration gaps are surfaced rather than simulated.</p><a href="/chat" className="mt-3 inline-flex text-xs font-semibold underline decoration-border underline-offset-4">Start a conversation ↗</a></div></div>
        </article>

        <article className="workspace-panel p-5 sm:p-7">
          <div className="flex items-center justify-between gap-3"><h2 className="font-display text-xl font-semibold">System status</h2><a href="/operations" className="text-xs font-semibold text-primary hover:underline">View live status ↗</a></div>
          <p className="mt-2 text-xs text-muted-foreground">Use Operations to verify real provider and runtime health.</p>
          <div className="mt-5 divide-y divide-border">
            {[
              { name: "Email and inbox", href: "/mail/inbox", icon: "✉" },
              { name: "WhatsApp messaging", href: "/whatsapp", icon: "◉" },
              { name: "AI agents", href: "/agents", icon: "✳" },
              { name: "Scheduled tasks", href: "/scheduled", icon: "▦" },
              { name: "Knowledge base", href: "/knowledge", icon: "▤" },
            ].map((item) => <a key={item.href} href={item.href} className="flex min-h-11 items-center justify-between gap-3 py-2 text-sm transition hover:text-primary"><span className="flex items-center gap-3"><span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-secondary text-primary">{item.icon}</span>{item.name}</span><span className="text-xs text-muted-foreground">View ↗</span></a>)}
          </div>
        </article>
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(300px,.8fr)]" aria-label="Activity and quick actions">
      <article className="workspace-panel p-5 sm:p-7">
        <div className="flex items-start justify-between gap-4"><div><h2 className="font-display text-xl font-semibold">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Organization-scoped audit activity.</p></div>{data?.activity !== null && <a href="/activity" className="text-xs font-semibold underline decoration-border underline-offset-4">View all ↗</a>}</div>
        <div className="mt-5 divide-y divide-border">
          {!data ? <div className="py-8 text-sm text-muted-foreground">Loading persisted activity…</div> : data.activity === null ? <div className="py-8 text-sm text-muted-foreground">Access restricted — audit.read permission is required for activity.</div> : data.activity.length === 0 ? <div className="py-8 text-sm text-muted-foreground">No activity has been recorded yet.</div> : data.activity.map((item) => <div key={item.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-start gap-3"><span className="mt-1.5 size-1.5 rounded-full bg-success"/><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div></div><time className="pl-4 text-[11px] text-muted-foreground sm:shrink-0">{new Date(item.createdAt).toLocaleString()}</time></div>)}
        </div>
      </article>
        <aside className="workspace-panel p-5 sm:p-7">
          <h2 className="font-display text-xl font-semibold">Quick actions</h2>
          <p className="mt-1 text-xs text-muted-foreground">Go straight to your next task.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {[
              { href: "/chat", icon: "✳", title: "Ask the assistant" },
              { href: "/whatsapp", icon: "◉", title: "WhatsApp" },
              { href: "/mail/drafts", icon: "✉", title: "Review drafts" },
              { href: "/scheduled", icon: "▦", title: "Scheduled tasks" },
            ].map(item => <a key={item.href} href={item.href} className="flex min-h-28 flex-col justify-between rounded-xl border bg-secondary/40 p-4 text-xs font-semibold transition hover:border-primary/50 hover:bg-accent/40"><span className="text-xl text-primary" aria-hidden="true">{item.icon}</span>{item.title}</a>)}
          </div>
        </aside>
      </section>
      <section aria-labelledby="start-here-title" className="rounded-xl border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Your daily command center</p>
            <h2 id="start-here-title" className="mt-2 font-display text-2xl font-medium">Start with what matters</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Check new conversations, ask your AI assistant for help, or set up a repeatable task. You stay in control of sending and approvals.</p>
          </div>
          <span className="w-fit rounded-xl bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground">Opening Overview does not mark messages as read or reviewed.</span>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          <article className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">01 · Check</p>
            <h3 className="mt-2 text-base font-semibold">Review your inbox</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Open the original messages and decide which ones deserve attention.</p>
            <a href="/mail/inbox" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">Open inbox ↗</a>
          </article>
          <article className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">02 · Ask</p>
            <h3 className="mt-2 text-base font-semibold">Ask the assistant</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Ask for a summary or help preparing a draft using the accounts and permissions available to you.</p>
            <a href="/chat" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold underline decoration-border underline-offset-4 hover:decoration-foreground">Open AI chat ↗</a>
          </article>
          <article className="rounded-lg border border-border p-4">
            <p className="text-xs font-semibold text-muted-foreground">03 · Plan</p>
            <h3 className="mt-2 text-base font-semibold">Plan a repeatable task</h3>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Manage existing scheduled jobs and event-triggered automations. New AI digest routines are not yet activated.</p>
            <div className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
              <a href="/routines/preview" className="inline-flex min-h-10 items-center underline decoration-border underline-offset-4 hover:decoration-foreground">Preview routine timing ↗</a>
              <a href="/scheduled" className="inline-flex min-h-10 items-center underline decoration-border underline-offset-4 hover:decoration-foreground">Scheduled AI agent ↗</a>
            </div>
          </article>
        </div>
        <div className="mt-4 rounded-lg border border-border bg-secondary/40 p-4">
          {!data ? (
            <p role="status" className="text-sm text-muted-foreground">{error ? "Private catch-up availability could not be checked. Please try again later." : "Checking private catch-up availability…"}</p>
          ) : data?.catchUpAvailable ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm leading-6"><strong>Choose a different window.</strong> Your automatic catch-up appears above. You can also review the last 5 days or choose another window.</p>
              <div className="flex flex-wrap gap-4">
                <a href="/catch-up?days=5" className="inline-flex min-h-10 shrink-0 items-center font-semibold text-sm underline underline-offset-4">Review last 5 days ↗</a>
                <a href="/catch-up" className="inline-flex min-h-10 shrink-0 items-center font-semibold text-sm underline underline-offset-4">Other catch-up windows ↗</a>
              </div>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground"><strong className="text-foreground">Private catch-up is not enabled yet.</strong> Continue with your inbox while source-grounded summaries and access checks are verified.</p>
          )}
        </div>
      </section>

      <footer className="flex flex-col justify-between gap-2 border-t border-border pt-4 text-[10px] text-muted-foreground sm:flex-row"><span>Comms Agent · AI-native communications workspace</span><span>Actions remain permissioned and auditable.</span></footer>
    </div>
  </main>;
}
