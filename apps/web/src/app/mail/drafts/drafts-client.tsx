"use client";

import { useEffect, useMemo, useState } from "react";

type SyncStatus = "local_only" | "queued" | "syncing" | "synced" | "error";
type Draft = {
  id: string; email_account_id: string; subject?: string | null;
  text_body?: string | null; to_recipients?: string[];
  updated_at?: string; account_email?: string;
  provider_draft_sync_status?: SyncStatus; provider_draft_last_error?: string | null;
};
const isPending = (draft: Draft) =>
  draft.provider_draft_sync_status === "queued" || draft.provider_draft_sync_status === "syncing";
function draftStatus(status?: SyncStatus) {
  switch (status) {
    case "synced": return "In mailbox drafts";
    case "queued":
    case "syncing": return "Saving to mailbox…";
    case "error": return "Sync needs review";
    default: return "Saved in app";
  }
}

export default function DraftsClient({ organizationId }: { organizationId: string }) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const filteredDrafts = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return drafts;
    return drafts.filter(d => [d.subject, d.text_body, d.account_email, ...(d.to_recipients ?? [])]
      .some(value => typeof value === "string" && value.toLocaleLowerCase().includes(needle)));
  }, [drafts, query]);
  const needAttention = drafts.filter(d => d.provider_draft_sync_status === "error").length;
  const saving = drafts.filter(isPending).length;

  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch("/api/mail/drafts?organizationId=" + encodeURIComponent(organizationId), {
          cache: "no-store",
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.message ?? "Could not load drafts.");
        if (!cancelled) { setDrafts(data.drafts ?? []); setNotice(null); }
      } catch (error) {
        if (!cancelled) setNotice(error instanceof Error ? error.message : "Could not load drafts.");
      }
    };
    void refresh();
    // Provider synchronization is driven by the worker, never by clicking
    // through each draft. Refresh while this view is open to show progress.
    const interval = setInterval(() => { if (!cancelled) void refresh(); }, 15_000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [organizationId]);

  async function retryProviderSync(id: string) {
    if (!window.confirm(
      "The provider may already have a saved draft. Check your mailbox Drafts folder before retrying to avoid a duplicate. Queue another attempt?",
    )) return;
    setBusyId(id);
    setNotice(null);
    try {
      const response = await fetch("/api/mail/drafts/sync", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, messageId: id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not retry draft synchronization.");
      setDrafts(items => items.map(item => item.id === id
        ? { ...item, provider_draft_sync_status: "queued", provider_draft_last_error: null } : item));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not retry draft synchronization.");
    } finally { setBusyId(null); }
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this draft from AI Comms Agent? Already-synced provider copies may remain in your mailbox.")) return;
    setBusyId(id); setNotice(null);
    try {
      const response = await fetch("/api/mail/drafts", {
        method: "DELETE", headers: { "content-type": "application/json" },
        body: JSON.stringify({ organizationId, messageId: id }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message ?? "Could not delete draft.");
      setDrafts(items => items.filter(item => item.id !== id));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Could not delete draft.");
    } finally { setBusyId(null); }
  }

  return <main className="min-h-full bg-muted/20 p-5 sm:p-7 lg:p-9">
    <div className="mx-auto max-w-[920px]">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Mail workspace</p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Drafts</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {drafts.length} {drafts.length === 1 ? "draft" : "drafts"} ready to review
            {saving > 0 ? ` · ${saving} saving to mailbox` : ""}
            {needAttention > 0 ? ` · ${needAttention} need attention` : ""}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">AI saves eligible drafts to your connected mailbox automatically. Sending still requires approval.</p>
        </div>
        <a href="/mail/compose" className="rounded-md bg-foreground px-4 py-2.5 text-sm font-semibold text-background">New draft</a>
      </div>
      {notice && <p role="alert" className="mt-4 rounded-md border p-3 text-sm text-destructive">{notice}</p>}
      <section className="mt-5 overflow-hidden rounded-md border bg-background shadow-sm">
        <div className="border-b p-3">
          <label>
            <span className="sr-only">Search drafts</span>
            <input value={query} onChange={event => setQuery(event.target.value)}
              placeholder="Find a draft…" className="h-10 w-full rounded-md border bg-background px-3 text-sm" />
          </label>
        </div>
        {drafts.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No pending drafts. AI-created drafts will appear here.</p>
          : filteredDrafts.length === 0 ? <p className="p-8 text-center text-sm text-muted-foreground">No matching drafts.</p>
          : <div className="divide-y">{filteredDrafts.map(draft => <article key={draft.id}
              className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <a className="truncate text-sm font-semibold hover:underline"
                    href={"/mail/compose?draftId=" + encodeURIComponent(draft.id)}>
                    {draft.subject || "(No subject)"}
                  </a>
                  <span className={draft.provider_draft_sync_status === "error"
                    ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}
                    role="status">{draftStatus(draft.provider_draft_sync_status)}</span>
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  To: {draft.to_recipients?.join(", ") || "No recipients"}
                  {draft.account_email ? " · " + draft.account_email : ""}
                </p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{draft.text_body || "Empty draft"}</p>
                {draft.provider_draft_sync_status === "error" &&
                  <p className="mt-1 text-xs text-destructive">The last provider update is uncertain. Check your mailbox before retrying.</p>}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a href={"/mail/compose?draftId=" + encodeURIComponent(draft.id)}
                  className="rounded-md border px-3 py-1.5 text-xs font-medium">Review</a>
                {draft.provider_draft_sync_status === "error" &&
                  <button type="button" disabled={busyId !== null}
                    onClick={() => void retryProviderSync(draft.id)}
                    className="rounded-md border px-3 py-1.5 text-xs font-medium disabled:opacity-50">
                    Retry sync
                  </button>}
                <button type="button" disabled={busyId !== null}
                  onClick={() => void remove(draft.id)}
                  className="rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:text-destructive disabled:opacity-50">
                  Delete
                </button>
              </div>
            </article>)}</div>}
      </section>
    </div>
  </main>;
}
