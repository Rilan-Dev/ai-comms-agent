import type { PoolClient } from 'pg';
import { ForbiddenError, type BriefingItem, type BriefingRead, type BriefingList, type BriefingListOptions, type TrustedBriefingPrincipal } from '@ai-comms-agent/shared';
import { withTransaction } from '../client';
import { requireBriefingActor, requireBriefingIds, resolveBriefingScopeInTransaction } from './access';

async function readBriefing(client: PoolClient, principal: TrustedBriefingPrincipal, id: string): Promise<BriefingRead> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId, id);
  await requireBriefingActor(client, principal);
  const result = await client.query(`SELECT * FROM summaries WHERE id=$1 AND organization_id=$2 AND owner_user_id=$3 AND agent_id=$4`,
    [id, principal.organizationId, principal.userId, principal.agentId]);
  const row = result.rows[0];
  if (!row) throw new ForbiddenError('missing_permission', 'Briefing access denied');
  const invalid = (): BriefingRead => ({ manifest: { id, scope: { ...principal, mailboxIds: [], scopeVersion: '' }, mode: row.briefing_mode,
    period: null, sourceCount: 0, status: 'invalidated' }, items: [] });
  let scope;
  try { scope = await resolveBriefingScopeInTransaction(client, principal, row.mailbox_ids); }
  catch (error) { if (error instanceof ForbiddenError) return invalid(); throw error; }
  if (scope.scopeVersion !== row.scope_version || new Date(row.derived_expires_at).getTime() <= Date.now()) return invalid();
  const sources = await client.query(`SELECT s.email_message_id AS id, s.mailbox_id, s.content_revision,
      briefing_content_revision(m.id) AS current_revision
    FROM summary_sources s LEFT JOIN email_messages m ON m.id=s.email_message_id
      AND m.organization_id=s.organization_id AND m.email_account_id=s.mailbox_id
    WHERE s.summary_id=$1 AND s.organization_id=$2 AND s.owner_user_id=$3 AND s.agent_id=$4`,
    [id, principal.organizationId, principal.userId, principal.agentId]);
  if (!sources.rowCount || sources.rows.some(source => !scope.mailboxIds.includes(source.mailbox_id) || !source.id || !source.current_revision || source.content_revision !== source.current_revision)) return invalid();
  const permitted = new Map(sources.rows.map(source => [source.id, source.content_revision]));
  const items = row.content_json;
  if (!Array.isArray(items) || items.some(item => !item || !Array.isArray(item.sourceIds) || !item.sourceIds.length || item.sourceIds.some((source: unknown) => !permitted.has(source)))) return invalid();
  const safeItems: BriefingItem[] = [];
  for (const item of items) {
    if (!Array.isArray(item.evidence) || item.evidence.some((e: BriefingItem['evidence'][number]) =>
      !e || !item.sourceIds.includes(e.sourceId) || permitted.get(e.sourceId) !== e.contentRevision ||
      typeof e.quote !== 'string' || !Number.isInteger(e.start) || !Number.isInteger(e.end) ||
      e.start < 0 || e.end < e.start || !['deadline', 'amount', 'priority_reason', 'summary'].includes(e.supports))) return invalid();
    safeItems.push({ id: item.id, sourceIds: item.sourceIds, priority: item.priority,
      title: item.title, summary: item.summary, reason: item.reason, deadline: item.deadline,
      confidence: item.confidence, suggestedAction: item.suggestedAction,
      evidence: item.evidence.map((e: BriefingItem['evidence'][number]) => ({ sourceId: e.sourceId,
        contentRevision: e.contentRevision, start: e.start, end: e.end, quote: e.quote, supports: e.supports })),
      representation: item.representation, snoozedUntil: item.snoozedUntil });
  }
  return { manifest: { id, scope, mode: row.briefing_mode, period: row.period_start && row.period_end
    ? { start: new Date(row.period_start).toISOString(), end: new Date(row.period_end).toISOString() } : null,
    sourceCount: sources.rowCount, status: row.briefing_status }, items: safeItems };
}

export function getBriefing(principal: TrustedBriefingPrincipal, id: string): Promise<BriefingRead> {
  return withTransaction(client => readBriefing(client, principal, id));
}

export function listBriefings(principal: TrustedBriefingPrincipal, options: BriefingListOptions = {}): Promise<BriefingList> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId);
  const limit = Number.isInteger(options.limit) ? Math.max(1, Math.min(options.limit!, 100)) : 20;
  if (options.before) {
    requireBriefingIds(options.before.id);
    if (!Number.isFinite(Date.parse(options.before.createdAt))) throw new Error('Invalid briefing cursor');
  }
  return withTransaction(async client => {
    await requireBriefingActor(client, principal);
    const result = await client.query<{ id: string; created_at: Date }>(`SELECT id,created_at FROM summaries
      WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3
      AND ($4::timestamptz IS NULL OR (created_at,id)<($4::timestamptz,$5::uuid))
      ORDER BY created_at DESC,id DESC LIMIT $6`, [principal.organizationId, principal.userId, principal.agentId,
      options.before?.createdAt ?? null, options.before?.id ?? null, limit + 1]);
    const rows = result.rows.slice(0, limit);
    const briefings: BriefingRead[] = [];
    for (const row of rows) briefings.push(await readBriefing(client, principal, row.id));
    const last = rows.at(-1);
    return { briefings, nextCursor: result.rows.length > limit && last ? { createdAt: last.created_at.toISOString(), id: last.id } : null };
  });
}
