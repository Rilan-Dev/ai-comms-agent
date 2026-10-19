import type { BriefingSource, TrustedBriefingPrincipal } from '@ai-comms-agent/shared';
import { withTransaction } from '../client';
import { requireBriefingIds, resolveBriefingScopeInTransaction } from './access';
import type { BriefingBatchClaim } from './coverage';

export type CanonicalBriefingMail = BriefingSource & {
  text: string; subject: string | null; sender: string | null;
  /** No full canonical text body: summary must remain partial. */
  partial: boolean;
};
export type CanonicalBriefingRow = {
  message_id: string; mailbox_id: string; thread_id: string;
  content_revision: string; live_revision: string | null;
  subject: string | null; from_email: string | null;
  text_body: string | null; snippet: string | null;
};

/** Pure final correspondence check: missing, substituted or stale sources fail closed. */
export function validateCanonicalBriefingRows(expected: BriefingSource[], rows: CanonicalBriefingRow[]): CanonicalBriefingMail[] {
  if (!expected.length || expected.length > 50 || rows.length !== expected.length) throw new Error('Briefing canonical sources changed');
  const ids = new Map(expected.map(source => [source.messageId, source]));
  if (ids.size !== expected.length) throw new Error('Duplicate briefing source');
  const used = new Set<string>();
  const validated: CanonicalBriefingMail[] = [];
  for (const row of rows) {
    const original = ids.get(row.message_id);
    if (!original || used.has(row.message_id) ||
      !row.live_revision || row.live_revision !== original.contentRevision ||
      row.content_revision !== original.contentRevision ||
      row.mailbox_id !== original.mailboxId ||
      row.thread_id !== original.threadId) throw new Error('Briefing canonical sources changed');
    used.add(row.message_id);
    // Render only canonical plain text, never unsanitized HTML. Snippets are
    // incomplete evidence and cannot advance full review/coverage.
    validated.push({
      ...original, text: row.text_body ?? row.snippet ?? '',
      subject: row.subject, sender: row.from_email,
      partial: !row.text_body,
    });
  }
  if (used.size !== expected.length) throw new Error('Briefing canonical sources changed');
  return validated;
}

/**
 * Trusted worker-only read. The source IDs come from a fenced C2 claim, not
 * a model/user supplied list. Scope, lease and content revisions are rechecked
 * within one DB transaction before any canonical body leaves PostgreSQL.
 */
export async function loadCanonicalBriefingSources(
  principal: TrustedBriefingPrincipal, claim: BriefingBatchClaim,
): Promise<CanonicalBriefingMail[]> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId,
    claim.manifestId, claim.batchId, claim.leaseToken);
  if (!claim.workerId || claim.workerId.length > 200 ||
      !Array.isArray(claim.sources) || !claim.sources.length || claim.sources.length > 50) {
    throw new Error('Invalid briefing batch claim');
  }
  for (const s of claim.sources) requireBriefingIds(s.messageId, s.mailboxId, s.threadId);
  return withTransaction(async client => {
    const scope = await resolveBriefingScopeInTransaction(client, principal, claim.sources.map(s => s.mailboxId));
    const manifest = await client.query<{ scope_version: string; mailbox_ids: string[] }>(
      `SELECT scope_version,mailbox_ids FROM summaries
       WHERE id=$1 AND organization_id=$2 AND owner_user_id=$3 AND agent_id=$4
         AND briefing_status IN ('pending','partial') FOR SHARE`,
      [claim.manifestId, principal.organizationId, principal.userId, principal.agentId],
    );
    const row = manifest.rows[0];
    if (!row || row.scope_version !== scope.scopeVersion ||
        row.mailbox_ids.length !== scope.mailboxIds.length ||
        row.mailbox_ids.some(id => !scope.mailboxIds.includes(id))) {
      throw new Error('Briefing source scope changed');
    }
    const lease = await client.query<{ source_ids: string[] }>(
      `SELECT b.source_ids FROM briefing_generation_batches b
       JOIN briefing_generation_jobs j ON j.id=b.job_id
       WHERE b.id=$1 AND j.summary_id=$2 AND j.organization_id=$3
         AND j.owner_user_id=$4 AND j.agent_id=$5
         AND b.lease_token=$6 AND b.lease_owner=$7
         AND b.status='running' AND b.lease_expires_at>now() FOR SHARE OF b,j`,
      [claim.batchId, claim.manifestId, principal.organizationId, principal.userId,
        principal.agentId, claim.leaseToken, claim.workerId],
    );
    const sourceIds = lease.rows[0]?.source_ids;
    const sources = await client.query<CanonicalBriefingRow>(
      `SELECT s.email_message_id AS message_id,s.mailbox_id,
              s.source_thread_id AS thread_id,s.content_revision,
              briefing_content_revision(m.id) AS live_revision,
              m.subject,m.from_email,m.text_body,m.snippet
       FROM summary_sources s JOIN email_messages m
         ON m.id=s.email_message_id AND m.organization_id=s.organization_id
        AND m.email_account_id=s.mailbox_id
       WHERE s.summary_id=$1 AND s.organization_id=$2
         AND s.owner_user_id=$3 AND s.agent_id=$4
         AND s.id=ANY($5::uuid[]) AND s.mailbox_id=ANY($6::uuid[])
         AND NOT m.is_draft AND NOT m.is_sent
       ORDER BY s.source_ordinal FOR SHARE OF s,m`,
      [claim.manifestId, principal.organizationId, principal.userId, principal.agentId,
        sourceIds ?? [], scope.mailboxIds],
    );
    // Never substitute a different manifest or batch, including after
    // an expired lease has been reclaimed by another worker.
    if (!sourceIds || sourceIds.length !== claim.sources.length ||
      sources.rows.length !== sourceIds.length) throw new Error('Briefing lease or source selection changed');
    return validateCanonicalBriefingRows(claim.sources, sources.rows);
  });
}
