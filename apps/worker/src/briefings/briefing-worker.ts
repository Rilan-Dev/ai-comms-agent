import { randomUUID } from "node:crypto";
import type { TrustedBriefingPrincipal } from "@ai-comms-agent/shared";
import type { CanonicalBriefingSource, BriefingGenerator } from "@ai-comms-agent/email-agent-runtime/briefings/generation";
import { generateBriefingBatch } from "@ai-comms-agent/email-agent-runtime/briefings/generation";
import {
  claimBriefingBatch, completeBriefingBatch, heartbeatBriefingBatch,
  type BriefingBatchClaim,
} from "@ai-comms-agent/db";

/**
 * C3 worker core: intentionally not scheduled or registered until canonical
 * source loading, Clara credentials and acceptance are authorized.
 * Every dependency operates with the trusted principal, never a model-provided one.
 */
export interface BriefingWorkerDependencies {
  claim: typeof claimBriefingBatch;
  heartbeat: typeof heartbeatBriefingBatch;
  complete: typeof completeBriefingBatch;
  loadCanonicalSources: (
    principal: TrustedBriefingPrincipal, claim: BriefingBatchClaim,
  ) => Promise<CanonicalBriefingSource[]>;
  generate: BriefingGenerator;
}

export const DEFAULT_BRIEFING_WORKER_DEPENDENCIES: Pick<
  BriefingWorkerDependencies, "claim" | "heartbeat" | "complete"
> = { claim: claimBriefingBatch, heartbeat: heartbeatBriefingBatch, complete: completeBriefingBatch };

const HEARTBEAT_MS = 30_000;

export async function processBriefingBatch(
  principal: TrustedBriefingPrincipal,
  manifestId: string,
  language: string,
  dependencies: BriefingWorkerDependencies,
  workerId = `briefing:${randomUUID()}`,
  heartbeatMs = HEARTBEAT_MS,
): Promise<"completed" | "unavailable"> {
  if (!Number.isInteger(heartbeatMs) || heartbeatMs < 1) throw new Error("Invalid heartbeat interval");
  const claim = await dependencies.claim(principal, manifestId, workerId);
  if (!claim) return "unavailable";
  let lostLease = false;
  let stopped = false;
  let heartbeatFailure: unknown = null;
  let pendingHeartbeat: Promise<void> | undefined;
  const tick = () => {
    if (stopped || pendingHeartbeat) return;
    pendingHeartbeat = Promise.resolve()
      .then(() => dependencies.heartbeat(principal, claim))
      .then(ok => { if (!ok) lostLease = true; })
      .catch(error => { heartbeatFailure = error; lostLease = true; })
      .finally(() => { pendingHeartbeat = undefined; });
  };
  const timer = setInterval(tick, heartbeatMs);
  try {
    // Never trust caller-supplied or LLM-selected source identities.
    const sources = await dependencies.loadCanonicalSources(principal, claim);
    const expected = new Map(claim.sources.map(s => [s.messageId, s]));
    if (expected.size !== claim.sources.length || sources.length !== expected.size ||
      sources.some(s => {
        const original = expected.get(s.messageId);
        return !original || original.contentRevision !== s.contentRevision ||
          original.mailboxId !== s.mailboxId || original.threadId !== s.threadId ||
          typeof s.text !== "string";
      }) || new Set(sources.map(s => s.messageId)).size !== sources.length) {
      throw new Error("Canonical briefing source mismatch");
    }
    const result = await generateBriefingBatch(sources, dependencies.generate, language, { retryProviderErrors: true });
    // The C2 manifest already partitions sources by 50 / 12k tokens. If
    // canonical text has grown beyond the estimate, do not publish a subset:
    // that would silently mark unprocessed mail as represented.
    if (result.considered !== sources.length && (result.status !== "partial" ||
      sources.some(source => !result.items.some(item => item.sourceIds.includes(source.messageId) &&
        item.representation === "partial")))) {
      throw new Error("Canonical briefing input budget changed without partial source links");
    }
    if (pendingHeartbeat) await pendingHeartbeat;
    if (lostLease) throw new Error("Briefing lease lost before completion", { cause: heartbeatFailure });
    // The C2 transaction rechecks live mailbox grants, content revisions,
    // routine authorization and the exact lease token under lock.
    await dependencies.complete(principal, claim, result.items,
      claim.partial || result.status !== "ready");
    return "completed";
  } finally {
    stopped = true;
    clearInterval(timer);
    if (pendingHeartbeat) await pendingHeartbeat;
  }
}
