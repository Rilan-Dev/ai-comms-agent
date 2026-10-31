import {describe, expect, it} from 'vitest';
import {createInboxRefreshGuard} from '../src/lib/mail/inbox-refresh-guard';
describe('inbox background refresh', () => {
  it('does not replace a longer list when load more starts or has completed', () => {
    const guard = createInboxRefreshGuard();
    const poll = guard.beginPoll();
    const load = guard.beginLoadMore();
    expect(guard.canApplyPoll(poll)).toBe(false);
    expect(guard.beginPoll()).toBeNull();
    guard.finishLoadMore(load, true);
    expect(guard.beginPoll()).toBeNull();
    const refresh = guard.beginRefresh();
    guard.finishRefresh(refresh, true);
    expect(guard.beginPoll()).not.toBeNull();
  });
  it('resumes polling when a load-more request fails', () => {
    const guard = createInboxRefreshGuard();
    const load = guard.beginLoadMore();
    guard.finishLoadMore(load, false);
    expect(guard.beginPoll()).not.toBeNull();
  });
  it('discards an old load-more result after a new filter refresh', () => {
    const guard = createInboxRefreshGuard();
    const load = guard.beginLoadMore();
    const refresh = guard.beginRefresh();
    expect(guard.isCurrent(load)).toBe(false);
    guard.finishLoadMore(load, true);
    guard.finishRefresh(refresh, true);
    expect(guard.beginPoll()).not.toBeNull();
  });
  it('preserves the longer list when a manual refresh fails', () => {
    const guard = createInboxRefreshGuard();
    const load = guard.beginLoadMore();
    guard.finishLoadMore(load, true);
    const refresh = guard.beginRefresh();
    guard.finishRefresh(refresh, false);
    expect(guard.beginPoll()).toBeNull();
  });
});
