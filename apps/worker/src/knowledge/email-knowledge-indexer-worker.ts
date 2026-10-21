/**
 * apps/worker/src/knowledge/email-knowledge-indexer-worker.ts
 * ─────────────────────────────────────────────────────────────────────────
 * Background indexer for email_messages. Decoupled from the sync loop so
 * the Gmail/Zoho/IMAP API rate-limit clock isn't spent on chunking + DB
 * writes. Selects rows where indexed_at IS NULL in batches, chunks each
 * message body, writes knowledge_documents + knowledge_chunks, and marks
 * indexed_at = now(). Runs on a separate tick so initial sync can race
 * ahead while indexing keeps up at its own pace.
 *
 * Idempotent: if the worker crashes between chunk insert and indexed_at
 * update, the next tick re-runs the same message. chunkEmailKnowledgeBody
 * uses DELETE+INSERT per document to make re-runs safe.
 */

import { query } from "@ai-comms-agent/db";
import { indexEmailKnowledge } from "./email-knowledge-indexer";
import { IMAP_SHADOW_COPY_SQL } from "./email-knowledge-canonical";

const INDEXER_INTERVAL_MS = 5_000;
const INDEXER_BATCH_SIZE = 15;     // messages per tick (lowered from 25 to reduce per-tick DB pressure)
// INDEXER_CONCURRENCY must stay BELOW DATABASE_POOL_MAX (user has 5 on
// Supabase transaction-mode pooler). The mailbox-sync loop also runs
// concurrently with PERSIST_CONCURRENCY=4 (Gmail) — 4+3=7 still under 5? no,
// but the Supabase pooler will queue overflow. 3 is the safe choice here.
const INDEXER_CONCURRENCY = 3;    // parallel chunk + INSERT per batch

let running = false;

type PendingMessage = {
  id: string;
  organization_id: string;
  email_account_id: string;
  provider: "gmail" | "zoho" | "imap_smtp";
  // Columns needed to reconstruct an EmailMessage for indexEmailKnowledge.
  // NOTE: `references` is a PostgreSQL reserved keyword and also exists as an
  // ARRAY column on email_messages. We intentionally DON'T select it — the
  // indexer doesn't need it (indexEmailKnowledge uses subject+body only).
  // The `references_header` text column would also work but isn't needed
  // for chunking/embedding.
  provider_message_id: string;
  message_id_header: string | null;
  in_reply_to: string | null;
  thread_id: string | null;
  folder_id: string | null;
  from_address: string | null;
  to_addresses: string[] | string | null;
  cc_addresses: string[] | string | null;
  bcc_addresses: string[] | string | null;
  subject: string | null;
  text_body: string | null;
  snippet: string | null;
  is_read: boolean;
  is_starred: boolean;
  is_draft: boolean;
  is_outbound: boolean;
  received_at: string | null;
  importance_score: number | null;
  action_required: boolean | null;
  has_attachments: boolean | null;
};

function parseStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x));
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return []; }
  }
  return [];
}

function toEmailMessage(row: PendingMessage): any {
  return {
    id: row.provider_message_id,
    email_account_id: row.email_account_id,
    provider_message_id: row.provider_message_id,
    message_id_header: row.message_id_header ?? undefined,
    in_reply_to: row.in_reply_to ?? undefined,
    // references intentionally omitted — indexEmailKnowledge() does not
    // use this field for chunking or embedding. Avoids the reserved-word
    // SELECT error (42601: syntax error at or near "references").
    references: [],
    thread_id: row.thread_id ?? undefined,
    folder_id: row.folder_id ?? undefined,
    from_address: row.from_address ?? "",
    to_addresses: parseStringArray(row.to_addresses),
    cc_addresses: parseStringArray(row.cc_addresses),
    bcc_addresses: parseStringArray(row.bcc_addresses),
    subject: row.subject ?? "",
    text_body: row.text_body ?? "",
    snippet: row.snippet ?? "",
    received_at: row.received_at ?? new Date().toISOString(),
    is_read: Boolean(row.is_read),
    is_starred: Boolean(row.is_starred),
    is_draft: Boolean(row.is_draft),
    is_outbound: Boolean(row.is_outbound),
    importance_score: row.importance_score ?? 0.3,
    action_required: Boolean(row.action_required),
    has_attachments: Boolean(row.has_attachments),
    embedding_status: "pending" as const,
  };
}

