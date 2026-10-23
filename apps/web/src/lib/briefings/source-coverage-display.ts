/**
 * Report only the original source-email LINKS currently available in the
 * user's selected, immutable C4 manifest. This is never a count of generated
 * AI summary items, acknowledged work or time since the user's last visit.
 */
export function describeCatchUpSourceCoverage(
  sourceCount: number,
  loadedMessageIds: readonly string[],
  nextCursor: string | null,
): {
  selectedCount: number;
  loadedCount: number;
  remainingCount: number;
  hasMore: boolean;
  complete: boolean;
  message: string;
} {
  const selectedCount = Number.isSafeInteger(sourceCount) && sourceCount > 0 ? sourceCount : 0;
  const loadedCount = Math.min(selectedCount, new Set(loadedMessageIds.filter(id => id.trim().length > 0)).size);
  const remainingCount = Math.max(0, selectedCount - loadedCount);
  const hasMore = typeof nextCursor === "string" && nextCursor.length > 0;
  const complete = selectedCount > 0 && remainingCount === 0 && !hasMore;
  let message: string;
  if (selectedCount === 0) {
    message = "No source emails were selected in this permitted scope. This says nothing about earlier mail or unread status.";
  } else if (hasMore) {
    message = `${loadedCount} of ${selectedCount} source email links loaded. Load more to inspect additional selected emails.`;
  } else if (remainingCount > 0) {
    message = `${loadedCount} of ${selectedCount} source email links loaded. Some selected source links are not yet available; refresh or check selection status.`;
  } else {
    message = `${loadedCount} of ${selectedCount} source email links loaded. All selected source links are available; this does not mean an AI summary was generated or reviewed.`;
  }
  return { selectedCount, loadedCount, remainingCount, hasMore, complete, message };
}
