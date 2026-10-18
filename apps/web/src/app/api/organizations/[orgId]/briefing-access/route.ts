import { NextResponse } from 'next/server';
import { asOrganizationId } from '@ai-comms-agent/shared';
import { assignBriefingMailboxGrant, revokeBriefingMailboxGrant } from '@ai-comms-agent/db';
import { authorize, authorizationErrorToResponse } from '@/lib/identity/authorization';
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from '@/lib/identity/repository';
import { assertSameOrigin } from '@/lib/identity/local-auth';
import { briefingsEnabled } from '@/lib/briefings/config';

export const dynamic = 'force-dynamic';
type Context = { params: Promise<{ orgId: string }> };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function mutate(request: Request, context: Context, revoke: boolean) {
  if (!briefingsEnabled()) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: 'invalid_origin' }, { status: 403 }); }
  try {
    await ensureDevSeed();
    const { orgId } = await context.params;
    if (!uuid.test(orgId)) return NextResponse.json({ error: 'invalid_organization' }, { status: 400 });
    const subject = await authorize(request, { organizationId: asOrganizationId(orgId), permission: 'briefing.access.manage', role: 'admin' }, getIdentityAdapter(), getIdentityRepository());
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !['targetUserId', 'mailboxId', 'reason'].includes(key))
      || typeof body.targetUserId !== 'string' || !uuid.test(body.targetUserId)
      || typeof body.mailboxId !== 'string' || !uuid.test(body.mailboxId)
      || typeof body.reason !== 'string' || !body.reason.trim() || body.reason.trim().length > 2000) {
      return NextResponse.json({ error: 'validation_error' }, { status: 400 });
    }
    const operation = revoke ? revokeBriefingMailboxGrant : assignBriefingMailboxGrant;
    await operation({ organizationId: orgId, userId: subject.user.id }, body.targetUserId, body.mailboxId, body.reason.trim());
    return NextResponse.json({ status: revoke ? 'revoked' : 'assigned' }, { status: revoke ? 200 : 201, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export const POST = (request: Request, context: Context) => mutate(request, context, false);
export const DELETE = (request: Request, context: Context) => mutate(request, context, true);
