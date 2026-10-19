/** Historical message snapshot only. Incremental live events must never be capped. */
export type InitialImportLimit = 10 | 50 | 100;
export const DEFAULT_INITIAL_IMPORT_LIMIT: InitialImportLimit = 50;

export function parseInitialImportLimit(value: unknown): InitialImportLimit {
  const parsed = typeof value === "number" || typeof value === "string" ? Number(value) : NaN;
  return parsed === 10 || parsed === 50 || parsed === 100 ? parsed : DEFAULT_INITIAL_IMPORT_LIMIT;
}

export function remainingInitialImport(limit: number, imported: number): number {
  if (!Number.isFinite(limit) || !Number.isFinite(imported)) return 0;
  return Math.max(0, Math.min(100, Math.floor(limit)) - Math.max(0, Math.floor(imported)));
}

export function eligibleSyncMessageIds(
  ids: readonly string[],
  mode: "initial" | "incremental",
  limit: number,
  imported: number,
): string[] {
  return mode === "initial" ? ids.slice(0, remainingInitialImport(limit, imported)) : [...ids];
}
