"use client";

import { useMemo, useRef, useState } from "react";
import { ArrowRight, Inbox, RefreshCw, ShieldCheck } from "lucide-react";
import { CatchUpRequestScope, type CatchUpScopeToken } from "./request-scope";
import { catchUpPeriodUtc, parseCatchUpDays, type CatchUpDays } from "@/lib/briefings/catch-up-window";

type AgentChoice = {
  agentId: string; name: string;
  mailboxes: Array<{ id: string; emailAddress: string }>;
};
type Manifest = {
  id: string; status: "pending" | "partial" | "ready" | "failed" | "invalidated";
  sourceCount: number; scope: { scopeVersion: string };
  period: { start: string; end: string } | null;
};
type Source = { messageId: string; mailboxId: string; threadId: string; contentRevision: string };
type SummaryItem = {
  id: string; sourceIds: string[]; priority: "high" | "medium" | "low";
  title: string; summary: string; reason: string; deadline: string | null;
  confidence: "supported" | "uncertain"; representation: "complete" | "partial";
};


const statusText: Record<Manifest["status"], string> = {
  pending: "Mail selection saved — AI summaries are not yet generated",
  partial: "Selection limit reached — narrow the date range to continue",
  ready: "Selection complete",
  failed: "Selection failed",
  invalidated: "Some selected sources changed or access was revoked",
};

