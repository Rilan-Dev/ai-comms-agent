"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowUpRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  Database,
  FileText,
  Mail,
  RefreshCw,
  Sparkles,
} from "lucide-react";

type KnowledgeStats = {
  emailDocuments: number;
  emailChunks: number;
  emailReady: number;
  emailPending: number;
  emailFailed: number;
  externalDocuments: number;
  lastIndexedAt: string | null;
};

type KnowledgeDocument = {
  id: string;
  filename: string;
  status: string;
  updatedAt: string;
  provider: string | null;
  receivedAt: string | null;
};

type KnowledgeResponse = {
  stats: KnowledgeStats;
  recentDocuments: KnowledgeDocument[];
};

function formatDate(value: string | null): string {
  if (!value) return "Not indexed yet";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Unknown" : date.toLocaleString();
}

function providerLabel(provider: string | null): string {
  if (provider === "imap_smtp") return "IMAP / SMTP";
  if (provider === "zoho") return "Zoho Mail";
  if (provider === "gmail") return "Gmail";
  return "Email";
}

function statusTone(status: string): string {
  if (status === "ready") return "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "pending" || status === "processing") return "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (status === "error" || status === "failed") return "border-destructive/20 bg-destructive/10 text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export default function KnowledgePage() {
  const [data, setData] = useState<KnowledgeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadKnowledge = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/knowledge", { cache: "no-store" });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.message ?? "Knowledge status could not be loaded.");
      setData(body as KnowledgeResponse);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Knowledge status could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { void loadKnowledge(); }, [loadKnowledge]);

  const stats = data?.stats;

  return (
    <main className="mx-auto max-w-[1180px] space-y-7 bg-background p-5 sm:p-7 lg:p-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Knowledge workspace
          </p>
          <h1 className="font-display text-3xl font-medium tracking-tight">Knowledge<span className="text-tertiary">.</span></h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            See the organization-scoped email content currently stored for retrieval. Email records are indexed after mailbox synchronization; provider-native knowledge stores are not used.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadKnowledge(true)}
          disabled={loading || refreshing}
          className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-md border border-border bg-card px-3.5 text-sm font-medium transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60 sm:self-auto"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      {error ? (
        <div role="alert" className="flex items-start gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="flex-1"><p className="font-medium">Knowledge status unavailable</p><p className="mt-1">{error}</p></div>
          <button type="button" onClick={() => void loadKnowledge(true)} className="font-semibold underline underline-offset-4">Retry</button>
        </div>
      ) : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Knowledge metrics">
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Indexed emails</span><Mail className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{loading ? "—" : stats?.emailDocuments ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Persisted email knowledge documents</p>
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Text chunks</span><BookOpenText className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{loading ? "—" : stats?.emailChunks ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">Available to the current lexical retrieval</p>
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ready</span><CheckCircle2 className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-4 text-3xl font-semibold tabular-nums">{loading ? "—" : stats?.emailReady ?? 0}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {stats?.emailPending ? `${stats.emailPending} pending` : "No pending documents reported"}
            {stats?.emailFailed ? ` · ${stats.emailFailed} failed` : ""}
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-5">
          <div className="flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last indexed</span><Clock3 className="h-4 w-4 text-muted-foreground" /></div>
          <p className="mt-4 text-base font-semibold leading-6">{loading ? "Loading…" : formatDate(stats?.lastIndexedAt ?? null)}</p>
          <p className="mt-1 text-xs text-muted-foreground">From persisted knowledge document updates</p>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
        <div className="overflow-hidden rounded-md border border-border bg-card">
          <div className="flex items-center justify-between border-b border-border px-5 py-4">
            <div><h2 className="text-sm font-semibold">Recent email knowledge</h2><p className="mt-1 text-xs text-muted-foreground">Latest documents saved to the knowledge boundary</p></div>
            <span className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground">{loading ? "…" : data?.recentDocuments.length ?? 0} recent</span>
          </div>
          {loading ? (
            <div className="space-y-3 p-5">{[0,1,2].map((item) => <div key={item} className="h-[58px] animate-pulse rounded-md bg-muted" />)}</div>
          ) : !data?.recentDocuments.length ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <div className="flex h-11 w-11 items-center justify-center rounded-md border border-border bg-background"><FileText className="h-5 w-5 text-muted-foreground" /></div>
              <h3 className="mt-4 text-sm font-semibold">No email knowledge yet</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">Connect a mailbox and let its first sync finish. Newly synchronized non-draft messages are then stored in the knowledge tables.</p>
              <Link href="/mail/accounts" className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90">
                Manage mailboxes <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {data.recentDocuments.map((document) => (
                <div key={document.id} className="flex min-w-0 items-center gap-3 px-5 py-4">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background"><FileText className="h-4 w-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{document.filename}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{providerLabel(document.provider)} · Updated {formatDate(document.updatedAt)}</p>
                  </div>
                  <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium capitalize ${statusTone(document.status)}`}>{document.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-md border border-border bg-card p-5">
            <div className="flex items-center gap-2"><Database className="h-4 w-4 text-primary" /><h2 className="text-sm font-semibold">Retrieval boundary</h2></div>
            <p className="mt-3 text-sm leading-6 text-muted-foreground">This integration stores organization-scoped email documents and text chunks in PostgreSQL. The assistant retrieves from this shared boundary; the current implementation does not claim semantic embeddings or Qdrant indexing.</p>
            <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-sm">
              <span className="text-muted-foreground">External source documents</span>
              <span className="font-semibold tabular-nums">{loading ? "—" : stats?.externalDocuments ?? 0}</span>
            </div>
          </div>
          <div className="rounded-md border border-border bg-card p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Next step</p>
            <h2 className="mt-2 text-base font-semibold">Connect a mailbox</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Mailbox sync owns ingestion today. External knowledge-source onboarding and semantic indexing are not enabled yet.</p>
            <Link href="/mail/accounts" className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md border border-border px-3 text-sm font-medium transition-colors hover:bg-secondary">
              Open email accounts <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
