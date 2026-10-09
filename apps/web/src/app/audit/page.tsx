"use client";

import { useEffect, useState } from "react";

type Event = {
  id: string; eventType: string; targetType: string | null; targetId: string | null;
  action: string | null; decision: string | null; createdAt: string; actorUserId: string | null;
};

export default function AuditPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState("");
  const [decision, setDecision] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams({ limit: "100" });
    if (query.trim()) params.set("search", query.trim());
    if (eventType) params.set("eventType", eventType);
    if (decision) params.set("decision", decision);
    void fetch("/api/audit?" + params.toString())
      .then(async (response) => {
        const body = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(body.message ?? "Audit history could not be loaded.");
        setEvents(body.events ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Audit history could not be loaded."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = events;

  return (
    <main className="mx-auto max-w-[1200px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Operations</p>
        <h1 className="font-display text-3xl font-medium tracking-tight">Audit<span className="text-tertiary">.</span></h1>
        <p className="mt-2 text-sm text-muted-foreground">Organization-scoped security and configuration events from PostgreSQL. No synthetic activity is shown.</p>
      </header>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_160px_auto_auto]">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search event, action or target…" className="h-11 rounded-xl border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <input value={eventType} onChange={(e) => setEventType(e.target.value)} placeholder="Event type" className="h-11 rounded-xl border bg-background px-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
        <select value={decision} onChange={(e) => setDecision(e.target.value)} className="h-11 rounded-xl border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <option value="">All decisions</option><option value="allowed">Allowed</option><option value="denied">Denied</option><option value="recorded">Recorded</option>
        </select>
        <a href={"/api/audit/export?format=csv" + (query ? "&search=" + encodeURIComponent(query) : "") + (eventType ? "&eventType=" + encodeURIComponent(eventType) : "") + (decision ? "&decision=" + encodeURIComponent(decision) : "")} className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium hover:bg-muted">Export CSV</a>
        <a href={"/api/audit/export?format=json" + (query ? "&search=" + encodeURIComponent(query) : "") + (eventType ? "&eventType=" + encodeURIComponent(eventType) : "") + (decision ? "&decision=" + encodeURIComponent(decision) : "")} className="inline-flex h-11 items-center justify-center rounded-xl border px-4 text-sm font-medium hover:bg-muted">Export JSON</a>
      </div>
      <div className="text-xs text-muted-foreground">{loading ? "Loading audit events…" : `${filtered.length} events`}</div>

      {error ? <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}

      <section className="overflow-hidden rounded-md border border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b bg-muted/30 text-xs uppercase tracking-[.12em] text-muted-foreground">
              <tr><th className="px-4 py-3 font-medium">Time</th><th className="px-4 py-3 font-medium">Event</th><th className="px-4 py-3 font-medium">Target</th><th className="px-4 py-3 font-medium">Decision</th><th className="px-4 py-3 font-medium">Actor</th></tr>
            </thead>
            <tbody>
              {filtered.map((event) => (
                <tr key={event.id} className="border-b last:border-0">
                  <td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-4"><div className="font-medium">{event.eventType}</div><div className="mt-1 text-xs text-muted-foreground">{event.action ?? "—"}</div></td>
                  <td className="px-4 py-4 text-muted-foreground">{event.targetType ?? "—"}{event.targetId ? ` · ${event.targetId.slice(0, 10)}…` : ""}</td>
                  <td className="px-4 py-4"><span className="rounded-full border px-2.5 py-1 text-xs font-medium">{event.decision ?? "recorded"}</span></td>
                  <td className="px-4 py-4 font-mono text-xs text-muted-foreground">{event.actorUserId ? event.actorUserId.slice(0, 12) + "…" : "system"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && filtered.length === 0 ? <div className="p-10 text-center text-sm text-muted-foreground">{query || eventType || decision ? "No audit events match the current filters." : "No audit events have been recorded yet."}</div> : null}
        </div>
      </section>
    </main>
  );
}
