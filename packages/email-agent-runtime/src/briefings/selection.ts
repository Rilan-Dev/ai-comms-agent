/** Host-authenticated entry points; never derive the principal from model output.
 * C3 supplies grounded generation, and R3 supplies scheduled ledger authority. */
export { prepareBriefing, listBriefingSources, acknowledgeBriefingItems, snoozeBriefingItem,
  claimBriefingBatch, heartbeatBriefingBatch, completeBriefingBatch } from '@ai-comms-agent/db';
export type { RoutineCoverageAdapter, BriefingBatchClaim } from '@ai-comms-agent/db';

// Email workers and the DB share one canonical C2 policy implementation.
export { resolveCatchUpPeriod, sourceFullyReviewed, eligibleCatchUpSource, boundedSourcePage, type ReviewEntry, type SelectionRange } from '@ai-comms-agent/shared';
