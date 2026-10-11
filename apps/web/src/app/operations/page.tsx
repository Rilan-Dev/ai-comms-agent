"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Database,
  HardDrive,
  RefreshCw,
  Server,
  ShieldAlert,
  Workflow,
  XCircle,
} from "lucide-react";

type CheckStatus = "healthy" | "degraded" | "not_configured";
type SystemCheck = { status: CheckStatus; detail: string };
type OperationsPayload = {
  generatedAt: string;
  checks: Record<string, SystemCheck>;
  metrics: Record<string, number>;
};

const labels: Record<string, string> = {
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

const descriptions: Record<string, string> = {
  postgres: "Database query result",
  redis: "Worker lease dependency",
  rabbitmq: "Email sync queue dependency",
  qdrant: "Vector retrieval dependency",
};

function displayStatus(check: SystemCheck) {
  if (check.status === "degraded") return { label: "Degraded", icon: ShieldAlert, className: "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" };
  if (check.status === "not_configured") return { label: "Not configured", icon: XCircle, className: "border-border bg-secondary text-muted-foreground", dot: "bg-muted-foreground/50" };
  if (/runtime connectivity is worker-owned/i.test(check.detail)) {
    return { label: "Configured", icon: Clock3, className: "border-border bg-secondary text-secondary-foreground", dot: "bg-muted-foreground/60" };
  }
  return { label: "Healthy", icon: CheckCircle2, className: "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" };
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString();
}

export default function OperationsPage() {
  const [data, setData] = useState<OperationsPayload | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/operations", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Operations status could not be loaded.");
      if (!body.checks || typeof body.checks !== "object" || !body.metrics || typeof body.metrics !== "object") {
        throw new Error("The operations service returned an unexpected response.");
      }
      setData(body as OperationsPayload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Operations status could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const degradedCount = useMemo(() => Object.values(data?.checks ?? {}).filter((check) => check.status === "degraded").length, [data]);
  const notConfiguredCount = useMemo(() => Object.values(data?.checks ?? {}).filter((check) => check.status === "not_configured").length, [data]);

  return (
    <main className="mx-auto max-w-[1200px] space-y-7 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><Activity size={14} className="text-primary" /> Operations workspace</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">System health<span className="text-tertiary">.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Configuration checks and persisted runtime signals for the active organization. A configured dependency is not automatically a live connectivity pass.</p>
        </div>
        <button type="button" onClick={() => void load(true)} disabled={loading || refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-semibold">Operations status unavailable</p><p className="mt-1">{error}</p><button type="button" onClick={() => void load(true)} className="mt-2 font-semibold underline underline-offset-4">Try again</button></div></div> : null}

      <section aria-label="Infrastructure status" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {loading && !data ? [1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-md bg-muted" />) : null}
        {Object.entries(data?.checks ?? {}).map(([key, check]) => {
          const status = displayStatus(check);
          const StatusIcon = status.icon;
          const DependencyIcon = key === "postgres" ? Database : key === "qdrant" ? HardDrive : key === "rabbitmq" ? Workflow : Server;
          return (
            <article key={key} className="rounded-md border border-border bg-card p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><DependencyIcon size={17} /></span>
                <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold ${status.className}`}><StatusIcon size={12} />{status.label}</span>
              </div>
              <h2 className="mt-4 text-sm font-semibold">{labels[key] ?? key}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 text-muted-foreground">{check.detail}</p>
              <p className="mt-3 text-[10px] uppercase tracking-[.12em] text-muted-foreground">{descriptions[key] ?? "System signal"}</p>
            </article>
          );
        })}
        {!loading && !error && !Object.keys(data?.checks ?? {}).length ? <div className="col-span-full rounded-md border border-border bg-card p-8 text-center text-sm text-muted-foreground">No infrastructure checks were returned.</div> : null}
      </section>

      {data ? <section aria-label="Operations summary" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Degraded checks</p><p className="mt-2 font-display text-2xl font-medium tabular-nums">{degradedCount}</p></div>
        <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Not configured</p><p className="mt-2 font-display text-2xl font-medium tabular-nums">{notConfiguredCount}</p></div>
        <div className="rounded-md border border-border bg-card p-4"><p className="text-xs text-muted-foreground">Last updated</p><p className="mt-2 text-sm font-semibold">{formatTimestamp(data.generatedAt)}</p></div>
      </section> : null}

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center gap-3 border-b border-border p-5">
          <span className="flex size-9 items-center justify-center rounded-md bg-secondary text-secondary-foreground"><Activity size={17} /></span>
          <div><h2 className="text-sm font-semibold">Runtime signals</h2><p className="mt-1 text-xs text-muted-foreground">Persisted counters for the current organization, based on the API response.</p></div>
        </div>
        {loading && !data ? <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-20 animate-pulse rounded-md bg-muted" />)}</div> : !error && data ? (
          Object.keys(data.metrics).length ? <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(data.metrics).map(([key, value]) => <article key={key} className="rounded-md border border-border bg-background p-4"><p className="text-xs leading-5 text-muted-foreground">{labels[key] ?? key}</p><p className="mt-2 font-display text-2xl font-medium tabular-nums">{value.toLocaleString()}</p></article>)}
          </div> : <p className="p-8 text-center text-sm text-muted-foreground">No runtime metrics were returned.</p>
        ) : <p className="p-8 text-center text-sm text-muted-foreground">Runtime signals are unavailable until the operations endpoint responds.</p>}
      </section>

      {data ? <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><Clock3 size={14} className="mt-0.5 shrink-0" /> Dependency URLs reported as configured are informational only; Redis, RabbitMQ and Qdrant connectivity is verified by their runtime workers, not by this page. Last response: {formatTimestamp(data.generatedAt)}.</p> : null}
    </main>
  );
}
