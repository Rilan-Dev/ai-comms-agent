import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '@ai-comms-agent/shared';

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), assign: vi.fn(), revoke: vi.fn(), origin: vi.fn() }));
vi.mock('@/lib/identity/repository', () => ({ ensureDevSeed: async () => {}, getIdentityAdapter: () => ({}), getIdentityRepository: () => ({}) }));
vi.mock('@/lib/identity/authorization', async original => ({ ...await original<object>(), authorize: mocks.authorize }));
vi.mock('@/lib/identity/local-auth', () => ({ assertSameOrigin: mocks.origin }));
vi.mock('@ai-comms-agent/db', () => ({ assignBriefingMailboxGrant: mocks.assign, revokeBriefingMailboxGrant: mocks.revoke }));
const routePath = '../src/app/api/organizations/[orgId]/briefing-access/route';
const org = '10000000-0000-4000-8000-000000000001';
const user = '10000000-0000-4000-8000-000000000002';
const target = '10000000-0000-4000-8000-000000000003';
const mailbox = '10000000-0000-4000-8000-000000000004';
const context = { params: Promise.resolve({ orgId: org }) };
const body = { targetUserId: target, mailboxId: mailbox, reason: 'Assigned project mailbox' };
const request = (data: unknown = body, method = 'POST') => new Request('http://localhost/api/access', { method, headers: { 'content-type': 'application/json', origin: 'http://localhost' }, body: JSON.stringify(data) });

describe('briefing grant API', () => {
  beforeEach(() => { vi.resetAllMocks(); vi.stubEnv('BRIEFINGS_ENABLED', 'true'); mocks.authorize.mockResolvedValue({ user: { id: user } }); });
  afterEach(() => vi.unstubAllEnvs());
  it('is disabled by default without invoking authority or data services', async () => {
    vi.stubEnv('BRIEFINGS_ENABLED', '');
    const { POST } = await import(routePath);
    expect((await POST(request(), context)).status).toBe(404);
    expect(mocks.authorize).not.toHaveBeenCalled(); expect(mocks.assign).not.toHaveBeenCalled();
  });
  it('uses authenticated identity, URL organization and explicit administration permission', async () => {
    const { POST } = await import(routePath);
    expect((await POST(request(), context)).status).toBe(201);
    expect(mocks.authorize).toHaveBeenCalledWith(expect.any(Request), { organizationId: org, permission: 'briefing.access.manage', role: 'admin' }, {}, {});
    expect(mocks.assign).toHaveBeenCalledWith({ organizationId: org, userId: user }, target, mailbox, body.reason);
    expect(mocks.origin).toHaveBeenCalled();
  });
  it('denies unauthenticated and unauthorized callers before grant writes', async () => {
    const { POST } = await import(routePath);
    for (const [error, status] of [[new UnauthorizedError(), 401], [new ForbiddenError('missing_permission'), 403]] as const) {
      mocks.authorize.mockRejectedValueOnce(error);
      expect((await POST(request(), context)).status).toBe(status);
    }
    expect(mocks.assign).not.toHaveBeenCalled();
  });
  it('refuses foreign-origin mutation', async () => {
    mocks.origin.mockImplementation(() => { throw new Error('Invalid origin'); });
    const { POST } = await import(routePath);
    expect((await POST(request(), context)).status).toBe(403);
    expect(mocks.assign).not.toHaveBeenCalled();
  });
  it('rejects malformed IDs, blank reason and forged extra authority fields', async () => {
    const { POST } = await import(routePath);
    for (const data of [{ ...body, targetUserId: 'bad' }, { ...body, reason: '' }, { ...body, userId: target }, { ...body, organizationId: org }]) {
      expect((await POST(request(data), context)).status).toBe(400);
    }
    expect(mocks.assign).not.toHaveBeenCalled();
  });
  it('revokes using the same permission and trusted actor', async () => {
    const { DELETE } = await import(routePath);
    expect((await DELETE(request(body, 'DELETE'), context)).status).toBe(200);
    expect(mocks.revoke).toHaveBeenCalledWith({ organizationId: org, userId: user }, target, mailbox, body.reason);
  });
});
