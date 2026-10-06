"use client";

import { useEffect, useState } from "react";

type Overview = {
  metrics: Record<string,number>;
  activity: { id:string; title:string; detail:string; createdAt:string }[];
};

const metricMeta = [
  ["unread_mail","Unread mail","bg-sky-500"],
  ["action_required","Needs action","bg-amber-500"],
  ["pending_approvals","Pending approvals","bg-rose-500"],
  ["active_agents","Active agents","bg-violet-500"],
] as const;

export default function HomePage() {
  const [data,setData] = useState<Overview|null>(null);
  const [error,setError] = useState("");

  useEffect(() => {
    void fetch("/api/overview").then(async r => {
      const body = await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(body.message ?? "Overview could not be loaded.");
      setData(body);
    }).catch(e => setError(e instanceof Error ? e.message : "Overview could not be loaded."));
  },[]);

  const metric = (key:string) => data?.metrics[key] ?? 0;

  return <div className="min-h-full bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,.10),transparent_32%),radial-gradient(circle_at_20%_20%,rgba(14,165,233,.07),transparent_28%)]">
    <main className="mx-auto max-w-[1500px] space-y-8 p-5 sm:p-7 lg:p-9">
      <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className={"h-1.5 w-1.5 rounded-full "+(error ? "bg-amber-500" : "bg-emerald-500")} />
            {error ? "Configuration required" : "Persisted workspace"}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Communications command center.</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">One workspace for your agents, mail, messaging, automation, knowledge and realtime AI.</p>
        </div>
        <a href="/agents/new" className="inline-flex h-11 items-center justify-center rounded-xl bg-foreground px-5 text-sm font-semibold text-background shadow-sm transition hover:-translate-y-0.5">+ Create agent</a>
      </section>

      {error ? <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-5 text-sm text-amber-800">{error} Connect PostgreSQL and an organization context to load live workspace state.</div> : null}

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metricMeta.map(([key,label,dot]) => <div key={key} className="rounded-2xl border bg-background/90 p-5 shadow-[0_8px_30px_rgba(15,23,42,.04)]">
          <div className="flex items-center justify-between"><span className="text-sm text-muted-foreground">{label}</span><span className={"h-2 w-2 rounded-full "+dot}/></div>
          <p className="mt-4 text-3xl font-semibold tracking-tight">{data ? metric(key) : "—"}</p>
        </div>)}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-2xl border bg-background/90 p-6">
          <div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Workspace snapshot</p><p className="mt-1 text-xs text-muted-foreground">Persisted state from your organization.</p></div><a href="/operations" className="text-xs font-semibold text-primary hover:underline">Operations →</a></div>
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {[
              ["Active automations",metric("active_automations")],
              ["Active voice sessions",metric("active_voice_sessions")],
              ["Pending approvals",metric("pending_approvals")],
            ].map(([label,value]) => <div key={String(label)} className="rounded-xl bg-muted/60 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-semibold">{data ? value : "—"}</p></div>)}
          </div>
          <div className="mt-5 rounded-xl border p-4"><p className="text-sm font-medium">Clara workspace</p><p className="mt-2 text-sm leading-6 text-muted-foreground">Use Chat or AI & Voice for agent conversations. Provider and knowledge configuration stays server-side and reports honestly when setup is incomplete.</p></div>
        </div>

        <div className="rounded-2xl border bg-foreground p-6 text-background shadow-[0_12px_40px_rgba(15,23,42,.14)]">
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-background/60">Ask Clara</p>
          <p className="mt-7 text-xl font-medium leading-8">Review your inbox, actions, schedules and connected channels from one conversation.</p>
          <a href="/chat" className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-background px-4 py-3 text-sm font-semibold text-foreground">Open chat</a>
        </div>
      </section>

      <section className="rounded-2xl border bg-background/90 p-6">
        <div className="flex items-center justify-between"><div><p className="text-sm font-semibold">Recent activity</p><p className="mt-1 text-xs text-muted-foreground">Persisted audit events from your organization.</p></div><a href="/activity" className="text-xs font-semibold text-primary hover:underline">View all →</a></div>
        <div className="mt-5 divide-y">
          {!data ? <div className="py-8 text-sm text-muted-foreground">Loading persisted activity…</div> :
            data.activity.length === 0 ? <div className="py-8 text-sm text-muted-foreground">No activity has been recorded yet.</div> :
            data.activity.map(item => <div key={item.id} className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-medium">{item.title}</p><p className="mt-1 text-xs text-muted-foreground">{item.detail}</p></div><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></div>)}
        </div>
      </section>
    </main>
  </div>;
}
