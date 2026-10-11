"use client";

import { useMemo, useState } from "react";

type Agent = { id: string; name: string; status: string };
type Schedule = { id: string; agentId: string; name: string; cron: string | null; oneFireAt: string | null; intent: string; status: string; timezone: string; nextFireAt: string | null; lastError: string | null };

export default function SchedulesClient({ organizationId, initialSchedules, agents }: { organizationId: string; initialSchedules: Schedule[]; agents: Agent[] }) {
  const [rows, setRows] = useState(initialSchedules);
  const [form, setForm] = useState({ agentId: agents[0]?.id ?? "", name: "", intent: "scheduled_summarize", cron: "0 8 * * *", oneFireAt: "", timezone: "UTC", catchUpMinutes: 60 });
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const r = await fetch("/api/organizations/" + organizationId + "/schedules", { cache: "no-store" });
    const d = await r.json();
    if (r.ok) setRows(d.schedules ?? []);
  }
  async function create() {
    setBusy(true); setNotice("");
    try {
      const body = { ...form, cron: form.oneFireAt ? null : form.cron, oneFireAt: form.oneFireAt || null };
      const r = await fetch("/api/organizations/" + organizationId + "/schedules", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not create schedule.");
      setForm({ ...form, name: "", oneFireAt: "" }); setNotice("Schedule created."); await reload();
    } catch(e) { setNotice(e instanceof Error ? e.message : "Could not create schedule."); } finally { setBusy(false); }
  }
  async function archive(id: string) {
    setBusy(true);
    try { const r=await fetch("/api/organizations/"+organizationId+"/schedules?id="+encodeURIComponent(id),{method:"DELETE"}); if(!r.ok) throw new Error("Could not archive schedule."); await reload(); } catch(e){setNotice(e instanceof Error?e.message:"Could not archive schedule.");} finally{setBusy(false);}
  }
  const active = useMemo(() => rows.filter(r => r.status !== "archived"), [rows]);
  return <main className="mx-auto max-w-[1200px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
    <header><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Automation workspace</p><h1 className="font-display text-3xl font-medium tracking-tight">Schedules<span className="text-tertiary">.</span></h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">Durable, organization-scoped schedules with explicit timezone and missed-fire grace.</p></header>
    {notice && <div role="status" className="rounded-md border bg-background px-4 py-3 text-sm">{notice}</div>}
    <section className="rounded-md border border-border bg-card p-5"><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-6">
      <input aria-label="Schedule name" className="h-10 rounded-md border bg-background px-3 text-sm lg:col-span-2" placeholder="Schedule name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})}/>
      <select aria-label="Agent" className="h-10 rounded-md border bg-background px-3 text-sm" value={form.agentId} onChange={e=>setForm({...form,agentId:e.target.value})}>{agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
      <input className="h-10 rounded-md border bg-background px-3 text-sm" value={form.cron} onChange={e=>setForm({...form,cron:e.target.value})} disabled={Boolean(form.oneFireAt)} aria-label="Cron expression"/>
      <input className="h-10 rounded-md border bg-background px-3 text-sm" type="datetime-local" value={form.oneFireAt} onChange={e=>setForm({...form,oneFireAt:e.target.value})} aria-label="One-time fire time"/>
      <button disabled={busy||!form.agentId||!form.name} onClick={()=>void create()} className="h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">Create</button>
    </div><p className="mt-3 text-xs text-muted-foreground">Use cron for recurring schedules or choose a one-time fire time. Worker dispatch is separate from this persistence UI.</p></section>
    <section className="grid gap-3">{active.map(row=><article key={row.id} className="rounded-md border border-border bg-card p-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.cron ? "Cron · "+row.cron : "One-time · "+row.oneFireAt} · {row.timezone} · {row.intent}</p></div><span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold">{row.status}</span><button disabled={busy} onClick={()=>void archive(row.id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary">Archive</button></div>{row.lastError && <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{row.lastError}</p>}</article>)}{active.length===0&&<div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No schedules yet. Create the first durable schedule above.</div>}</section>
  </main>;
}
