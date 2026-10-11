"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from "lucide-react";

type Event = {
  id: string;
  eventType: string;
  action: string | null;
  decision: string | null;
  createdAt: string;
  actorUserId: string | null;
  targetType?: string | null;
  targetId?: string | null;
};

function decisionIcon(decision: string | null) {
  if (decision === "allowed") return <CheckCircle2 className="h-4 w-4 text-emerald-600" />;
  if (decision === "denied") return <XCircle className="h-4 w-4 text-destructive" />;
  return <ActivityIcon className="h-4 w-4 text-muted-foreground" />;
}

function decisionClass(decision: string | null) {
  if (decision === "allowed") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (decision === "denied") return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export default function ActivityPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [decision, setDecision] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadEvents = useCallback(async (filters?: { search?: string; eventType?: string; decision?: string }, refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (filters?.search?.trim()) params.set("search", filters.search.trim());
      if (filters?.eventType?.trim()) params.set("eventType", filters.eventType.trim());
      if (filters?.decision) params.set("decision", filters.decision);
      const response = await fetch("/api/audit?" + params.toString(), { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Activity could not be loaded.");
      setEvents(body.events ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activity could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadEvents({ search: query, eventType, decision });
  }

  return (
    <main className="mx-auto max-w-[1180px] space-y-7 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><ActivityIcon className="h-3.5 w-3.5 text-primary" /> Operations workspace</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Activity<span className="text-tertiary">.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">Recent persisted organization events. This feed never invents operational activity and uses the existing audit authorization boundary.</p>
        </div>
        <button type="button" onClick={() => void loadEvents({ search: query, eventType, decision }, true)} disabled={loading || refreshing} className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-60 sm:self-auto">
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="rounded-md border border-border bg-card p-4 sm:p-5">
        <form onSubmit={applyFilters} className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(180px,0.7fr)_170px_auto]">
          <label className="relative block">
            <span className="sr-only">Search activity</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search events or actions…" className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label>
            <span className="sr-only">Event type</span>
            <input value={eventType} onChange={(event) => setEventType(event.target.value)} placeholder="Event type" className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label>
            <span className="sr-only">Decision</span>
            <select value={decision} onChange={(event) => setDecision(event.target.value)} className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="">All decisions</option><option value="allowed">Allowed</option><option value="denied">Denied</option><option value="recorded">Recorded</option>
            </select>
          </label>
          <button type="submit" disabled={loading} className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"><Filter className="h-4 w-4" /> Apply</button>
        </form>
      </section>

      {error ? <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="flex-1"><p className="font-medium">Activity unavailable</p><p className="mt-1">{error}</p></div><button type="button" onClick={() => void loadEvents({ search: query, eventType, decision }, true)} className="font-semibold underline underline-offset-4">Retry</button></div> : null}

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div><h2 className="text-sm font-semibold">Recent events</h2><p className="mt-1 text-xs text-muted-foreground">Security and configuration events persisted by the application</p></div>
          <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">{loading ? "Loading…" : `${events.length} events`}</span>
        </div>
        {loading ? (
          <div className="space-y-3 p-5">{[0,1,2,3].map((item) => <div key={item} className="h-[68px] animate-pulse rounded-md bg-muted" />)}</div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background"><Clock3 className="h-5 w-5 text-muted-foreground" /></div>
            <h3 className="mt-4 text-sm font-semibold">{query || eventType || decision ? "No matching activity" : "No persisted activity yet"}</h3>
            <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{query || eventType || decision ? "Try a broader search or clear one of the filters." : "Events will appear here when organization activity is recorded."}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {events.map((event) => (
              <article key={event.id} className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-secondary/30 sm:items-center">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background">{decisionIcon(event.decision)}</div>
                <div className="min-w-0 flex-1">
                  <p className="break-words text-sm font-semibold">{event.eventType}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{event.action ?? "Recorded"}{event.targetType ? ` · ${event.targetType}` : ""}{event.targetId ? ` · ${event.targetId.slice(0, 10)}…` : ""}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> {event.actorUserId ? `Actor ${event.actorUserId.slice(0, 12)}…` : "System event"}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span className={`rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${decisionClass(event.decision)}`}>{event.decision ?? "recorded"}</span>
                  <time dateTime={event.createdAt} className="text-right text-[11px] text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</time>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
