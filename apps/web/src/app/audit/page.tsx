"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  Download,
  FileSearch,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";

type AuditEvent = {
  id: string;
  eventType: string;
  targetType: string | null;
  targetId: string | null;
  action: string | null;
  decision: string | null;
  createdAt: string;
  actorUserId: string | null;
};

function decisionStyle(decision: string | null) {
  const value = (decision ?? "recorded").toLowerCase();
  if (["allowed", "approved", "success"].includes(value)) return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (["denied", "rejected", "failed"].includes(value)) return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-border bg-secondary text-secondary-foreground";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString();
}

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [decision, setDecision] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("search", query.trim());
    if (eventType.trim()) params.set("eventType", eventType.trim());
    if (decision) params.set("decision", decision);
    setLoading(true);
    setError("");
    void fetch("/api/audit?" + params.toString(), { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "Audit history could not be loaded.");
        if (!Array.isArray(body.events)) throw new Error("The audit service returned an unexpected response.");
        setEvents(body.events as AuditEvent[]);
      })
      .catch((cause) => {
        if (cause instanceof Error && cause.name === "AbortError") return;
        setError(cause instanceof Error ? cause.message : "Audit history could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => controller.abort();
  }, [query, eventType, decision, reloadKey]);

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams({ format: "csv" });
    if (query.trim()) params.set("search", query.trim());
    if (eventType.trim()) params.set("eventType", eventType.trim());
    if (decision) params.set("decision", decision);
    return params.toString();
  }, [query, eventType, decision]);

  const exportJsonQuery = useMemo(() => exportQuery.replace("format=csv", "format=json"), [exportQuery]);

  return (
    <main className="mx-auto max-w-[1200px] space-y-7 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><ShieldCheck size={14} className="text-primary" /> Security & governance</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Audit<span className="text-tertiary">.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Organization-scoped security and configuration events from PostgreSQL. Exported records retain the API&apos;s authorization boundary.</p>
        </div>
        <button type="button" onClick={() => { setRefreshing(true); setReloadKey((value) => value + 1); }} disabled={loading || refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      <section className="rounded-md border border-border bg-card p-4 sm:p-5">
        <div className="mb-4 flex items-center gap-2"><FileSearch size={16} className="text-muted-foreground" /><h2 className="text-sm font-semibold">Find audit events</h2></div>
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(150px,.45fr)_160px]">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <label htmlFor="audit-search" className="sr-only">Search audit events</label>
            <input id="audit-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search event, action or target…" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="audit-event-type" className="sr-only">Event type</label>
            <input id="audit-event-type" value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Event type" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </div>
          <div>
            <label htmlFor="audit-decision" className="sr-only">Decision</label>
            <select id="audit-decision" value={decision} onChange={(event) => setDecision(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All decisions</option><option value="allowed">Allowed</option><option value="denied">Denied</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="recorded">Recorded</option><option value="failed">Failed</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">{loading ? "Loading audit events…" : error ? "Results unavailable" : `Showing ${events.length} matching event${events.length === 1 ? "" : "s"}`}</p>
          <div className="flex flex-wrap gap-2">
            <a href={"/api/audit/export?" + exportQuery} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary"><Download size={14} /> Export CSV</a>
            <a href={"/api/audit/export?" + exportJsonQuery} className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border px-3 text-xs font-medium transition-colors hover:bg-secondary"><Download size={14} /> Export JSON</a>
          </div>
        </div>
      </section>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" /><div><p className="font-semibold">Audit history unavailable</p><p className="mt-1">{error}</p><button type="button" onClick={() => { setRefreshing(true); setReloadKey((value) => value + 1); }} className="mt-2 font-semibold underline underline-offset-4">Try again</button></div></div> : null}

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div><h2 className="text-sm font-semibold">Audit history</h2><p className="mt-1 text-xs text-muted-foreground">Latest 100 matching organization events</p></div>
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">{loading ? "…" : events.length + " events"}</span>
        </div>
        {loading ? <div className="space-y-3 p-5" aria-label="Loading audit history">{[1, 2, 3, 4].map((item) => <div key={item} className="h-14 animate-pulse rounded-md bg-muted" />)}</div> : !error && events.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground"><FileSearch size={18} /></span>
            <h3 className="mt-4 text-sm font-semibold">{query || eventType || decision ? "No events match these filters" : "No audit events recorded yet"}</h3>
            <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{query || eventType || decision ? "Try a broader search or clear the filters." : "Security and configuration events will appear here when the application records them."}</p>
            {query || eventType || decision ? <button type="button" onClick={() => { setQuery(""); setEventType(""); setDecision(""); }} className="mt-4 text-xs font-semibold underline underline-offset-4">Clear filters</button> : null}
          </div>
        ) : !error ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-border bg-secondary/40 text-[10px] font-semibold uppercase tracking-[.12em] text-muted-foreground">
                <tr><th scope="col" className="px-5 py-3">Time</th><th scope="col" className="px-5 py-3">Event</th><th scope="col" className="px-5 py-3">Target</th><th scope="col" className="px-5 py-3">Decision</th><th scope="col" className="px-5 py-3">Actor</th></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {events.map((event) => (
                  <tr key={event.id} className="transition-colors hover:bg-secondary/30">
                    <td className="whitespace-nowrap px-5 py-4 text-xs text-muted-foreground"><time dateTime={event.createdAt}>{formatTimestamp(event.createdAt)}</time></td>
                    <td className="px-5 py-4"><p className="font-medium">{event.eventType}</p><p className="mt-1 text-xs text-muted-foreground">{event.action ?? "—"}</p></td>
                    <td className="px-5 py-4 text-xs text-muted-foreground">{event.targetType ?? "—"}{event.targetId ? ` · ${event.targetId.slice(0, 10)}…` : ""}</td>
                    <td className="px-5 py-4"><span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${decisionStyle(event.decision)}`}>{event.decision ?? "recorded"}</span></td>
                    <td className="px-5 py-4 font-mono text-xs text-muted-foreground">{event.actorUserId ? event.actorUserId.slice(0, 12) + "…" : "system"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
