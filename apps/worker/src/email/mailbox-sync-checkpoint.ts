export type MessageFetchResult<T> = { id: string; message: T | null };

/**
 * Return provider message IDs whose database persistence completed successfully.
 * IDs without a fetched message are handled separately as confirmed missing.
 */
export function successfullyPersistedMessageIds<T>(
  messages: readonly MessageFetchResult<T>[],
  persistenceResults: readonly boolean[],
): string[] {
  return messages
    .filter((entry, index) => entry.message !== null && persistenceResults[index] === true)
    .map((entry) => entry.id);
}

/** IDs the provider no longer returns (for example, Gmail 404 after deletion). */
export function unavailableMessageIds<T>(messages: readonly MessageFetchResult<T>[]): string[] {
  return messages.filter((entry) => entry.message === null).map((entry) => entry.id);
}
