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
      `SELECT email_messages.id AS id,
              email_messages.organization_id AS organization_id,
              email_messages.email_account_id AS email_account_id,
              email_messages.provider_message_id AS provider_message_id,
              email_messages.message_id_header AS message_id_header,
              email_messages.in_reply_to AS in_reply_to,
              email_messages.thread_id AS thread_id,
              email_messages.folder_id AS folder_id,
              email_messages.from_address AS from_address,
              email_messages.to_addresses AS to_addresses,
              email_messages.cc_addresses AS cc_addresses,
              email_messages.bcc_addresses AS bcc_addresses,
              email_messages.subject AS subject,
              email_messages.text_body AS text_body,
              email_messages.snippet AS snippet,
              email_messages.is_read AS is_read,
              email_messages.is_starred AS is_starred,
              email_messages.is_draft AS is_draft,
              email_messages.is_outbound AS is_outbound,
              email_messages.received_at AS received_at,
              email_messages.importance_score AS importance_score,
              email_messages.action_required AS action_required,
              email_messages.has_attachments AS has_attachments,
              email_accounts.provider AS provider
         FROM email_messages
         JOIN email_accounts ON email_accounts.id = email_messages.email_account_id
        WHERE email_messages.indexed_at IS NULL
          AND email_messages.is_draft = false
        ORDER BY email_messages.received_at ASC
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
          // Skip empty / draft-only messages — indexEmailKnowledge also
          // checks is_draft and returns early, but we want to mark them
          // indexed_at = now() to skip them on the next tick.
          if (message.is_draft || !message.text_body && !message.snippet) {
            await query("UPDATE email_messages SET indexed_at=now() WHERE id=$1", [row.id]);
            return;
          }
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