export async function processEmailKnowledgeIndexingBatch(limit = INDEXER_BATCH_SIZE): Promise<{ processed: number }> {
  if (running) return { processed: 0 };
  running = true;
  try {
    const result = await query<PendingMessage>(
      `WITH classified AS (
         SELECT m.*, a.provider,
                (${IMAP_SHADOW_COPY_SQL}) AS shadow_copy
           FROM email_messages m
           JOIN email_accounts a ON a.id=m.email_account_id
           LEFT JOIN email_folders f ON f.id=m.folder_id AND f.email_account_id=m.email_account_id
          WHERE a.deleted_at IS NULL AND a.organization_id=m.organization_id
       )
       SELECT c.id, c.organization_id, c.email_account_id, c.provider_message_id,
              c.internet_message_id AS message_id_header, c.in_reply_to, c.thread_id,
              c.folder_id, c.from_email AS from_address,
              c.to_recipients AS to_addresses, c.cc_recipients AS cc_addresses,
              c.bcc_recipients AS bcc_addresses, c.subject, c.text_body, c.snippet,
              c.is_read, c.is_starred, c.is_draft, c.is_sent AS is_outbound,
              c.received_at, c.importance_score, c.action_required, c.has_attachments,
              c.provider
         FROM classified c
        WHERE c.indexed_at IS NULL
           OR (c.provider='imap_smtp' AND (
             -- Retire already-indexed All Mail / INBOX duplicates after a
             -- previously completed import, without deleting mailbox rows.
             (c.shadow_copy AND EXISTS (
               SELECT 1 FROM knowledge_documents d
                WHERE d.organization_id=c.organization_id
                  AND d.storage_bucket='email-account'
                  AND d.metadata->>'email_account_id'=c.email_account_id::text
                  AND d.metadata->>'provider_message_id'=c.provider_message_id
             ))
             OR
             -- If the preferred copy was deleted/moved, promote the surviving
             -- folder copy even if its indexed_at flag is already populated.
             (NOT c.shadow_copy AND c.indexed_at IS NOT NULL AND c.is_draft=false
              AND (c.received_at IS NOT NULL OR NULLIF(BTRIM(COALESCE(c.subject,'')), '') IS NOT NULL
                   OR NULLIF(BTRIM(COALESCE(c.from_email,'')), '') IS NOT NULL
                   OR NULLIF(BTRIM(COALESCE(c.text_body,'')), '') IS NOT NULL
                   OR NULLIF(BTRIM(COALESCE(c.snippet,'')), '') IS NOT NULL)
              AND NOT EXISTS (
               SELECT 1 FROM knowledge_documents d
                WHERE d.organization_id=c.organization_id
                  AND d.storage_bucket='email-account'
                  AND d.metadata->>'email_account_id'=c.email_account_id::text
                  AND d.metadata->>'provider_message_id'=c.provider_message_id
              ))
           ))
        ORDER BY c.indexed_at ASC NULLS FIRST, c.received_at ASC
        LIMIT $1`,
      [limit],
    );
    if (result.rows.length === 0) return { processed: 0 };

    // Concurrency-bounded — don't blow the Postgres pool (DATABASE_POOL_MAX=5).
    for (let i = 0; i < result.rows.length; i += INDEXER_CONCURRENCY) {
      const slice = result.rows.slice(i, i + INDEXER_CONCURRENCY);
      await Promise.all(slice.map(async (row) => {
        const provider = (row as any).provider as "gmail" | "zoho" | "imap_smtp";
        if (!provider) {
          // Defensive — shouldn't happen since JOIN guarantees it.
          await query("UPDATE email_messages SET indexed_at=now() WHERE id=$1", [row.id]);
          return;
        }
        try {
          const message = toEmailMessage(row);
          // The indexer also removes stale derived documents when a message
          // becomes a draft or its searchable content becomes empty.
          await indexEmailKnowledge({
            organizationId: row.organization_id,
            accountId: row.email_account_id,
            provider,
            message,
          });
          await query("UPDATE email_messages SET indexed_at=now() WHERE id=$1", [row.id]);
        } catch (error) {
          // Log + leave indexed_at NULL so the next tick retries.
          console.error(JSON.stringify({
            timestamp: new Date().toISOString(),
            level: "error",
            service: "worker.email-knowledge-indexer",
            message: "Indexing failed for email message; will retry next tick",
            message_id: row.id,
            provider_message_id: row.provider_message_id,
            reason: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
          }));
        }
      }));
    }
    return { processed: result.rows.length };
  } finally {
    running = false;
  }
}

export function startEmailKnowledgeIndexerLoop() {
  if (!process.env.DATABASE_URL || process.env.EMAIL_KNOWLEDGE_INDEXER_DISABLED === "true") {
    return () => undefined;
  }
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const result = await processEmailKnowledgeIndexingBatch();
      if (result.processed > 0) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          service: "worker.email-knowledge-indexer",
          message: "Indexed email knowledge batch",
          processed: result.processed,
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-knowledge-indexer",
        message: "Indexer tick failed",
        reason: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      }));
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, INDEXER_INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
