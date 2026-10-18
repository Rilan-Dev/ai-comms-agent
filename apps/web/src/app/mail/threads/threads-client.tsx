"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Inbox, Mail, MessageSquareText, Search } from "lucide-react";

export type ThreadRow = {
  thread_id: string;
  email_account_id: string;
  account_email: string;
  account_name: string | null;
  subject: string | null;
  sender: string | null;
  snippet: string | null;
  last_message_at: string | null;
  message_count: number;
  unread_count: number;
  is_draft: boolean;
};
type Mailbox = { id: string; label: string };
type Filters = { search: string; accountId: string; unreadOnly: boolean };
const PAGE_SIZE = 25;

function dateLabel(value: string | null): string {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No date";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function ThreadsClient({
  organizationId, initialThreads, initialHasMore, accounts,
}: {
  organizationId: string;
  initialThreads: ThreadRow[];
  initialHasMore: boolean;
  accounts: Mailbox[];
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({ search: "", accountId: "", unreadOnly: false });
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const inflight = useRef<AbortController | null>(null);

  // Abort a pending request when navigating away, so late pages cannot replace
  // another mailbox's or another filter's conversation list.
  useEffect(() => () => inflight.current?.abort(), []);

  async function loadPage(next: Filters, append = false) {
    inflight.current?.abort();
    const controller = new AbortController();
    inflight.current = controller;
    setError("");
    if (append) setLoadingMore(true);
    else {
      // Never present rows from an earlier search as a matching result while
      // the user's newly selected mailbox/search is loading or has failed.
      setThreads([]);
      setHasMore(false);
      setLoading(true);
    }
    try {
      const params = new URLSearchParams({
        organizationId,
        limit: String(PAGE_SIZE),
        offset: String(append ? threads.length : 0),
        unread: String(next.unreadOnly),
      });
      if (next.search) params.set("q", next.search);
      if (next.accountId) params.set("accountId", next.accountId);
      const response = await fetch("/api/mail/threads?" + params.toString(), {
        cache: "no-store", signal: controller.signal,
      });
      const body = await response.json().catch(() => null) as {
        threads?: ThreadRow[]; hasMore?: boolean; message?: string;
      } | null;
      if (!response.ok) throw new Error(body?.message || "Could not load email threads.");
      if (controller.signal.aborted) return;
      const page = body?.threads ?? [];
      setThreads((current) => append
        ? [...current, ...page.filter((row) => !current.some((item) => item.thread_id === row.thread_id))]
        : page);
      setHasMore(body?.hasMore === true);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Could not load email threads.");
    } finally {
      if (inflight.current === controller) {
        inflight.current = null;
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }

  function apply(next: Filters) {
    setFilters(next);
    void loadPage(next);
  }

  return <main className="min-w-0 bg-background px-4 py-5 sm:px-7 sm:py-8 lg:px-10">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-6">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[.15em] text-muted-foreground">
            <MessageSquareText size={15} /> Mail workspace
          </p>
          <h1 className="mt-2 font-display text-3xl font-medium tracking-tight">Conversations<span className="text-tertiary">.</span></h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Real email threads from your connected mailboxes, grouped by conversation.</p>
        </div>
        <a href="/mail/inbox" className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2.5 text-sm font-medium hover:bg-secondary">
          <Inbox size={16} /> Open Inbox
        </a>
      </header>

      <form onSubmit={(event) => { event.preventDefault(); apply({ ...filters, search: query.trim() }); }}
        role="search" className="mt-5 flex flex-col gap-3 md:flex-row md:items-end">
        <label className="min-w-0 flex-1 text-xs font-medium text-muted-foreground">
          Search conversations
          <span className="mt-1.5 flex h-11 items-center gap-2 rounded-md border border-input bg-card px-3">
            <Search aria-hidden="true" size={16} />
            <input name="q" value={query} onChange={(event) => setQuery(event.target.value)}
              placeholder="Subject, sender, or message…" maxLength={120}
              className="min-w-0 w-full border-0 bg-transparent text-sm text-foreground outline-none" />
          </span>
        </label>
        <label className="text-xs font-medium text-muted-foreground">
          Mailbox
          <select aria-label="Filter by mailbox" value={filters.accountId}
            onChange={(event) => apply({ ...filters, accountId: event.target.value })}
            className="mt-1.5 block h-11 w-full min-w-44 max-w-full rounded-md border border-input bg-card px-3 text-sm text-foreground md:max-w-60">
            <option value="">All mailboxes</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={loading} className="h-11 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground disabled:opacity-50">
          Search
        </button>
      </form>

      <label className="mt-4 inline-flex min-h-10 items-center gap-2 text-sm text-foreground">
        <input type="checkbox" checked={filters.unreadOnly}
          onChange={(event) => apply({ ...filters, unreadOnly: event.target.checked })}
          className="size-4 accent-foreground" /> Unread conversations only
      </label>

      {error ? <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
        <span>{error}</span>
        <button type="button" onClick={() => void loadPage(filters)} className="font-semibold underline">Retry</button>
      </div> : null}

      <section aria-label="Email conversations" aria-busy={loading} className="mt-4 overflow-hidden rounded-md border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/25 px-4 py-3 sm:px-5">
          <h2 className="text-sm font-semibold">Threads</h2>
          <span role="status" className="text-xs text-muted-foreground">{loading ? "Loading…" : `${threads.length} shown`}</span>
        </div>
        {loading ? (
          <div role="status" className="p-8 text-center text-sm text-muted-foreground">Loading conversations…</div>
        ) : error && threads.length === 0 ? (
          <div role="status" className="px-5 py-12 text-center text-sm text-muted-foreground">
            Threads could not be loaded. Use Retry to try again.
          </div>
        ) : threads.length === 0 ? (
          <div className="grid place-items-center gap-3 px-5 py-16 text-center">
            <Mail size={28} className="text-muted-foreground" />
            <p className="text-sm font-semibold">{filters.search || filters.unreadOnly || filters.accountId ? "No matching conversations" : "No conversations yet"}</p>
            <p className="max-w-sm text-xs leading-5 text-muted-foreground">
              {filters.search || filters.unreadOnly || filters.accountId
                ? "Try changing your search or filters. Your other messages are still available."
                : "Messages will appear here after a mailbox sync completes."}
            </p>
            {!accounts.length ? <a href="/mail/accounts" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-secondary">Connect a mailbox</a> : null}
            {filters.search || filters.unreadOnly || filters.accountId ? (
              <button type="button" className="rounded-md border px-3 py-2 text-sm font-medium hover:bg-secondary"
                onClick={() => { setQuery(""); apply({ search: "", accountId: "", unreadOnly: false }); }}>Clear filters</button>
            ) : null}
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {threads.map((thread) => (
              <li key={thread.thread_id} className="min-w-0">
                <a href={`/mail/thread/${encodeURIComponent(thread.thread_id)}`}
                  className="group flex min-w-0 items-start gap-3 px-4 py-4 transition-colors hover:bg-secondary/60 focus-visible:bg-secondary sm:px-5"
                  aria-label={`Open ${thread.subject || "No subject"} conversation, ${thread.message_count} messages`}>
                  <span className={`mt-1 grid size-9 shrink-0 place-items-center rounded-md ${thread.unread_count > 0 ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                    <Mail size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex min-w-0 flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                      <p className={`min-w-0 break-words text-sm ${thread.unread_count > 0 ? "font-semibold" : "font-medium"}`}>{thread.subject || "(No subject)"}</p>
                      <time className="shrink-0 text-xs text-muted-foreground" dateTime={thread.last_message_at ?? undefined}>{dateLabel(thread.last_message_at)}</time>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{thread.sender || "Unknown sender"} · {thread.account_email}</p>
                    <p className="mt-1 line-clamp-2 break-words text-xs leading-5 text-muted-foreground">{thread.snippet || "Open to read the conversation."}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{thread.message_count} {thread.message_count === 1 ? "message" : "messages"}</span>
                      {thread.unread_count > 0 ? <span className="rounded-full bg-accent px-2 py-0.5 font-semibold text-accent-foreground">{thread.unread_count} unread</span> : null}
                      {thread.is_draft ? <span className="rounded-full border border-border px-2 py-0.5">Draft</span> : null}
                    </div>
                  </div>
                  <ArrowRight aria-hidden="true" size={16} className="mt-2 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      {hasMore && !loading ? <div className="mt-5 flex justify-center">
        <button type="button" disabled={loadingMore} onClick={() => void loadPage(filters, true)}
          className="rounded-md border border-border bg-card px-5 py-2.5 text-sm font-medium hover:bg-secondary disabled:opacity-50">
          {loadingMore ? "Loading more…" : "Load more conversations"}
        </button>
      </div> : null}
    </div>
  </main>;
}
