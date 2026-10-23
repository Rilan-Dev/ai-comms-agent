"use client";

import { useEffect, useRef, useState } from "react";
import { createApprovalQueueRefreshGuard } from "@/lib/mail/approval-queue-refresh";

type Action = { id: string; actionType: string; emailAccountId: string; draftId: string | null; recipientSnapshot: Record<string, unknown>; requestedAt: string; expiresAt: string | null };

export function ApprovalsClient({ organizationId }: { organizationId: string }) {
  const [actions, setActions] = useState<Action[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const guardRef = useRef(createApprovalQueueRefreshGuard());
  // Do not accept a second action before React commits decidingId.
  const decisionInFlightRef = useRef(false);
  const organizationRef = useRef(organizationId);
  organizationRef.current = organizationId;

  async function load({ silent = false }: { silent?: boolean } = {}) {
    if (decisionInFlightRef.current) return;
    const ticket = guardRef.current.begin();
    const requestedOrg = organizationId;
    if (!silent) {
      setLoading(true);
      setNotice(null);
    }
    try {
      const r = await fetch("/api/mail/approvals?organizationId=" + encodeURIComponent(requestedOrg), { cache: "no-store" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not load approvals.");
      if (!guardRef.current.isCurrent(ticket) || organizationRef.current !== requestedOrg) return;
      setActions(Array.isArray(d.actions) ? d.actions : []);
    } catch (e) {
      if (!silent && guardRef.current.isCurrent(ticket) && organizationRef.current === requestedOrg)
        setNotice(e instanceof Error ? e.message : "Could not load approvals.");
    } finally {
      if (!silent && guardRef.current.isCurrent(ticket) && organizationRef.current === requestedOrg)
        setLoading(false);
    }
  }

  useEffect(() => {
    guardRef.current.invalidate();
    setActions([]);
    void load();
    const timer = setInterval(() => { void load({ silent: true }); }, 5000);
    return () => { clearInterval(timer); guardRef.current.invalidate(); };
  }, [organizationId]);

  async function decide(actionId: string, decision: "approved" | "rejected") {
    if (decisionInFlightRef.current) return;
    decisionInFlightRef.current = true;
    // A GET already issued before a PATCH can contain the action still pending.
    // Invalidate it immediately; do not resurrect the item after approval.
    guardRef.current.invalidate();
    const requestedOrg = organizationId;
    setDecidingId(actionId);
    setNotice(null);
    try {
      const r = await fetch("/api/mail/actions", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId: requestedOrg, actionId, decision }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not update approval.");
      if (organizationRef.current !== requestedOrg) return;
      setActions(current => current.filter(a => a.id !== actionId));
      setNotice(decision === "approved"
        ? "Approved. The worker will execute the provider action using server-side credentials."
        : "Rejected. No provider action was executed.");
    } catch (e) {
      if (organizationRef.current === requestedOrg)
        setNotice(e instanceof Error ? e.message : "Could not update approval.");
    } finally {
      guardRef.current.invalidate();
      decisionInFlightRef.current = false;
      if (organizationRef.current === requestedOrg) {
        setDecidingId(null);
        // Confirm current server state after the mutation. Passive refresh
        // must not erase an approval decision notice.
        void load({ silent: true });
      }
    }
  }

  return <main className="min-h-full bg-background p-5 sm:p-7 lg:p-10"><div className="mx-auto max-w-5xl">
    <div className="flex items-end justify-between gap-4"><div><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Mail workspace</p><h1 className="font-display text-3xl font-medium">Approval queue<span className="text-tertiary">.</span></h1><p className="mt-2 text-sm text-muted-foreground">Sensitive send, reply and forward requests. Approval never exposes provider credentials to the browser.</p></div><button type="button" onClick={()=>void load()} disabled={loading || decidingId !== null} className="rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary disabled:opacity-50">Refresh</button></div>
    {notice && <div role="status" className="mt-5 rounded-md border border-border bg-card px-4 py-3 text-sm">{notice}</div>}
    {actions.length === 0 ? <div className="mt-8 rounded-md border border-border bg-card p-10 text-center"><h2 className="font-semibold">Nothing waiting for approval</h2><p className="mt-2 text-sm text-muted-foreground">New sensitive email actions will appear here.</p></div> :
      <div className="mt-8 space-y-3">{actions.map(a => { const s=a.recipientSnapshot; const recipients=Array.isArray(s.to)?s.to.map(String).join(", "):"No recipients"; return <article key={a.id} className="rounded-md border border-border bg-card p-5"><div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[.14em] text-muted-foreground">{a.actionType.replace("_"," ")}</p><h2 className="mt-1 font-semibold">{String(s.subject ?? "(No subject)")}</h2><p className="mt-1 text-sm text-muted-foreground">To: {recipients}</p><p className="mt-2 text-xs text-muted-foreground">{new Date(a.requestedAt).toLocaleString()}</p></div><div className="flex gap-2"><button type="button" disabled={decidingId !== null} onClick={()=>void decide(a.id,"rejected")} className="rounded-md border border-border px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary">Reject</button><button type="button" disabled={decidingId !== null} onClick={()=>void decide(a.id,"approved")} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85">Approve</button></div></div><p className="mt-4 whitespace-pre-wrap rounded-md bg-secondary/70 p-4 text-sm leading-6">{String(s.bodyText ?? "No body preview available.")}</p></article>})}</div>}
  </div></main>;
}
