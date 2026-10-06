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
  void tick();
  const timer = setInterval(() => { void tick(); }, INTERVAL_MS);
  return () => { stopped = true; clearInterval(timer); };
}
