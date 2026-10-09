"use client";

import { useEffect, useState } from "react";

type Payload = {
  generatedAt: string;
  checks: Record<string,{status:"healthy"|"degraded"|"not_configured";detail:string}>;
  metrics: Record<string,number>;
};

const labels: Record<string,string> = {
  postgres: "PostgreSQL",
  redis: "Redis",
  rabbitmq: "RabbitMQ",
  qdrant: "Qdrant",
  email_errors_24h: "Email account errors · 24h",
  sync_failures_24h: "Sync failures · 24h",
  active_voice_sessions: "Active voice sessions",
  scheduled_errors: "Scheduled jobs in error",
  denied_audits_24h: "Denied authorization events · 24h",
};

export default function OperationsPage() {
  const [data,setData] = useState<Payload|null>(null);
  const [error,setError] = useState("");
  const [loading,setLoading] = useState(true);

  const load = () => {
    setLoading(true); setError("");
    void fetch("/api/operations").then(async r => {
      const body = await r.json().catch(() => ({}));
      if(!r.ok) throw new Error(body.message ?? "Operations status could not be loaded.");
      setData(body);
    }).catch(e => setError(e instanceof Error ? e.message : "Operations status could not be loaded."))
      .finally(() => setLoading(false));
  };

  useEffect(load,[]);

  const statusClass = (status:string) =>
    status === "healthy" ? "bg-emerald-500" : status === "degraded" ? "bg-amber-500" : "bg-muted-foreground/40";

  return <main className="mx-auto max-w-[1200px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operations</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">System health<span className="text-tertiary">.</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">Organization-scoped infrastructure configuration and persisted runtime signals. No synthetic health states are shown.</p>
      </div>
      <button type="button" onClick={load} disabled={loading} className="h-10 rounded-xl border px-4 text-sm font-medium hover:bg-muted disabled:opacity-50">{loading ? "Refreshing…" : "Refresh"}</button>
    </header>

    {error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Object.entries(data?.checks ?? {}).map(([key,check]) => <div key={key} className="rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-2"><span className={"h-2 w-2 rounded-full "+statusClass(check.status)} /><span className="text-sm font-semibold">{labels[key] ?? key}</span></div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{check.detail}</p>
        <p className="mt-3 text-[11px] font-semibold uppercase tracking-[.12em] text-muted-foreground">{check.status.replace("_"," ")}</p>
      </div>)}
      {loading && !data ? [1,2,3,4].map(i=><div key={i} className="h-32 animate-pulse rounded-md bg-secondary"/>) : null}
    </section>

    <section className="rounded-md border border-border bg-card p-6">
      <div><p className="text-sm font-semibold">Runtime signals</p><p className="mt-1 text-xs text-muted-foreground">Persisted signals from the current organization; refresh to update.</p></div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {Object.entries(data?.metrics ?? {}).map(([key,value]) => <div key={key} className="rounded-xl bg-muted/50 p-4"><p className="text-xs text-muted-foreground">{labels[key] ?? key}</p><p className="mt-2 text-2xl font-semibold">{value}</p></div>)}
      </div>
    </section>

    {data ? <p className="text-xs text-muted-foreground">Updated {new Date(data.generatedAt).toLocaleString()} · Worker-owned dependencies report configuration here; connectivity is verified by their runtime workers.</p> : null}
  </main>;
}
