/** Prevent a background first-page refresh from replacing pages the user opened. */
export function createInboxRefreshGuard() {
  let generation = 0;
  let loadingMore = false;
  let expanded = false;
  let refreshing = false;
  return {
    beginPoll: () => loadingMore || expanded || refreshing ? null : generation,
    canApplyPoll: (token: number | null) => token !== null && token === generation && !loadingMore && !expanded && !refreshing,
    beginLoadMore: () => { generation++; loadingMore = true; refreshing = false; return generation; },
    isCurrent: (token: number) => token === generation,
    finishLoadMore: (token: number, success: boolean) => { if (token === generation) { loadingMore = false; if (success) expanded = true; } },
    beginRefresh: () => { generation++; loadingMore = false; refreshing = true; return generation; },
    finishRefresh: (token: number, success: boolean) => { if (token === generation) { refreshing = false; if (success) expanded = false; } },
  };
}
