import { createHash } from 'node:crypto';
import type { PoolClient } from 'pg';
import { ForbiddenError, SYSTEM_ROLE_PERMISSIONS, type EffectiveBriefingScope, type MembershipRole, type TrustedBriefingPrincipal } from '@ai-comms-agent/shared';
import { withTransaction } from '../client';

export type BriefingActor = { organizationId: string; userId: string };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function requireBriefingIds(...ids: string[]): void {
  if (ids.some(id => typeof id !== 'string' || !uuid.test(id))) throw new ForbiddenError('not_member', 'Briefing access denied');
}
const denied = () => new ForbiddenError('missing_permission', 'Briefing access denied');

/** Internal transaction primitive. Identity must come from the authenticated host. */
export async function requireBriefingActor(client: PoolClient, actor: BriefingActor, manage = false): Promise<void> {
  requireBriefingIds(actor.organizationId, actor.userId);
  const result = await client.query<{ role: MembershipRole }>(`
    SELECT m.role FROM organization_memberships m
    JOIN users u ON u.id=m.user_id JOIN organizations o ON o.id=m.organization_id
    WHERE m.organization_id=$1 AND m.user_id=$2 AND m.status='active'
      AND u.status='active' AND u.deleted_at IS NULL AND o.status='active' AND o.deleted_at IS NULL
    FOR SHARE OF m,u,o`, [actor.organizationId, actor.userId]);
  const role = result.rows[0]?.role;
  const permission = manage ? 'briefing.access.manage' : 'email.read';
  if (!role || !SYSTEM_ROLE_PERMISSIONS[role]?.includes(permission)
    || (manage && role !== 'owner' && role !== 'admin')) throw denied();
}

export async function resolveBriefingScopeInTransaction(client: PoolClient, principal: TrustedBriefingPrincipal, mailboxIds: string[]): Promise<EffectiveBriefingScope> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId);
  if (!Array.isArray(mailboxIds) || mailboxIds.length < 1 || mailboxIds.length > 100) throw denied();
  requireBriefingIds(...mailboxIds);
  const ids = [...new Set(mailboxIds)].sort();
  await requireBriefingActor(client, principal);
  const result = await client.query<{ id: string; version: string; binding_id: string; role: string }>(`
    SELECT e.id,g.version::text,b.id AS binding_id,b.role
    FROM agents a JOIN agent_email_accounts b ON b.agent_id=a.id
    JOIN email_accounts e ON e.id=b.email_account_id AND e.organization_id=a.organization_id
    JOIN briefing_mailbox_grants g ON g.organization_id=e.organization_id AND g.mailbox_id=e.id AND g.user_id=$2
    WHERE a.organization_id=$1 AND a.id=$3 AND a.status='active'
      AND e.id=ANY($4::uuid[]) AND e.deleted_at IS NULL AND e.status::text IN ('active','connected')
      AND b.role IN ('primary','read_only') AND g.revoked_at IS NULL
    ORDER BY e.id FOR SHARE OF a,b,e,g`, [principal.organizationId, principal.userId, principal.agentId, ids]);
  if (result.rows.length !== ids.length) throw denied();
  const scopeVersion = createHash('sha256').update(JSON.stringify([principal.organizationId, principal.userId, principal.agentId, result.rows])).digest('hex');
  return { ...principal, mailboxIds: ids, scopeVersion };
}

export function resolveBriefingScope(principal: TrustedBriefingPrincipal, mailboxIds: string[]): Promise<EffectiveBriefingScope> {
  return withTransaction(client => resolveBriefingScopeInTransaction(client, principal, mailboxIds));
}

