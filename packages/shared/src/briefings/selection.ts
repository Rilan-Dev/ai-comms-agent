import type { BriefingPeriod, BriefingRequest } from './types';

const DAY = 86_400_000;
/** The retained boundary, not foreground activity, prevents missed unreviewed mail. */
export function briefingPeriod(period: BriefingPeriod | null, now: string, historyStart: string | null): BriefingPeriod {
  const end = Date.parse(period?.end ?? now);
  const start = Date.parse(period?.start ?? historyStart ?? new Date(Date.parse(now) - 7 * DAY).toISOString());
  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= end || end > Date.parse(now)) throw new Error('Invalid briefing period');
  if (period && end - start > 90 * DAY) throw new Error('Initial range exceeds 90 days; use explicit continuation');
  return { start: new Date(start).toISOString(), end: period ? new Date(end).toISOString() : now };
}
export function planBriefingBatches(sources: { id: string; estimatedTokens: number }[]): { sourceIds: string[]; estimatedTokens: number; partial: boolean }[] {
  const batches: { sourceIds: string[]; estimatedTokens: number; partial: boolean }[] = [];
  for (const source of sources) {
    const size = Math.max(1, Math.ceil(source.estimatedTokens));
    if (!Number.isFinite(size)) throw new Error('Invalid source size');
    const tokens = Math.min(size, 12000);
    let batch = batches.at(-1);
    if (!batch || batch.sourceIds.length >= 50 || batch.estimatedTokens + tokens > 12000 || batch.partial || size > 12000) {
      batch = { sourceIds: [], estimatedTokens: 0, partial: size > 12000 }; batches.push(batch);
    }
    batch.sourceIds.push(source.id); batch.estimatedTokens += tokens;
  }
  return batches;
}
export type RoutineCoverageSnapshot = { historyStart: string; completedSourceKeys: ReadonlySet<string> };
export function routineSourceEligible(source: { messageId: string; contentRevision: string; receivedAt: string }, period: BriefingPeriod,
  window: Extract<BriefingRequest,{ mode: 'scheduled' }>['routine']['window'], coverage: RoutineCoverageSnapshot): boolean {
  const received = Date.parse(source.receivedAt);
  const start = Date.parse(window === 'since_previous_occurrence' ? coverage.historyStart : period.start);
  return received >= start && received < Date.parse(period.end) &&
    (window !== 'since_previous_occurrence' || !coverage.completedSourceKeys.has(`${source.messageId}:${source.contentRevision}`));
}

export * from './selection-rules';
