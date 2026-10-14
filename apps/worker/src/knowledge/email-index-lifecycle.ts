import { createEmailIndexHashes } from "./email-index-identity";

export type EmailKnowledgeSyncJob = {
  id: string;
  organization_id: string;
  account_id: string;
  provider: "gmail" | "zoho" | "imap_smtp";
  operation: "upsert_message" | "delete_message" | "delete_account";
  provider_message_id: string | null;
  source_identity_hash: string | null;
  content_hash: string | null;
  metadata_hash: string | null;
  attempts: number;
};

export type EmailKnowledgeVectorSnapshot = {
  organizationId: string;
  accountId: string;
  provider: EmailKnowledgeSyncJob["provider"];
  providerMessageId: string;
  sourceIdentityHash: string;
  contentHash: string;
  metadataHash: string;
  metadata: Record<string, unknown>;
  chunks: Array<{ index: number; content: string; contentHash: string; metadata: Record<string, unknown> }>;
};

export type EmailKnowledgeVectorAdapter = {
  /**
   * Upsert points by deterministic source identity + chunk index. Compare hashes:
   * changed contentHash requires embedding refresh; changed metadataHash alone
   * updates point payload without re-embedding.
   */
  upsertMessageVectors(snapshot: EmailKnowledgeVectorSnapshot): Promise<void>;
  deleteMessageVectors(input: {
    organizationId: string;
    accountId: string;
    provider: EmailKnowledgeSyncJob["provider"];
    providerMessageId: string;
    sourceIdentityHash: string;
  }): Promise<void>;
  /** Must filter by organization + provider + account, never account email/body alone. */
  deleteAccountVectors(input: {
    organizationId: string;
    accountId: string;
    provider: EmailKnowledgeSyncJob["provider"];
  }): Promise<void>;
};

export type EmailKnowledgeSyncDependencies = {
  vectors: EmailKnowledgeVectorAdapter;
  /** Returns null unless the account is active and the message still exists in that account. */
  loadCurrentMessage(job: EmailKnowledgeSyncJob): Promise<EmailKnowledgeVectorSnapshot | null>;
  purgePostgresMessageDocuments(input: { organizationId: string; accountId: string; providerMessageId: string }): Promise<void>;
  purgePostgresAccountDocuments(input: { organizationId: string; accountId: string }): Promise<void>;
  markCompleted(jobId: string): Promise<void>;
  scheduleRetry(jobId: string, safeError: string): Promise<void>;
};

function messageIdentity(job: EmailKnowledgeSyncJob): {
  organizationId: string;
  accountId: string;
  provider: EmailKnowledgeSyncJob["provider"];
  providerMessageId: string;
  sourceIdentityHash: string;
} {
  if (!job.provider_message_id) throw new Error("Message cleanup job is missing its provider message ID.");
  return {
    organizationId: job.organization_id,
    accountId: job.account_id,
    provider: job.provider,
    providerMessageId: job.provider_message_id,
    sourceIdentityHash: job.source_identity_hash ?? createEmailIndexHashes(
      { organizationId: job.organization_id, accountId: job.account_id, provider: job.provider, providerMessageId: job.provider_message_id },
      "",
      {},
    ).sourceIdentityHash,
  };
}

/**
 * Process one durable email index outbox event. Stale upsert/delete jobs cannot
 * resurrect or remove a message that has since been deleted/recreated: the
 * authoritative current message is rechecked before touching vector state.
 */
export async function processEmailKnowledgeSyncJob(
  job: EmailKnowledgeSyncJob,
  dependencies: EmailKnowledgeSyncDependencies,
): Promise<{ completed: boolean }> {
  try {
    if (job.operation === "delete_account") {
      await dependencies.vectors.deleteAccountVectors({
        organizationId: job.organization_id,
        accountId: job.account_id,
        provider: job.provider,
      });
      await dependencies.purgePostgresAccountDocuments({
        organizationId: job.organization_id,
        accountId: job.account_id,
      });
    } else if (job.operation === "delete_message") {
      const identity = messageIdentity(job);
      const current = await dependencies.loadCurrentMessage(job);
      if (!current) {
        await dependencies.vectors.deleteMessageVectors(identity);
        await dependencies.purgePostgresMessageDocuments({
          organizationId: job.organization_id,
          accountId: job.account_id,
          providerMessageId: identity.providerMessageId,
        });
      }
      // If the message exists again, this delete event is stale. Do not remove
      // its current vectors; the current upsert event owns reconciliation.
    } else {
      const current = await dependencies.loadCurrentMessage(job);
      if (current) {
        await dependencies.vectors.upsertMessageVectors(current);
      } else {
        // The source message/account disappeared after this upsert was queued.
        // Convert the stale upsert into an idempotent vector deletion.
        await dependencies.vectors.deleteMessageVectors(messageIdentity(job));
        if (job.provider_message_id) {
          await dependencies.purgePostgresMessageDocuments({
            organizationId: job.organization_id,
            accountId: job.account_id,
            providerMessageId: job.provider_message_id,
          });
        }
      }
    }
    await dependencies.markCompleted(job.id);
    return { completed: true };
  } catch (error) {
    const safeError = error instanceof Error ? error.message.slice(0, 300) : "Unknown index synchronization failure";
    await dependencies.scheduleRetry(job.id, safeError);
    return { completed: false };
  }
}
