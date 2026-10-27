import type { PoolClient } from 'pg';
import { ForbiddenError, type BriefingItem, type BriefingRead, type BriefingList, type BriefingListOptions, type TrustedBriefingPrincipal } from '@ai-comms-agent/shared';
import { withTransaction } from '../client';
import { requireBriefingActor, requireBriefingIds, resolveBriefingScopeInTransaction } from './access';
import { requireFreshMailboxFlags, MailboxReadStatePendingError } from './read-state';

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
  if (row.briefing_mode === 'catch_up') {
    try { await requireFreshMailboxFlags(client,principal.organizationId,scope.mailboxIds); }
    catch(error) { if(error instanceof MailboxReadStatePendingError) return invalid(); throw error; }
  }
  const sources = await client.query(`SELECT s.email_message_id AS id, s.mailbox_id, s.content_revision,
      briefing_content_revision(m.id) AS current_revision,m.is_read,m.is_draft,m.is_sent
    FROM summary_sources s LEFT JOIN email_messages m ON m.id=s.email_message_id
      AND m.organization_id=s.organization_id AND m.email_account_id=s.mailbox_id
    WHERE s.summary_id=$1 AND s.organization_id=$2 AND s.owner_user_id=$3 AND s.agent_id=$4`,
    [id, principal.organizationId, principal.userId, principal.agentId]);
  if (!Array.isArray(row.selected_source_manifest) || row.selected_source_manifest.length !== sources.rows.length) return invalid();
  const validEmpty = row.briefing_status === 'ready' && Array.isArray(row.content_json) && row.content_json.length === 0;
  if ((!sources.rowCount && !validEmpty) || sources.rows.some(source => !scope.mailboxIds.includes(source.mailbox_id) || !source.id || !source.current_revision || source.content_revision !== source.current_revision
    || source.is_draft || source.is_sent || (row.briefing_mode === 'catch_up' && source.is_read))) return invalid();
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
  // Snooze is personal presentation, never acknowledgement or routine coverage.
  const snoozes = row.briefing_mode === 'catch_up' ? await client.query<{ item_id: string; snoozed_until: Date }>(
    `SELECT item_id,max(snoozed_until) snoozed_until FROM mail_review_items
     WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND scope_version=$4
       AND item_id=ANY($5::text[]) AND acknowledged_at IS NULL AND snoozed_until IS NOT NULL GROUP BY item_id`,
    [principal.organizationId,principal.userId,principal.agentId,scope.scopeVersion,safeItems.map(item => item.id)]) : { rows: [] };
  const snoozed = new Map(snoozes.rows.map(row => [row.item_id, row.snoozed_until]));
  const visibleItems = safeItems.filter(item => !snoozed.has(item.id) || snoozed.get(item.id)!.getTime() <= Date.now())
    .map(item => ({ ...item, snoozedUntil: snoozed.get(item.id)?.toISOString() ?? null }));
  // Cross-device progress is keyed to the same personal source revisions.
  // One of two outstanding obligations must not clear the other.
  const ack = await client.query<{ item_id: string; message_id: string; content_revision: string }>(
    `SELECT item_id,message_id,content_revision FROM mail_review_items
     WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3
       AND scope_version=$5 AND acknowledged_at IS NOT NULL AND message_id=ANY($4::uuid[])`,
    [principal.organizationId,principal.userId,principal.agentId,sources.rows.map(source => source.id),scope.scopeVersion],
  );
  const acknowledged = new Set(ack.rows.map(r => `${r.item_id}:${r.message_id}:${r.content_revision}`));
  const reviewedItemIds = safeItems.filter(item => item.representation === 'complete'
    && item.sourceIds.every(sourceId => acknowledged.has(`${item.id}:${sourceId}:${permitted.get(sourceId)}`)))
    .map(item => item.id);
  return { manifest: { id, scope, mode: row.briefing_mode, period: row.period_start && row.period_end
    ? { start: new Date(row.period_start).toISOString(), end: new Date(row.period_end).toISOString() } : null,
    sourceCount: sources.rows.length, status: row.briefing_status }, items: visibleItems, reviewedItemIds };
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
