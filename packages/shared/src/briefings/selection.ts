/**
 * C2 personal catch-up selection rules.
 * Pure decisions shared by DB-backed selection and worker regression tests.
 * Review progress is about fully represented source revisions, not read flags,
 * last-login dates, message order, or the presence of a partial AI result.
 */
export type ReviewEntry = {
  itemId: string;
  representation: "complete" | "partial";
  acknowledgedAt: string | null;
};
export type SelectionRange = { start: string; end: string };

export function resolveCatchUpPeriod(
  requested: SelectionRange | null,
  now: Date,
): SelectionRange {
  if (!Number.isFinite(now.getTime())) throw new Error("Invalid current time");
  if (!requested) {
    return { start: new Date(now.getTime() - 7 * 86400000).toISOString(), end: now.toISOString() };
  }
  const start = Date.parse(requested.start);
  const end = Date.parse(requested.end);
  if (!Number.isFinite(start) || !Number.isFinite(end)
    || new Date(start).toISOString() !== requested.start
    || new Date(end).toISOString() !== requested.end
    || end <= start || end > now.getTime() + 60000
    || end - start > 90 * 86400000) {
    throw new Error("Catch-up period must be a valid bounded 90-day ISO range.");
  }
  return { start: requested.start, end: requested.end };
}

/**
 * A source is fully reviewed ONLY when all currently represented obligations
 * are complete and acknowledged. Missing coverage, one of two obligations,
 * partial classification, or snoozed unacknowledged items all remain eligible.
 */
export function sourceFullyReviewed(items: ReviewEntry[]): boolean {
  return items.length > 0
    && items.every((item) => Boolean(item.itemId)
      && item.representation === "complete" && Boolean(item.acknowledgedAt));
}

export function eligibleCatchUpSource(input: {
  receivedAt: string | null;
  committedAt: string;
  isDraft: boolean;
  isSent: boolean;
  period: SelectionRange;
  reviewItems: ReviewEntry[];
}): boolean {
  if (input.isDraft || input.isSent || sourceFullyReviewed(input.reviewItems)) return false;
  const received = input.receivedAt ? Date.parse(input.receivedAt) : NaN;
  const committed = Date.parse(input.committedAt);
  const start = Date.parse(input.period.start), end = Date.parse(input.period.end);
  // Late ingestion of an old email is new work even when its original
  // received timestamp predates the requested catch-up window.
  return (Number.isFinite(received) && received >= start && received < end)
    || (Number.isFinite(committed) && committed >= start && committed < end);
}

export function boundedSourcePage(limit: number): number {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new Error("Source page limit must be between 1 and 200.");
  return limit;
}
