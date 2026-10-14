export type EmailKnowledgeCleanupJob = {
  id: string;
  organization_id: string;
  account_id: string;
  provider: "gmail" | "zoho" | "imap_smtp";
  attempts: number;
};

export type EmailKnowledgeVectorAdapter = {
  /** Delete all points whose tenant, provider and connected-account metadata match. Must be idempotent. */
  deleteAccountVectors(input: {
    organizationId: string;
    accountId: string;
    provider: EmailKnowledgeCleanupJob["provider"];
  }): Promise<void>;
};

export type EmailKnowledgeCleanupDependencies = {
  vectors: EmailKnowledgeVectorAdapter;
  purgePostgresDocuments(input: { organizationId: string; accountId: string }): Promise<void>;
  markCompleted(jobId: string): Promise<void>;
  scheduleRetry(jobId: string, safeError: string): Promise<void>;
};

/**
 * Process a durable account-removal cleanup job. Never mark complete until both
 * vector deletion and PostgreSQL document cleanup have succeeded. A retry may
 * repeat vector deletion, so adapters must provide idempotent account-scoped deletes.
 */
export async function processEmailKnowledgeCleanupJob(
  job: EmailKnowledgeCleanupJob,
  dependencies: EmailKnowledgeCleanupDependencies,
): Promise<{ completed: boolean }> {
  try {
    await dependencies.vectors.deleteAccountVectors({
      organizationId: job.organization_id,
      accountId: job.account_id,
      provider: job.provider,
    });
    await dependencies.purgePostgresDocuments({
      organizationId: job.organization_id,
      accountId: job.account_id,
    });
    await dependencies.markCompleted(job.id);
    return { completed: true };
  } catch (error) {
    const safeError = error instanceof Error ? error.message.slice(0, 300) : "Unknown cleanup failure";
    await dependencies.scheduleRetry(job.id, safeError);
    return { completed: false };
  }
}
