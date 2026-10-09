"use client";

import { useEffect, useState } from "react";

type Event = { id:string; eventType:string; action:string|null; decision:string|null; createdAt:string; actorUserId:string|null };

export default function ActivityPage() {
  const [events,setEvents]=useState<Event[]>([]);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");

  useEffect(() => {
    void fetch("/api/audit?limit=50").then(async r => {
      const body=await r.json().catch(()=>({}));
      if(!r.ok) throw new Error(body.message ?? "Activity could not be loaded.");
      setEvents(body.events ?? []);
    }).catch(e=>setError(e instanceof Error ? e.message : "Activity could not be loaded.")).finally(()=>setLoading(false));
  },[]);

  return <main className="mx-auto max-w-[1100px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
    <header><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Operations workspace</p><h1 className="font-display text-3xl font-medium tracking-tight">Activity<span className="text-tertiary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Recent persisted organization events. This feed never invents operational activity.</p></header>
    {error ? <div className="rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">{error}</div> : null}
    <section className="rounded-md border border-border bg-card p-5">
      {loading ? <div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-16 animate-pulse rounded-xl bg-muted"/>)}</div> :
      events.length === 0 ? <div className="py-12 text-center text-sm text-muted-foreground">No persisted activity yet.</div> :
      <div className="space-y-2">{events.map(event=><div key={event.id} className="flex flex-col gap-2 rounded-md border border-border p-4 transition-colors hover:bg-secondary/40 sm:flex-row sm:items-center">
        <div className="flex-1"><p className="text-sm font-semibold">{event.eventType}</p><p className="mt-1 text-xs text-muted-foreground">{event.action ?? "recorded"} · {event.actorUserId ? event.actorUserId.slice(0,12)+"…" : "system"}</p></div>
        <div className="text-xs text-muted-foreground">{new Date(event.createdAt).toLocaleString()}</div>
        <span className="rounded-full border px-2.5 py-1 text-xs font-medium">{event.decision ?? "recorded"}</span>
      </div>)}</div>}
    </section>
  </main>;
}
