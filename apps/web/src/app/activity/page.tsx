"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity as ActivityIcon,
  AlertCircle,
  CheckCircle2,
  Clock3,
  Filter,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

type ActivityEvent = {
  id: string;
  eventType: string;
  action: string | null;
  decision: string | null;
  createdAt: string;
  actorUserId: string | null;
};

function decisionStyle(decision: string | null) {
  const value = (decision ?? "recorded").toLowerCase();
  if (value === "allowed" || value === "approved" || value === "success") {
    return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }
  if (value === "denied" || value === "rejected" || value === "failed") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }
  return "border-border bg-secondary text-secondary-foreground";
}

function formatTimestamp(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Timestamp unavailable" : date.toLocaleString();
}

export default function ActivityPage() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [decisionFilter, setDecisionFilter] = useState("all");

  const loadEvents = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/audit?limit=50", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Activity could not be loaded.");
      if (!Array.isArray(body.events)) throw new Error("The activity service returned an unexpected response.");
      setEvents(body.events as ActivityEvent[]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Activity could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadEvents(); }, [loadEvents]);

  const eventTypes = useMemo(
    () => [...new Set(events.map((event) => event.eventType))].sort((a, b) => a.localeCompare(b)),
    [events],
  );
  const filteredEvents = useMemo(() => events.filter((event) => {
    const eventMatches = eventFilter === "all" || event.eventType === eventFilter;
    const decisionMatches = decisionFilter === "all" || (event.decision ?? "recorded").toLowerCase() === decisionFilter;
    return eventMatches && decisionMatches;
  }), [events, eventFilter, decisionFilter]);

  return (
    <main className="mx-auto max-w-[1100px] space-y-7 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground"><ActivityIcon size={14} className="text-primary" /> Operations workspace</p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Activity<span className="text-tertiary">.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">A transparent timeline of persisted organization events. This feed never invents operational activity.</p>
        </div>
        <button type="button" onClick={() => void loadEvents(true)} disabled={loading || refreshing} className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60">
          <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section aria-label="Activity summary" className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Recent events</span><ActivityIcon size={15} /></div><p className="mt-3 font-display text-2xl font-medium tabular-nums">{loading ? "—" : events.length}</p><p className="mt-1 text-xs text-muted-foreground">Latest 50 persisted records</p></div>
        <div className="rounded-md border border-border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Allowed / successful</span><CheckCircle2 size={15} /></div><p className="mt-3 font-display text-2xl font-medium tabular-nums">{loading ? "—" : events.filter((event) => ["allowed", "approved", "success"].includes((event.decision ?? "").toLowerCase())).length}</p><p className="mt-1 text-xs text-muted-foreground">Based on recorded decision values</p></div>
        <div className="rounded-md border border-border bg-card p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Denied / rejected</span><ShieldCheck size={15} /></div><p className="mt-3 font-display text-2xl font-medium tabular-nums">{loading ? "—" : events.filter((event) => ["denied", "rejected", "failed"].includes((event.decision ?? "").toLowerCase())).length}</p><p className="mt-1 text-xs text-muted-foreground">Review these records in Audit</p></div>
      </section>

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="flex flex-col gap-4 border-b border-border p-5 sm:flex-row sm:items-center sm:justify-between">
          <div><h2 className="text-sm font-semibold">Recent activity</h2><p className="mt-1 text-xs text-muted-foreground">Newest organization events first</p></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor="activity-event-filter">Filter by event type</label>
            <select id="activity-event-filter" value={eventFilter} onChange={(event) => setEventFilter(event.target.value)} className="h-9 min-w-40 rounded-md border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">All event types</option>{eventTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </select>
            <label className="sr-only" htmlFor="activity-decision-filter">Filter by decision</label>
            <select id="activity-decision-filter" value={decisionFilter} onChange={(event) => setDecisionFilter(event.target.value)} className="h-9 min-w-36 rounded-md border border-border bg-background px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <option value="all">All decisions</option><option value="allowed">Allowed</option><option value="denied">Denied</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="recorded">Recorded</option><option value="failed">Failed</option>
            </select>
          </div>
        </div>

        {error ? <div role="alert" className="m-5 flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive"><AlertCircle size={17} className="mt-0.5 shrink-0" /><div className="min-w-0 flex-1"><p className="font-medium">Activity unavailable</p><p className="mt-1">{error}</p><button type="button" onClick={() => void loadEvents(true)} className="mt-2 font-semibold underline underline-offset-4">Try again</button></div></div> : null}

        {loading ? <div className="space-y-3 p-5" aria-label="Loading activity">{[1, 2, 3, 4].map((item) => <div key={item} className="h-16 animate-pulse rounded-md bg-muted" />)}</div> : !error && filteredEvents.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-12 text-center">
            <span className="flex size-11 items-center justify-center rounded-full bg-secondary text-muted-foreground"><Filter size={18} /></span>
            <h3 className="mt-4 text-sm font-semibold">{events.length ? "No events match these filters" : "No persisted activity yet"}</h3>
            <p className="mt-2 max-w-sm text-xs leading-5 text-muted-foreground">{events.length ? "Choose a different event type or decision to see more records." : "New organization events will appear here when they are recorded by the application."}</p>
            {events.length ? <button type="button" onClick={() => { setEventFilter("all"); setDecisionFilter("all"); }} className="mt-4 text-xs font-semibold underline underline-offset-4">Clear filters</button> : null}
          </div>
        ) : !error ? (
          <div className="divide-y divide-border">
            {filteredEvents.map((event) => (
              <article key={event.id} className="flex gap-3 p-4 transition-colors hover:bg-secondary/30 sm:gap-4 sm:p-5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground"><Clock3 size={16} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0"><p className="break-words text-sm font-semibold">{event.eventType}</p><p className="mt-1 text-xs text-muted-foreground">{event.action ?? "Event recorded"} · {event.actorUserId ? `Actor ${event.actorUserId.slice(0, 12)}…` : "System"}</p></div>
                    <span className={`inline-flex w-fit shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${decisionStyle(event.decision)}`}>{event.decision ?? "recorded"}</span>
                  </div>
                  <time dateTime={event.createdAt} className="mt-2 block text-[11px] text-muted-foreground">{formatTimestamp(event.createdAt)}</time>
                </div>
              </article>
            ))}
          </div>
        ) : null}
        {!loading && !error ? <div className="border-t border-border px-5 py-3 text-xs text-muted-foreground">Showing {filteredEvents.length} of {events.length} loaded events</div> : null}
      </section>
    </main>
  );
}
