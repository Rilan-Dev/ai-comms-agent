import { listDraftsPendingProviderSync } from "@ai-comms-agent/db";
import { syncLocalDraftToProvider } from "./draft-sync";

const INTERVAL_MS = 5_000;
let running = false;

export async function processPendingProviderDraftSync(limit = 10) {
  if (running) return { processed: 0 };
  running = true;
  let processed = 0;
  try {
    const jobs = await listDraftsPendingProviderSync(limit);
    for (const job of jobs) {
      try {
        await syncLocalDraftToProvider(job.organization_id, job.id);
      } catch {
        // draft-sync records the durable error state and audit event.
      }
      processed += 1;
    }
    return { processed };
  } finally {
    running = false;
  }
}

export function startProviderDraftSyncLoop() {
  if (!process.env.DATABASE_URL || process.env.EMAIL_PROVIDER_DRAFT_SYNC_DISABLED === "true") return () => undefined;
  let stopped = false;
  const tick = async () => {
    if (stopped) return;
    await processPendingProviderDraftSync();
  };
  void tick().catch((error) => {
    // Transient DB errors (e.g. Prisma Postgres planLimitReached, connection
    // resets, PgBouncer transaction-mode hiccups) MUST NOT crash the worker.
    // Log structured error and let the next interval tick retry.
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      service: "worker.provider-draft-sync",
      message: "Provider draft sync tick failed",
      reason: error instanceof Error ? error.message : "Unknown error",
    }));
  });
  const timer = setInterval(() => {
    void tick().catch((error) => {
      console.error(JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        service: "worker.provider-draft-sync",
        message: "Provider draft sync tick failed",
        reason: error instanceof Error ? error.message : "Unknown error",
      }));
    });
  }, INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
