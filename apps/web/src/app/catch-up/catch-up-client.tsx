"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Inbox, RefreshCw, ShieldCheck } from "lucide-react";

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

const statusText: Record<Manifest["status"], string> = {
  pending: "Mail selection saved — AI summaries are not yet generated",
  partial: "Selection limit reached — narrow the date range to continue",
  ready: "Selection complete",
  failed: "Selection failed",
  invalidated: "Some selected sources changed or access was revoked",
};

export function CatchUpClient({ organizationId, agents }: { organizationId: string; agents: AgentChoice[] }) {
  const [agentId, setAgentId] = useState(agents[0]?.agentId ?? "");
  const agent = useMemo(() => agents.find(a => a.agentId === agentId), [agents, agentId]);
  const [mailboxIds, setMailboxIds] = useState<string[]>(agents[0]?.mailboxes.map(a => a.id) ?? []);
  const [days, setDays] = useState(7);
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Changing the selected agent must discard the prior user's visible source
  // metadata, never reuse stale mailbox IDs or an old manifest cursor.
  useEffect(() => {
    setMailboxIds(agents.find(a => a.agentId === agentId)?.mailboxes.map(m => m.id) ?? []);
    setManifest(null); setSources([]); setNextCursor(null); setError("");
  }, [agentId, agents]);

  async function loadSources(id: string, cursor: string | null = null) {
    const params = new URLSearchParams({ agentId, limit: "200" });
    if (cursor) params.set("cursor", cursor);
    const response = await fetch(`/api/organizations/${organizationId}/briefings/${id}/sources?${params}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null) as { items?: Source[]; nextCursor?: string | null; message?: string } | null;
    if (!response.ok) throw new Error(payload?.message || "Selected mail sources could not be loaded.");
    setSources(current => cursor ? [...current, ...(payload?.items ?? [])] : payload?.items ?? []);
    setNextCursor(payload?.nextCursor ?? null);
  }

  async function prepare() {
    if (!agentId || !mailboxIds.length || busy) return;
    setBusy(true); setError(""); setManifest(null); setSources([]); setNextCursor(null);
    try {
      const now = new Date();
      const request = {
        agentId, mailboxIds, language: "en", mode: "catch_up", requestKey: crypto.randomUUID(),
        period: { start: new Date(now.getTime() - days * 86400000).toISOString(), end: now.toISOString() },
      };
      const response = await fetch(`/api/organizations/${organizationId}/briefings`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      const payload = await response.json().catch(() => null) as { manifest?: Manifest; message?: string } | null;
      if (!response.ok || !payload?.manifest) throw new Error(payload?.message || "Could not prepare this mail selection.");
      setManifest(payload.manifest);
      if (payload.manifest.sourceCount) await loadSources(payload.manifest.id);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Catch-up could not start."); }
    finally { setBusy(false); }
  }

  return (
    <main className="mx-auto min-w-0 max-w-5xl px-4 py-7 sm:px-8">
      <a href="/chat" className="text-sm text-muted-foreground hover:text-foreground">← Back to Chat</a>
      <header className="mt-5 border-b border-border pb-6">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"><ShieldCheck size={16} /> Private catch-up</p>
        <h1 className="mt-2 font-display text-3xl font-semibold">Catch up on my mail</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Choose your permitted mailboxes and a date window. Preparing a selection does not mark messages read or reviewed.</p>
      </header>
      <section aria-label="Catch-up scope" className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-5">
        <label className="grid gap-1.5 text-sm font-medium">Agent
          <select value={agentId} onChange={e => setAgentId(e.target.value)} className="h-11 rounded-md border border-input bg-background px-3">
            {agents.map(a => <option key={a.agentId} value={a.agentId}>{a.name}</option>)}
          </select>
        </label>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Mailboxes you have permission to review</legend>
          {agent?.mailboxes.length ? (
            <div className="grid gap-2">
              {agent.mailboxes.map(m => <label key={m.id} className="flex items-center gap-3 rounded-md border border-border p-3 text-sm">
                <input type="checkbox" checked={mailboxIds.includes(m.id)}
                  onChange={e => setMailboxIds(ids => e.target.checked ? [...ids, m.id] : ids.filter(id => id !== m.id))}
                  className="size-4" /> <span className="break-all">{m.emailAddress}</span>
              </label>)}
            </div>
          ) : <div role="status" className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
            No personal mailbox grant for this agent. Ask an organization administrator to grant access first.
          </div>}
        </fieldset>
        <label className="grid gap-1.5 text-sm font-medium">Catch-up window
          <select value={days} onChange={e => setDays(Number(e.target.value))}
            className="h-11 rounded-md border border-input bg-background px-3">
            <option value={1}>Last 1 day</option>
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
          <p className="mt-3 text-xs text-muted-foreground">AI classification and grounded summaries require the separate C3 generation worker. No review progress has been recorded.</p>
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
          {nextCursor ? <button type="button" disabled={busy} onClick={() => {
            setBusy(true);
            void loadSources(manifest.id, nextCursor).catch(e => setError(e instanceof Error ? e.message : "Could not load more sources.")).finally(() => setBusy(false));
          }} className="mt-4 rounded-md border border-border px-4 py-2 text-sm">Load more source links</button> : null}
        </section>
      )}
    </main>
  );
}
