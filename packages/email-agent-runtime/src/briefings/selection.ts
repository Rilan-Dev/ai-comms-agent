/** Host-authenticated entry points; never derive the principal from model output.
 * C3 supplies grounded generation, and R3 supplies scheduled ledger authority. */
export { prepareBriefing, listBriefingSources, acknowledgeBriefingItems, snoozeBriefingItem,
  claimBriefingBatch, heartbeatBriefingBatch, completeBriefingBatch } from '@ai-comms-agent/db';
export type { RoutineCoverageAdapter, BriefingBatchClaim } from '@ai-comms-agent/db';
