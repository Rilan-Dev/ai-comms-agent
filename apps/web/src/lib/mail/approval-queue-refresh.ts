/** Request-local ordering guard for the approval queue.
 * A slow GET must not overwrite state after a newer refresh or PATCH.
 * The guard only controls UI presentation: the server is authoritative.
 */
export function createApprovalQueueRefreshGuard() {
  let epoch = 0;
  return {
    begin(): number { epoch += 1; return epoch; },
    invalidate(): void { epoch += 1; },
    isCurrent(ticket: number): boolean { return ticket === epoch; },
  };
}