export function CatchUpClient({ organizationId, agents, initialDays = 7 }: { organizationId: string; agents: AgentChoice[]; initialDays?: CatchUpDays }) {
  const [agentId, setAgentId] = useState(agents[0]?.agentId ?? "");
  const agent = useMemo(() => agents.find(a => a.agentId === agentId), [agents, agentId]);
  const [mailboxIds, setMailboxIds] = useState<string[]>(agents[0]?.mailboxes.map(a => a.id) ?? []);
  const [days, setDays] = useState<CatchUpDays>(initialDays);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [items, setItems] = useState<SummaryItem[]>([]);
  const [reviewedItemIds, setReviewedItemIds] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const requestScopeRef = useRef(new CatchUpRequestScope(agents[0]?.agentId ?? ""));

  function clearSelectionResults() {
    setManifest(null);
    setSources([]);
    setNextCursor(null);
    setItems([]);
    setReviewedItemIds([]);
    setError("");
  }

  // Agent changes invalidate requests synchronously. useEffect cleanup would
  // execute after rendering and could allow a late response into the new view.
  function changeAgent(nextAgentId: string) {
    if (nextAgentId === agentId || !agents.some(a => a.agentId === nextAgentId)) return;
    requestScopeRef.current.switchAgent(nextAgentId);
    setAgentId(nextAgentId);
    setMailboxIds(agents.find(a => a.agentId === nextAgentId)?.mailboxes.map(m => m.id) ?? []);
    clearSelectionResults();
    setBusy(false);
  }

  function changeMailbox(mailboxId: string, checked: boolean) {
    // setBusy(true) is deferred by React; the request token locks input
    // immediately, before a second click can change the approved scope.
    if (busy || requestScopeRef.current.isBusy()) return;
    if (!agent?.mailboxes.some(mailbox => mailbox.id === mailboxId)) return;
    if (mailboxIds.includes(mailboxId) === checked) return;
    requestScopeRef.current.invalidateSelection();
    setMailboxIds(ids => checked
      ? (ids.includes(mailboxId) ? ids : [...ids, mailboxId])
      : ids.filter(id => id !== mailboxId));
    // A previously generated manifest is not a result for edited mailbox scope.
    clearSelectionResults();
  }

  function changeDays(nextDays: CatchUpDays) {
    if (busy || requestScopeRef.current.isBusy() || nextDays === days) return;
    requestScopeRef.current.invalidateSelection();
    setDays(nextDays);
    clearSelectionResults();
  }

  // All four read/write UI operations share one immediate in-flight guard.
  // A response may mutate state only while its original agent + epoch is active.
  async function runScopedOperation(work: (token: CatchUpScopeToken) => Promise<void>, failureMessage: string) {
    const token = requestScopeRef.current.begin(agentId);
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      await work(token);
    } catch (cause) {
      if (requestScopeRef.current.isCurrent(token)) {
        setError(cause instanceof Error ? cause.message : failureMessage);
      }
    } finally {
      if (requestScopeRef.current.finish(token)) setBusy(false);
    }
  }

  async function loadDetail(id: string, token: CatchUpScopeToken) {
    const params = new URLSearchParams({ agentId: token.agentId });
    const response = await fetch(`/api/organizations/${organizationId}/briefings/${id}?${params}`, { cache: "no-store" });
    const data = await response.json().catch(() => null) as {
      manifest?: Manifest; items?: SummaryItem[]; reviewedItemIds?: string[]; message?: string;
    } | null;
    if (!requestScopeRef.current.isCurrent(token)) return;
    if (!response.ok || !data?.manifest) throw new Error(data?.message || "Summary details are not available.");
    setManifest(data.manifest);
    setItems(data.items ?? []);
    setReviewedItemIds(data.reviewedItemIds ?? []);
  }

  async function loadSources(id: string, token: CatchUpScopeToken, cursor: string | null = null) {
    const params = new URLSearchParams({ agentId: token.agentId, limit: "200" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/organizations/${organizationId}/briefings/${id}/sources?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { items?: Source[]; nextCursor?: string | null; message?: string } | null;
    if (!requestScopeRef.current.isCurrent(token)) return;
    if (!response.ok) throw new Error(payload?.message || "Selected mail sources could not be loaded.");
    setSources(current => cursor ? [...current, ...(payload?.items ?? [])] : payload?.items ?? []);
    setNextCursor(payload?.nextCursor ?? null);
  }

  async function prepare() {
    if (!agentId || !mailboxIds.length) return;
    // Snapshot the exact user-selected scope for this request. Scope inputs
    // cannot be edited while busy; changing the agent invalidates the token.
    const selectedMailboxes = [...mailboxIds];
    const selectedDays = days;
    await runScopedOperation(async token => {
      setManifest(null);
      setSources([]);
      setItems([]);
      setReviewedItemIds([]);
      setNextCursor(null);
      const now = new Date();
      const request = {
        agentId: token.agentId, mailboxIds: selectedMailboxes,
        language: "en", mode: "catch_up", requestKey: crypto.randomUUID(),
        period: catchUpPeriodUtc(selectedDays, now),
      };
      const response = await fetch(`/api/organizations/${organizationId}/briefings`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json().catch(() => null) as { manifest?: Manifest; message?: string } | null;
      if (!requestScopeRef.current.isCurrent(token)) return;
      if (!response.ok || !payload?.manifest) throw new Error(payload?.message || "Could not prepare this mail selection.");
      setManifest(payload.manifest);
      await loadDetail(payload.manifest.id, token);
      if (!requestScopeRef.current.isCurrent(token)) return;
      if (payload.manifest.sourceCount) await loadSources(payload.manifest.id, token);
    }, "Catch-up could not start.");
  }

  async function markReviewed(itemId: string) {
    if (!manifest || manifest.status !== "ready") return;
    const selectedManifest = manifest;
    await runScopedOperation(async token => {
      const response = await fetch(`/api/organizations/${organizationId}/briefings/${selectedManifest.id}/review`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          agentId: token.agentId, itemIds: [itemId],
          expectedScopeVersion: selectedManifest.scope.scopeVersion,
        }),
      });
      if (!requestScopeRef.current.isCurrent(token)) return;
      if (!response.ok) throw new Error("Review could not be saved. Reload to check permissions and source revisions.");
      await loadDetail(selectedManifest.id, token);
    }, "Could not save review.");
  }

  function refreshDetail(id: string) {
    void runScopedOperation(token => loadDetail(id, token), "Could not refresh summary.");
  }

  function loadMoreSources(id: string, cursor: string) {
    void runScopedOperation(token => loadSources(id, token, cursor), "Could not load more sources.");
  }

  return (
    <main className="mx-auto min-w-0 max-w-5xl px-4 py-7 sm:px-8">
      <a href="/overview" className="text-sm text-muted-foreground hover:text-foreground">← Back to Overview</a>
      <header className="mt-5 border-b border-border pb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><ShieldCheck size={16} /> Private catch-up</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Catch up on my mail</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Choose your permitted mailboxes and a date window. This is a selected lookback window, not automatically detected absence. Preparing a selection does not mark messages read or reviewed.</p>
      </header>
      <section aria-label="Catch-up scope" className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5">
        <label className="grid gap-1.5 text-sm font-medium">Agent
          <select value={agentId} onChange={e => changeAgent(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
            {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Mailboxes you have permission to review</legend>
          {agent?.mailboxes.length ? (
            <div className="grid gap-2">
              {agent.mailboxes.map(m => <label key={m.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                <input type="checkbox" checked={mailboxIds.includes(m.id)}
                  disabled={busy} onChange={e => changeMailbox(m.id, e.target.checked)}
                  className="size-4" /> <span className="break-all">{m.emailAddress}</span>
              </label>)}
            </div>
          ) : <div role="status" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No personal mailbox grant for this agent. Ask an organization administrator to grant access first.
          </div>}
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium">Catch-up window
          <select value={days} disabled={busy} onChange={e => changeDays(parseCatchUpDays(e.target.value))}
            className="h-11 rounded-md border border-input bg-background px-3">
            <option value={1}>Last 1 day</option>
            <option value={5}>Last 5 days</option>
            <option value={7}>Last 7 days (default)</option>
            <option value={30}>Last 30 days</option>
          </select>
        </label>
        <button type="button" disabled={busy || !mailboxIds.length} onClick={() => void prepare()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-4 font-semibold text-primary-foreground disabled:opacity-40">
          <RefreshCw size={17} aria-hidden="true" /> {busy ? "Selecting permitted mail…" : "Prepare my catch-up"}
        </button>
      </section>
      {error ? <div role="alert" className="mt-5 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm">{error}</div> : null}
      {manifest && (
        <section className="mt-6 rounded-xl border border-border bg-card p-5" aria-label="Catch-up selection result">
          <h2 className="text-lg font-semibold">Your selection</h2>
          <p role="status" className="mt-2 text-sm text-muted-foreground">{statusText[manifest.status]}</p>
          <p className="mt-1 text-sm">{manifest.sourceCount} source {manifest.sourceCount === 1 ? "email" : "emails"} selected from your current permitted scope.</p>
          {manifest.period ? <p className="mt-1 text-xs text-muted-foreground">Selected UTC window: <time dateTime={manifest.period.start}>{manifest.period.start}</time> to <time dateTime={manifest.period.end}>{manifest.period.end}</time>. This is not an automatic absence or read-state measurement.</p> : null}
          <p className="mt-3 text-xs text-muted-foreground">C3 source-grounded AI generation is not yet running automatically. Only a complete, verified generated item can be explicitly marked reviewed; opening this page changes no review state.</p>
          <button type="button" disabled={busy} onClick={() => refreshDetail(manifest.id)}
            className="mt-4 rounded-md border border-border px-3 py-2 text-sm hover:bg-secondary">
            Refresh generated summary and review progress
          </button>
          {items.length > 0 ? (
            <div className="mt-5 space-y-5" aria-label="Source-grounded summaries">
              {(["high","medium","low"] as const).map(priority => {
                const group = items.filter(item => item.priority === priority);
                if (!group.length) return null;
                return <section key={priority} aria-label={priority === "high" ? "Needs attention" : priority === "medium" ? "Worth reviewing" : "For reference"}>
                  <h3 className="mb-3 text-base font-semibold">{priority === "high" ? "Needs attention" : priority === "medium" ? "Worth reviewing" : "For reference"}</h3>
                  <ul className="space-y-3">{group.map(item => {
                    const reviewed = reviewedItemIds.includes(item.id);
                    return <li key={item.id} className="rounded-xl border border-border bg-background p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h4 className="font-semibold">{item.title}</h4>
                        <span className="text-xs text-muted-foreground">{reviewed ? "Reviewed" : item.confidence === "uncertain" ? "Check original" : "Evidence linked"}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{item.summary}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{item.reason}</p>
                      {item.deadline ? <p className="mt-2 text-xs">Evidence-linked date: {item.deadline}</p> : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {item.sourceIds.map(sourceId => {
                          const source = sources.find(s => s.messageId === sourceId);
                          return source ? <a key={sourceId} href={`/mail/thread/${encodeURIComponent(source.threadId)}`}
                            className="text-xs font-medium text-primary underline">Open original email</a> : null;
                        })}
                        <button type="button" disabled={busy || reviewed || item.representation !== "complete" || manifest.status !== "ready"}
                          onClick={() => { void markReviewed(item.id); }}
                          className="rounded-md border border-border px-3 py-1.5 text-xs font-medium disabled:opacity-40">
                          {reviewed ? "Reviewed" : "Mark this item reviewed"}
                        </button>
                      </div>
                    </li>;
                  })}</ul>
                </section>;
              })}
            </div>
          ) : null}
          {sources.length ? (
            <ul className="mt-4 divide-y divide-border" aria-label="Original source emails">
              {sources.map(source => (
                <li key={source.messageId} className="py-2">
                  <a href={`/mail/thread/${encodeURIComponent(source.threadId)}`}
                    className="inline-flex min-w-0 items-center gap-2 text-sm text-primary hover:underline">
                    <Inbox size={16} /> <span className="break-all">Open source email {source.messageId.slice(0, 8)}</span><ArrowRight size={15} />
                  </a>
                </li>
              ))}
            </ul>
          ) : manifest.sourceCount === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">No newly eligible messages in this selection.</p>
          ) : null}
          {nextCursor ? <button type="button" disabled={busy} onClick={() => loadMoreSources(manifest.id, nextCursor)} className="mt-4 rounded-md border border-border px-4 py-2 text-sm">Load more source links</button> : null}
        </section>
      )}
    </main>
  );
}
