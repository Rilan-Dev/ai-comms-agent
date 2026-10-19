import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ query: vi.fn(), actor: vi.fn(), scope: vi.fn(), claim: vi.fn(), complete: vi.fn() }));
vi.mock('../../../packages/db/src/client', () => ({ withTransaction: (fn: Function) => fn({ query: mocks.query }) }));
vi.mock('../../../packages/db/src/briefings/access', () => ({ requireBriefingIds: vi.fn(), requireBriefingActor: mocks.actor, resolveBriefingScopeInTransaction: mocks.scope }));
vi.mock('../../../packages/db/src/briefings/coverage', () => ({ claimBriefingBatch: mocks.claim, completeBriefingBatch: mocks.complete,
  prepareBriefing: vi.fn(), listBriefingSources: vi.fn(), acknowledgeBriefingItems: vi.fn() }));
import { publishBriefingItems } from '../../../packages/db/src/briefings/selection';
import type { BriefingItem } from '@ai-comms-agent/shared';
const version = 'a'.repeat(64);
const principal = { organizationId: 'org', userId: 'user', agentId: 'agent' };
const item: BriefingItem = { id: 'ignored-model-id', sourceIds: ['message'], title: 'Reply', summary: 'Reply', reason: 'Request', priority: 'low', confidence: 'supported', suggestedAction: 'reply', deadline: null, representation: 'complete', snoozedUntil: null,
  evidence: [{ sourceId: 'message', contentRevision: 'revision', start: 0, end: 5, quote: 'Reply', supports: 'summary' }] };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.scope.mockResolvedValue({ scopeVersion: version });
  mocks.query.mockResolvedValueOnce({ rows: [{ briefing_mode: 'catch_up', briefing_status: 'pending', derived_expires_at: '2099-01-01', scope_version: version, mailbox_ids: ['mailbox'] }] })
    .mockResolvedValueOnce({ rows: [{ id: 'batch' }] })
    .mockResolvedValueOnce({ rows: [{ message_id: 'message', content_revision: 'revision', revision: 'revision', text_body: 'Reply now' }] });
  mocks.claim.mockResolvedValue({ batchId: 'batch', sources: [{ messageId: 'message', contentRevision: 'revision' }], partial: false });
});
describe('single-batch publication compatibility', () => {
  it('passes canonical output through a claimed batch and completion', async () => {
    await expect(publishBriefingItems(principal, 'manifest', version, [item])).resolves.toEqual({ status: 'ready', itemCount: 1 });
    expect(mocks.complete).toHaveBeenCalledWith(principal, await mocks.claim.mock.results[0]!.value, [item], false);
  });
  it('rejects multiple batches before acquiring a lease', async () => {
    mocks.query.mockReset().mockResolvedValueOnce({ rows: [{ briefing_mode: 'catch_up', briefing_status: 'pending', derived_expires_at: '2099-01-01', scope_version: version }] }).mockResolvedValueOnce({ rows: [{ id: 'one' }, { id: 'two' }] });
    await expect(publishBriefingItems(principal, 'manifest', version, [item])).rejects.toThrow('batch API');
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('rejects fabricated quote before claiming', async () => {
    await expect(publishBriefingItems(principal, 'manifest', version, [{ ...item, evidence: [{ ...item.evidence[0]!, quote: 'Fake!' }] }])).rejects.toThrow('canonical mail');
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('does not publish a full manifest against a different claimed subset', async () => {
    mocks.claim.mockResolvedValue({ sources: [], partial: false });
    await expect(publishBriefingItems(principal, 'manifest', version, [item])).rejects.toThrow('Claimed batch');
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it('fails closed when current scope changed', async () => {
    mocks.scope.mockResolvedValue({ scopeVersion: 'b'.repeat(64) });
    await expect(publishBriefingItems(principal, 'manifest', version, [item])).rejects.toThrow('scope changed');
    expect(mocks.claim).not.toHaveBeenCalled();
  });
  it('does not bypass unavailable or expired leases', async () => {
    mocks.claim.mockResolvedValue(null);
    await expect(publishBriefingItems(principal, 'manifest', version, [item])).rejects.toThrow('batch unavailable');
    expect(mocks.complete).not.toHaveBeenCalled();
  });
});
