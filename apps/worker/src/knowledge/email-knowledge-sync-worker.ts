import { query } from "@ai-comms-agent/db";
import { createEmailIndexHashes, createEmailVectorPointId } from "./email-index-identity";
import { processEmailKnowledgeSyncJob } from "./email-index-lifecycle";
import { IMAP_SHADOW_COPY_SQL } from "./email-knowledge-canonical";
import type { EmailKnowledgeSyncDependencies, EmailKnowledgeSyncJob, EmailKnowledgeVectorAdapter, EmailKnowledgeVectorSnapshot } from "./email-index-lifecycle";

const DEFAULT_BATCH_SIZE = 10;
const INDEX_SYNC_INTERVAL_MS = 5_000;
let running = false;

type StoredDocument = {
  id: string;
  sha256: string;
  metadata: Record<string, unknown> | string;
};

function parseObject(value: Record<string, unknown> | string | null | undefined): Record<string, unknown> {
  if (typeof value !== "string") return value ?? {};
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function claimJobs(limit: number): Promise<EmailKnowledgeSyncJob[]> {
  const safeLimit = Math.min(Math.max(Math.floor(limit), 1), 100);
  const result = await query<EmailKnowledgeSyncJob>(
    `WITH due AS (
       SELECT j.id FROM email_knowledge_sync_jobs j
        WHERE (j.status IN ('pending','retry') OR
               (j.status='running' AND j.updated_at < now()-interval '5 minutes'))
          AND j.next_attempt_at <= now()
          AND (
            j.operation <> 'delete_account'
            OR NOT EXISTS (
              SELECT 1 FROM email_knowledge_sync_jobs active
               WHERE active.organization_id=j.organization_id
                 AND active.account_id=j.account_id
                 AND active.id<>j.id
                 AND active.operation IN ('upsert_message','delete_message')
                 AND active.status='running'
            )
          )
        ORDER BY j.next_attempt_at ASC, j.created_at ASC
        LIMIT $1
        FOR UPDATE SKIP LOCKED
     )
     UPDATE email_knowledge_sync_jobs j
        SET status='running', attempts=j.attempts+1, updated_at=now()
       FROM due
      WHERE j.id=due.id
     RETURNING j.*`,
    [safeLimit],
  );
  return result.rows;
}

async function loadCurrentMessage(job: EmailKnowledgeSyncJob): Promise<EmailKnowledgeVectorSnapshot | null> {
  if (!job.provider_message_id) return null;
  const storagePath = `${job.account_id}/${encodeURIComponent(job.provider_message_id)}`;
  const result = await query<StoredDocument>(
    `SELECT d.id, d.sha256, d.metadata
       FROM email_accounts a
       JOIN email_messages m ON m.email_account_id=a.id AND m.organization_id=a.organization_id
       LEFT JOIN email_folders f ON f.id=m.folder_id AND f.email_account_id=m.email_account_id
       JOIN knowledge_documents d ON d.organization_id=a.organization_id
        AND d.storage_bucket='email-account' AND d.storage_path=$4
      WHERE a.id=$1 AND a.organization_id=$2 AND a.provider=$3
        AND a.deleted_at IS NULL AND m.provider_message_id=$5 AND m.is_draft=false
        AND NOT (${IMAP_SHADOW_COPY_SQL})
      LIMIT 1`,
    [job.account_id, job.organization_id, job.provider, storagePath, job.provider_message_id],
  );
  const document = result.rows[0];
  if (!document) return null;

  const metadata = parseObject(document.metadata);
  const chunksResult = await query<{
    chunk_index: number;
    content: string;
    content_hash: string;
    metadata: Record<string, unknown> | string;
  }>(
    `SELECT chunk_index, content, content_hash, metadata
       FROM knowledge_chunks
      WHERE document_id=$1 AND organization_id=$2
      ORDER BY chunk_index ASC`,
    [document.id, job.organization_id],
  );
  const identity = createEmailIndexHashes(
    { organizationId: job.organization_id, accountId: job.account_id, provider: job.provider, providerMessageId: job.provider_message_id },
    "",
    {},
  );
  return {
    organizationId: job.organization_id,
    accountId: job.account_id,
    provider: job.provider,
    providerMessageId: job.provider_message_id,
    sourceIdentityHash: String(metadata.source_identity_hash ?? job.source_identity_hash ?? identity.sourceIdentityHash),
    contentHash: String(metadata.content_hash ?? document.sha256 ?? job.content_hash ?? ""),
    metadataHash: String(metadata.metadata_hash ?? job.metadata_hash ?? ""),
    metadata,
    chunks: chunksResult.rows.map((chunk) => ({
      index: chunk.chunk_index,
      pointId: createEmailVectorPointId(String(metadata.source_identity_hash ?? job.source_identity_hash ?? identity.sourceIdentityHash), chunk.chunk_index),
      content: chunk.content,
      contentHash: chunk.content_hash,
      metadata: parseObject(chunk.metadata),
    })),
  };
}

function createDependencies(vectors: EmailKnowledgeVectorAdapter): EmailKnowledgeSyncDependencies {
  return {
    vectors,
    loadCurrentMessage,
    purgePostgresMessageDocuments: async ({ organizationId, accountId, providerMessageId }) => {
      await query(
        `DELETE FROM knowledge_documents
          WHERE organization_id=$1 AND storage_bucket='email-account'
            AND storage_path=$2`,
        [organizationId, `${accountId}/${encodeURIComponent(providerMessageId)}`],
      );
    },
    purgePostgresAccountDocuments: async ({ organizationId, accountId }) => {
      await query(
        `DELETE FROM knowledge_documents
          WHERE organization_id=$1 AND storage_bucket='email-account'
            AND (metadata->>'email_account_id'=$2 OR storage_path LIKE $2 || '/%')`,
        [organizationId, accountId],
      );
    },
    markCompleted: async (jobId) => {
      await query(
        `UPDATE email_knowledge_sync_jobs
            SET status='completed', completed_at=now(), last_error=NULL, updated_at=now()
          WHERE id=$1`,
        [jobId],
      );
    },
    scheduleRetry: async (jobId, safeError) => {
      await query(
        `UPDATE email_knowledge_sync_jobs
            SET status='retry',
                next_attempt_at=now() + make_interval(secs => LEAST(3600, (5 * power(2, LEAST(attempts, 10)))::int)),
                last_error=left($2,300), updated_at=now()
          WHERE id=$1`,
        [jobId, safeError],
      );
    },
  };
}

/**
 * Drain durable outbox events only when the host provides its configured
 * RAG/vector adapter. This repository intentionally does not invent a Qdrant
 * endpoint or write to a parallel vector collection.
 */
export async function processEmailKnowledgeSyncBatch(
  vectors: EmailKnowledgeVectorAdapter,
  limit = DEFAULT_BATCH_SIZE,
): Promise<{ processed: number; completed: number }> {
  if (running) return { processed: 0, completed: 0 };
  running = true;
  try {
    const jobs = await claimJobs(limit);
    const dependencies = createDependencies(vectors);
    let completed = 0;
    for (const job of jobs) {
      const result = await processEmailKnowledgeSyncJob(job, dependencies);
      if (result.completed) completed += 1;
    }
    return { processed: jobs.length, completed };
  } finally {
    running = false;
  }
}

export function startEmailKnowledgeSyncLoop(vectors: EmailKnowledgeVectorAdapter) {
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    try {
      const result = await processEmailKnowledgeSyncBatch(vectors);
      if (result.processed > 0) {
        console.log(JSON.stringify({
          timestamp: new Date().toISOString(),
          level: "info",
          service: "worker.email-knowledge-sync",
          message: "Processed email index sync batch",
          processed: result.processed,
          completed: result.completed,
        }));
      }
    } catch (error) {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.email-knowledge-sync",
        message: "Email index sync batch failed",
        reason: error instanceof Error ? error.message.slice(0, 300) : "Unknown error",
      }));
    }
  };
  void tick();
  const timer = setInterval(() => { void tick(); }, INDEX_SYNC_INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
