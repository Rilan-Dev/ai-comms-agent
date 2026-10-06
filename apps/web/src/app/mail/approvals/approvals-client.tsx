"use client";

import { useEffect, useState } from "react";

type Action = { id: string; actionType: string; emailAccountId: string; draftId: string | null; recipientSnapshot: Record<string, unknown>; requestedAt: string; expiresAt: string | null };

export function ApprovalsClient({ organizationId }: { organizationId: string }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/mail/approvals?organizationId=" + encodeURIComponent(organizationId), { cache: "no-store" });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not load approvals.");
      setActions(d.actions ?? []);
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not load approvals."); } finally { setBusy(false); }
  }
  useEffect(() => { void load(); const timer = setInterval(() => { void load(); }, 5000); return () => clearInterval(timer); }, [organizationId]);

  async function decide(actionId: string, decision: "approved" | "rejected") {
    setBusy(true); setNotice(null);
    try {
      const r = await fetch("/api/mail/actions", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ organizationId, actionId, decision }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.message ?? "Could not update approval.");
      setActions(current => current.filter(a => a.id !== actionId));
      setNotice(decision === "approved" ? "Approved. The worker will execute the provider action using server-side credentials." : "Rejected. No provider action was executed.");
    } catch (e) { setNotice(e instanceof Error ? e.message : "Could not update approval."); } finally { setBusy(false); }
  }

  return <main className="min-h-full bg-muted/20 p-5 sm:p-7 lg:p-9"><div className="mx-auto max-w-5xl">
    <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">Mail</p><h1 className="mt-2 text-3xl font-semibold">Approval queue</h1><p className="mt-2 text-sm text-muted-foreground">Sensitive send, reply and forward requests. Approval never exposes provider credentials to the browser.</p></div><button type="button" onClick={()=>void load()} disabled={busy} className="rounded-xl border bg-background px-4 py-2.5 text-sm font-semibold disabled:opacity-50">Refresh</button></div>
    {notice && <div role="status" className="mt-5 rounded-xl border bg-background px-4 py-3 text-sm">{notice}</div>}
    {actions.length === 0 ? <div className="mt-6 rounded-3xl border bg-background p-10 text-center"><h2 className="font-semibold">Nothing waiting for approval</h2><p className="mt-2 text-sm text-muted-foreground">New sensitive email actions will appear here.</p></div> :
      <div className="mt-6 space-y-3">{actions.map(a => { const s=a.recipientSnapshot; const recipients=Array.isArray(s.to)?s.to.map(String).join(", "):"No recipients"; return <article key={a.id} className="rounded-3xl border bg-background p-5 shadow-sm"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{a.actionType.replace("_"," ")}</p><h2 className="mt-1 font-semibold">{String(s.subject ?? "(No subject)")}</h2><p className="mt-1 text-sm text-muted-foreground">To: {recipients}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(a.requestedAt).toLocaleString()}</p></div><div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>void decide(a.id,"rejected")} className="rounded-xl border px-4 py-2 text-sm font-semibold">Reject</button><button type="button" disabled={busy} onClick={()=>void decide(a.id,"approved")} className="rounded-xl bg-foreground px-4 py-2 text-sm font-semibold text-background">Approve</button></div></div><p className="mt-4 whitespace-pre-wrap rounded-2xl bg-muted/50 p-4 text-sm leading-6">{String(s.bodyText ?? "No body preview available.")}</p></article>})}</div>}
  </div></main>;
}
