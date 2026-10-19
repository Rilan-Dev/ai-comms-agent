import { randomUUID } from 'node:crypto';
import type { BriefingItem, TrustedBriefingPrincipal } from '@ai-comms-agent/shared';
import { withTransaction } from '../client';
import { requireBriefingActor, requireBriefingIds, resolveBriefingScopeInTransaction } from './access';
import { claimBriefingBatch, completeBriefingBatch } from './coverage';

// Preserve direct-module imports while keeping one authoritative coverage ledger.
export { prepareBriefing, listBriefingSources, acknowledgeBriefingItems } from './coverage';

/** No admin shortcut: only user grants ∩ readable agent bindings are listed. */
export function listGrantedBriefingMailboxes(
  principal: TrustedBriefingPrincipal,
): Promise<Array<{ id: string; emailAddress: string }>> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId);
  return withTransaction(async client => {
    await requireBriefingActor(client, principal);
    const result = await client.query<{ id: string; email_address: string }>(
      `SELECT e.id, e.email_address FROM email_accounts e
       JOIN agents a ON a.organization_id=e.organization_id AND a.id=$3 AND a.status='active'
       JOIN agent_email_accounts b ON b.agent_id=a.id AND b.email_account_id=e.id AND b.role IN ('primary','read_only')
       JOIN briefing_mailbox_grants g ON g.organization_id=e.organization_id AND g.mailbox_id=e.id
          AND g.user_id=$2 AND g.revoked_at IS NULL
       WHERE e.organization_id=$1 AND e.deleted_at IS NULL AND e.status::text IN ('active','connected')
       ORDER BY e.email_address, e.id`,
      [principal.organizationId, principal.userId, principal.agentId],
    );
    return result.rows.map(row => ({ id: row.id, emailAddress: row.email_address }));
  });
}

/** Compatibility publication for one bounded batch only. Multi-batch workers
 * must claim and complete each batch through the coverage API. Never browser-callable. */
export async function publishBriefingItems(
  principal: TrustedBriefingPrincipal, manifestId: string, expectedScopeVersion: string,
  generated: BriefingItem[],
): Promise<{ status: "ready" | "partial"; itemCount: number }> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId, manifestId);
  if (!Array.isArray(generated) || generated.length > 100
    || typeof expectedScopeVersion !== 'string' || !/^[a-f0-9]{64}$/.test(expectedScopeVersion)) {
    throw new Error('Invalid generated briefing result');
  }
  const canonical = await withTransaction(async client => {
    await requireBriefingActor(client, principal);
    const row = (await client.query(`SELECT * FROM summaries WHERE id=$1 AND organization_id=$2
      AND owner_user_id=$3 AND agent_id=$4 FOR SHARE`,
    [manifestId, principal.organizationId, principal.userId, principal.agentId])).rows[0];
    if (!row || row.briefing_mode !== 'catch_up' || row.briefing_status !== 'pending'
      || new Date(row.derived_expires_at).getTime() <= Date.now()) throw new Error('Briefing unavailable for publication');
    const scope = await resolveBriefingScopeInTransaction(client, principal, row.mailbox_ids);
    if (scope.scopeVersion !== expectedScopeVersion || scope.scopeVersion !== row.scope_version) throw new Error('Briefing scope changed');
    const batches = (await client.query(`SELECT b.id FROM briefing_generation_batches b JOIN briefing_generation_jobs j ON j.id=b.job_id
      WHERE j.summary_id=$1`, [manifestId])).rows;
    if (batches.length !== 1) throw new Error('Publication requires exactly one batch; use the batch API');
    const sources = (await client.query<{ message_id: string; content_revision: string; revision: string; text_body: string | null }>(
      `SELECT s.email_message_id AS message_id,s.content_revision,briefing_content_revision(m.id) AS revision,m.text_body
       FROM summary_sources s LEFT JOIN email_messages m ON m.id=s.email_message_id
         AND m.organization_id=s.organization_id AND m.email_account_id=s.mailbox_id
       WHERE s.summary_id=$1`, [manifestId])).rows;
    if (!sources.length || sources.length > 50 || sources.some(s => !s.message_id || s.content_revision !== s.revision)) {
      throw new Error('Canonical briefing sources changed');
    }
    const sourceMap = new Map(sources.map(s => [s.message_id, s]));
    for (const item of generated) {
      if (!item || !Array.isArray(item.sourceIds) || !item.sourceIds.length
        || item.sourceIds.some(id => !sourceMap.has(id)) || !Array.isArray(item.evidence)) throw new Error('Invalid represented source');
      const fallback = item.representation === 'partial' && item.confidence === 'uncertain'
        && item.priority === 'low' && item.suggestedAction === 'review' && item.deadline === null
        && item.title === 'Review original email'
        && item.summary === 'An AI-generated summary is not available. Open this email for the complete information.'
        && item.reason === 'Grounded generation was unavailable or did not validate.'
        && item.sourceIds.length === 1;
      if ((!item.evidence.length && !fallback) || item.evidence.some(e => !e
        || !item.sourceIds.includes(e.sourceId) || e.contentRevision !== sourceMap.get(e.sourceId)?.content_revision
        || !Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < 0 || e.end <= e.start
        || typeof e.quote !== 'string' || !e.quote.trim()
        || (sourceMap.get(e.sourceId)?.text_body ?? '').slice(e.start, e.end) !== e.quote)) {
        throw new Error('Briefing evidence no longer matches canonical mail');
      }
    }
    return sources;
  });
  const claim = await claimBriefingBatch(principal, manifestId, `compat-publication:${randomUUID()}`);
  if (!claim) throw new Error('Briefing batch unavailable; retry later');
  if (claim.sources.length !== canonical.length || claim.sources.some(s => !canonical.some(c =>
    c.message_id === s.messageId && c.content_revision === s.contentRevision))) {
    throw new Error('Claimed batch differs from publication sources');
  }
  const partial = claim.partial || generated.some(item => item.representation !== 'complete')
    || canonical.some(s => !generated.some(item => item.sourceIds.includes(s.message_id)));
  // Completion rechecks authorization, source revisions, and the live lease,
  // and writes the scope-versioned ledger atomically with persisted output.
  await completeBriefingBatch(principal, claim, generated, partial);
  return { status: partial ? 'partial' : 'ready', itemCount: generated.length };
}
