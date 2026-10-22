/**
 * Explicit C4 personal lookback presets. This does not inspect foreground
 * visits, provider read flags or briefing acknowledgements. Dates are UTC
 * instants; a 5-day preview is not proof that a user was away for five days.
 */
export const CATCH_UP_DAYS = [1, 5, 7, 30] as const;
export type CatchUpDays = typeof CATCH_UP_DAYS[number];

export function parseCatchUpDays(value: unknown): CatchUpDays {
  if (typeof value !== "string" || !["1", "5", "7", "30"].includes(value)) return 7;
  return Number(value) as CatchUpDays;
}

export function catchUpPeriodUtc(days: CatchUpDays, now: Date): { start: string; end: string } {
  if (!CATCH_UP_DAYS.includes(days)) throw new Error("Unsupported catch-up window");
  const end = now.toISOString();
  return { start: new Date(now.getTime() - days * 86_400_000).toISOString(), end };
}