async function changeGrant(actor: BriefingActor, targetUserId: string, mailboxId: string, reason: string, revoke: boolean): Promise<void> {
  requireBriefingIds(actor.organizationId, actor.userId, targetUserId, mailboxId);
  if (typeof reason !== 'string' || !reason.trim() || reason.trim().length > 2000) throw new Error('A bounded grant reason is required');
  await withTransaction(async client => {
    await requireBriefingActor(client, actor, true);
    // Serialize first insert as well as updates for this exact grant.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`briefing:${actor.organizationId}:${targetUserId}:${mailboxId}`]);
    const target = await client.query(`SELECT m.user_id FROM organization_memberships m JOIN users u ON u.id=m.user_id
      JOIN email_accounts e ON e.organization_id=m.organization_id
      WHERE m.organization_id=$1 AND m.user_id=$2 AND e.id=$3
      AND ($4 OR (m.status='active' AND u.status='active' AND u.deleted_at IS NULL
      AND e.deleted_at IS NULL AND e.status::text IN ('active','connected'))) FOR SHARE OF m,u,e`, [actor.organizationId, targetUserId, mailboxId, revoke]);
    if (!target.rowCount) throw denied();
    const previous = await client.query('SELECT version::text,revoked_at FROM briefing_mailbox_grants WHERE organization_id=$1 AND user_id=$2 AND mailbox_id=$3 FOR UPDATE', [actor.organizationId, targetUserId, mailboxId]);
    const old = previous.rows[0];
    await client.query(`INSERT INTO briefing_mailbox_grants(organization_id,user_id,mailbox_id,assigned_by,reason,revoked_at)
      VALUES($1,$2,$3,$4,$5,CASE WHEN $6 THEN now() ELSE NULL END)
      ON CONFLICT(organization_id,user_id,mailbox_id) DO UPDATE SET version=briefing_mailbox_grants.version+1,
        assigned_by=EXCLUDED.assigned_by,reason=EXCLUDED.reason,assigned_at=now(),revoked_at=EXCLUDED.revoked_at`,
    [actor.organizationId, targetUserId, mailboxId, actor.userId, reason.trim(), revoke]);
    const action = revoke ? 'briefing.access.revoke' : 'briefing.access.assign';
    await client.query(`INSERT INTO audit_events(organization_id,actor_user_id,event_type,target_type,target_id,action,decision,metadata)
      VALUES($1,$2,$3,'email_account',$4,$3,'allowed',$5::jsonb)`, [actor.organizationId, actor.userId, action, mailboxId,
      JSON.stringify({ targetUserId, mailboxId, oldScope: { active: !!old && old.revoked_at === null, version: old?.version ?? null }, newScope: { active: !revoke }, reason: reason.trim() })]);
  });
}

export function assignBriefingMailboxGrant(actor: BriefingActor, targetUserId: string, mailboxId: string, reason: string): Promise<void> {
  return changeGrant(actor, targetUserId, mailboxId, reason, false);
}
export function revokeBriefingMailboxGrant(actor: BriefingActor, targetUserId: string, mailboxId: string, reason: string): Promise<void> {
  return changeGrant(actor, targetUserId, mailboxId, reason, true);
}

/** nowIso is supplied by trusted server code, never a request's timestamp. */
export async function recordForegroundActivity(principal: TrustedBriefingPrincipal, nowIso = new Date().toISOString()): Promise<void> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId);
  if (!Number.isFinite(Date.parse(nowIso))) throw new Error('Invalid server timestamp');
  await withTransaction(async client => {
    await requireBriefingActor(client, principal);
    const accounts = await client.query<{ mailbox_id: string }>(`SELECT g.mailbox_id FROM briefing_mailbox_grants g
      JOIN agent_email_accounts b ON b.email_account_id=g.mailbox_id AND b.agent_id=$3
      JOIN email_accounts e ON e.id=g.mailbox_id AND e.organization_id=g.organization_id
      WHERE g.organization_id=$1 AND g.user_id=$2 AND g.revoked_at IS NULL AND b.role IN ('primary','read_only')
        AND e.deleted_at IS NULL AND e.status::text IN ('active','connected')`,
    [principal.organizationId, principal.userId, principal.agentId]);
    await resolveBriefingScopeInTransaction(client, principal, accounts.rows.map(row => row.mailbox_id));
    await client.query(`INSERT INTO user_mail_activity(organization_id,user_id,agent_id,last_foreground_at) VALUES($1,$2,$3,$4)
      ON CONFLICT(organization_id,user_id,agent_id) DO UPDATE SET last_foreground_at=EXCLUDED.last_foreground_at
      WHERE user_mail_activity.last_foreground_at <= EXCLUDED.last_foreground_at - interval '60 seconds'`,
    [principal.organizationId, principal.userId, principal.agentId, nowIso]);
  });
}
