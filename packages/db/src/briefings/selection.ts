import { createHash } from 'node:crypto';
import type { PoolClient, QueryResult } from 'pg';
import {
  ForbiddenError, boundedSourcePage, resolveCatchUpPeriod, type BriefingManifest,
  type BriefingRequest, type BriefingSource, type BriefingItem,
  type EffectiveBriefingScope, type TrustedBriefingPrincipal,
} from '@ai-comms-agent/shared';
import { withTransaction } from '../client';
import { requireBriefingActor, requireBriefingIds, resolveBriefingScopeInTransaction } from './access';

/** C2 selects immutable source revisions; user-facing text stays behind C3. */
type Candidate = { id: string; mailbox_id: string; thread_id: string; revision: string | null };
const notAvailable = () => new ForbiddenError('missing_permission', 'Briefing is not available for this scope.');
const MAX_CANDIDATES = 5000;
const PAGE_SIZE = 200;

function validateRequest(request: BriefingRequest): void {
  // Scheduled coverage deliberately has a different ledger. Never use personal
  // review state to generate or suppress routine mail.
  if (request.mode !== 'catch_up') throw new Error('Scheduled briefing selection is not yet enabled.');
  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{0,127}$/.test(request.requestKey)) throw new Error('Invalid idempotency key.');
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(request.language)) throw new Error('Invalid briefing language.');
}

function asManifest(row: Record<string, unknown>, scope: EffectiveBriefingScope): BriefingManifest {
  return {
    id: String(row.id), scope, mode: 'catch_up',
    period: { start: new Date(String(row.period_start)).toISOString(), end: new Date(String(row.period_end)).toISOString() },
    sourceCount: Number(row.source_count ?? 0),
    status: row.briefing_status as BriefingManifest['status'],
  };
}

async function validatedManifest(
  client: PoolClient, principal: TrustedBriefingPrincipal, summaryId: string,
): Promise<{ row: Record<string, unknown>; scope: EffectiveBriefingScope }> {
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId, summaryId);
  await requireBriefingActor(client, principal);
  const r = await client.query<Record<string, unknown>>(
    `SELECT *, jsonb_array_length(selected_source_manifest)::int AS source_count FROM summaries WHERE id=$1 AND organization_id=$2 AND owner_user_id=$3
       AND agent_id=$4 AND summary_type='personal_briefing' FOR SHARE`,
    [summaryId, principal.organizationId, principal.userId, principal.agentId],
  );
  const row = r.rows[0];
  if (!row || !Array.isArray(row.mailbox_ids)) throw notAvailable();
  const scope = await resolveBriefingScopeInTransaction(client, principal, row.mailbox_ids as string[]);
  if (scope.scopeVersion !== row.scope_version || Date.parse(String(row.derived_expires_at)) <= Date.now()) throw notAvailable();

  // Check every selected revision, not just sources on the requested page.
  // Changed/deleted/revoked content cannot leak through a cached manifest.
  const evidence = await client.query<{ id: string; mailbox_id: string; revision: string | null; stored_revision: string }>(
    `SELECT s.email_message_id AS id, s.mailbox_id,
      briefing_content_revision(s.email_message_id) AS revision,
      s.content_revision AS stored_revision
     FROM summary_sources s WHERE s.summary_id=$1 AND s.organization_id=$2
       AND s.owner_user_id=$3 AND s.agent_id=$4`,
    [summaryId, principal.organizationId, principal.userId, principal.agentId],
  );
  if (evidence.rowCount !== Number(row.source_count ?? 0)
    || evidence.rows.some(s => !s.id || !scope.mailboxIds.includes(s.mailbox_id)
      || !s.revision || s.revision !== s.stored_revision)) throw notAvailable();
  return { row, scope };
}

export async function prepareBriefing(
  principal: TrustedBriefingPrincipal,
  request: BriefingRequest,
  now = new Date(),
): Promise<BriefingManifest> {
  validateRequest(request);
  requireBriefingIds(principal.organizationId, principal.userId, principal.agentId);
  const period = resolveCatchUpPeriod(request.period, now);
  return withTransaction(async client => {
    // Fix one snapshot for all 200-row pages. A late-committed mail remains
    // eligible for the NEXT request and cannot slip past a timestamp cursor.
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const scope = await resolveBriefingScopeInTransaction(client, principal, request.mailboxIds);
    const key = createHash('sha256').update(JSON.stringify([principal, scope.scopeVersion, request.requestKey])).digest('hex');
    // Idempotency covers simultaneous browser/devices and process retries.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [key]);
    const prior = await client.query<Record<string, unknown>>(
      `SELECT s.*, jsonb_array_length(s.selected_source_manifest)::int AS source_count
       FROM briefing_generation_jobs j JOIN summaries s ON s.id=j.summary_id
       WHERE j.organization_id=$1 AND j.owner_user_id=$2 AND j.agent_id=$3
         AND j.scope_version=$4 AND j.request_key=$5`,
      [principal.organizationId, principal.userId, principal.agentId, scope.scopeVersion, request.requestKey],
    );
    if (prior.rows[0]) return asManifest(prior.rows[0], scope);

    const selected: Candidate[] = [];
    let after: string | null = null;
    let truncated = false;
    // Stable UUID keyset and a single MVCC snapshot; equal timestamps don't
    // collapse, and read-state/folder metadata don't determine coverage.
    while (true) {
      const r: QueryResult<Candidate> = await client.query<Candidate>(
        `SELECT m.id, m.email_account_id AS mailbox_id, m.thread_id,
             briefing_content_revision(m.id) AS revision
         FROM email_messages m JOIN email_threads t
           ON t.id=m.thread_id AND t.organization_id=m.organization_id AND t.email_account_id=m.email_account_id
         WHERE m.organization_id=$1 AND m.email_account_id=ANY($2::uuid[])
           AND NOT m.is_draft AND NOT m.is_sent
           AND ((COALESCE(m.received_at,m.created_at)>=$3 AND COALESCE(m.received_at,m.created_at)<$4)
             OR (m.created_at >= $3 AND m.created_at < $4))
           AND ($5::uuid IS NULL OR m.id>$5::uuid)
           AND NOT EXISTS (
             SELECT 1 FROM mail_review_items rev
              WHERE rev.organization_id=$1 AND rev.owner_user_id=$6 AND rev.agent_id=$7
                AND rev.message_id=m.id AND rev.content_revision=briefing_content_revision(m.id)
              GROUP BY rev.message_id
              HAVING COUNT(*)>0
                AND COUNT(*) FILTER (WHERE rev.representation='complete' AND rev.acknowledged_at IS NOT NULL)=COUNT(*)
           )
         ORDER BY m.id LIMIT $8`,
        [principal.organizationId, scope.mailboxIds, period.start, period.end, after, principal.userId, principal.agentId, PAGE_SIZE],
      );
      for (const row of r.rows) {
        if (selected.length === MAX_CANDIDATES) { truncated = true; break; }
        selected.push(row);
      }
      if (truncated || r.rows.length < PAGE_SIZE) break;
      after = r.rows.at(-1)?.id ?? null;
      if (selected.length === MAX_CANDIDATES) {
        // Conservative continuation flag: 5,000 selected records are a
        // bounded incomplete selection, not permission to claim every older
        // obligation was considered.
        truncated = true;
        break;
      }
    }

    const manifestSources = selected.map(row => ({
      messageId: row.id, mailboxId: row.mailbox_id, threadId: row.thread_id, contentRevision: row.revision,
    }));
    const status: BriefingManifest['status'] = truncated ? 'partial' : selected.length ? 'pending' : 'ready';
    const inserted = await client.query<{ id: string }>(
      `INSERT INTO summaries(organization_id,agent_id,summary_type,period_start,period_end,content,
        content_json,owner_user_id,mailbox_ids,briefing_status,briefing_mode,scope_version,selected_source_manifest,
        coverage_metadata)
       VALUES($1,$2,'personal_briefing',$3,$4,'','[]'::jsonb,$5,$6::uuid[],$7,'catch_up',$8,$9::jsonb,$10::jsonb)
       RETURNING id`,
      [principal.organizationId, principal.agentId, period.start, period.end,
        principal.userId, scope.mailboxIds, status, scope.scopeVersion,
        JSON.stringify(manifestSources), JSON.stringify({ selectionTruncated: truncated, language: request.language })],
    );
    const summaryId = inserted.rows[0]?.id;
    if (!summaryId) throw new Error('Could not persist catch-up selection');
    if (manifestSources.length) await client.query(
      `INSERT INTO summary_sources(summary_id,organization_id,owner_user_id,agent_id,mailbox_id,email_message_id,content_revision)
       SELECT $1,$2,$3,$4,j.mailbox_id,j.message_id,j.content_revision
         FROM jsonb_to_recordset($5::jsonb) AS j(message_id uuid,mailbox_id uuid,content_revision text)`,
      [summaryId, principal.organizationId, principal.userId, principal.agentId,
        JSON.stringify(manifestSources.map(x => ({
          message_id: x.messageId, mailbox_id: x.mailboxId, content_revision: x.contentRevision,
        })))],
    );
    await client.query(
      `INSERT INTO briefing_generation_jobs(organization_id,owner_user_id,agent_id,summary_id,request_key,scope_version,status)
       VALUES($1,$2,$3,$4,$5,$6,$7)`,
      [principal.organizationId, principal.userId, principal.agentId, summaryId, request.requestKey,
        scope.scopeVersion, status],
    );
    return { id: summaryId, scope, mode: 'catch_up', period, sourceCount: selected.length, status };
  });
}

export async function listBriefingSources(
  principal: TrustedBriefingPrincipal, manifestId: string, cursor: string | null = null, limit = 200,
): Promise<{ items: BriefingSource[]; nextCursor: string | null }> {
  boundedSourcePage(limit);
  if (cursor) requireBriefingIds(cursor);
  return withTransaction(async client => {
    await validatedManifest(client, principal, manifestId);
    const r = await client.query<{ message_id: string; mailbox_id: string; thread_id: string; content_revision: string }>(
      `SELECT s.email_message_id AS message_id, s.mailbox_id, m.thread_id, s.content_revision
       FROM summary_sources s JOIN email_messages m ON m.id=s.email_message_id
          AND m.email_account_id=s.mailbox_id AND m.organization_id=s.organization_id
       WHERE s.summary_id=$1 AND s.organization_id=$2 AND s.owner_user_id=$3
         AND s.agent_id=$4 AND ($5::uuid IS NULL OR s.email_message_id>$5::uuid)
       ORDER BY s.email_message_id LIMIT $6`,
      [manifestId, principal.organizationId, principal.userId, principal.agentId, cursor, limit + 1],
    );
    return {
      items: r.rows.slice(0, limit).map(row => ({
        messageId: row.message_id, mailboxId: row.mailbox_id,
        threadId: row.thread_id, contentRevision: row.content_revision,
      })),
      nextCursor: r.rows.length > limit ? r.rows[limit - 1]?.message_id ?? null : null,
    };
  });
}

export async function acknowledgeBriefingItems(
  principal: TrustedBriefingPrincipal, manifestId: string,
  itemIds: string[], expectedScopeVersion: string,
): Promise<{ reviewed: number }> {
  if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > 200
    || itemIds.some(id => typeof id !== 'string' || id.length > 200 || !id.trim())
    || typeof expectedScopeVersion !== 'string' || expectedScopeVersion.length !== 64) {
    throw new Error('Invalid briefing review request');
  }
  return withTransaction(async client => {
    // Serialize two-device acknowledgement and concurrent source updates.
    const { row, scope } = await validatedManifest(client, principal, manifestId);
    if (scope.scopeVersion !== expectedScopeVersion) throw new Error('Briefing scope changed; reload before reviewing.');
    if (row.briefing_status !== 'ready') throw new Error('Only a fully generated briefing can be reviewed.');
    const items = row.content_json as BriefingItem[];
    if (!Array.isArray(items)) throw notAvailable();
    const unique = [...new Set(itemIds)];
    const targets = unique.map(id => items.find(item => item?.id === id));
    if (targets.some(item => !item || item.representation !== 'complete'
      || (item.snoozedUntil && Date.parse(item.snoozedUntil) > Date.now()))) {
      throw new Error('Only complete, unsnoozed generated items may be reviewed.');
    }
    // Do not derive authorization, mailbox IDs or source revisions from the
    // model's item body. All referenced sources must be in the actual manifest.
    const src = await client.query<{ message_id: string; mailbox_id: string; content_revision: string }>(
      `SELECT email_message_id AS message_id,mailbox_id,content_revision
       FROM summary_sources WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND summary_id=$4`,
      [principal.organizationId, principal.userId, principal.agentId, manifestId],
    );
    const permitted = new Map(src.rows.map(r => [r.message_id, r]));
    let reviewed = 0;
    for (const item of targets as BriefingItem[]) {
      if (!item.sourceIds.length || item.sourceIds.some(id => !permitted.has(id))) throw notAvailable();
      for (const sourceId of item.sourceIds) {
        const source = permitted.get(sourceId)!;
        const result = await client.query(
          `INSERT INTO mail_review_items(organization_id,owner_user_id,agent_id,mailbox_id,message_id,
            content_revision,item_id,representation,acknowledged_at)
           VALUES($1,$2,$3,$4,$5,$6,$7,'complete',now())
           ON CONFLICT(organization_id,owner_user_id,agent_id,message_id,content_revision,item_id)
           DO UPDATE SET acknowledged_at=COALESCE(mail_review_items.acknowledged_at,now())
           WHERE mail_review_items.representation='complete'
           RETURNING (xmax=0) AS inserted`,
          [principal.organizationId, principal.userId, principal.agentId, source.mailbox_id,
            sourceId, source.content_revision, item.id],
        );
        if (!result.rowCount) throw new Error('Review item is not fully represented.');
        if (result.rows[0]?.inserted) reviewed++;
      }
    }
    return { reviewed };
  });
}

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

/**
 * C3 worker publication boundary. Source-grounded generation does not become
 * a "ready" personal briefing until all provenance is rechecked and every
 * represented obligation is registered in the review ledger in one commit.
 * This function is NEVER called from a browser route.
 */
export async function publishBriefingItems(
  principal: TrustedBriefingPrincipal,
  manifestId: string,
  expectedScopeVersion: string,
  generated: BriefingItem[],
): Promise<{ status: "ready" | "partial"; itemCount: number }> {
  if (!Array.isArray(generated) || generated.length > 1000
    || typeof expectedScopeVersion !== "string" || expectedScopeVersion.length !== 64) {
    throw new Error("Invalid generated briefing result");
  }
  return withTransaction(async client => {
    const { row, scope } = await validatedManifest(client, principal, manifestId);
    if (scope.scopeVersion !== expectedScopeVersion) throw notAvailable();
    if (row.briefing_status === "ready" && Number(row.source_count) > 0) {
      throw new Error("A ready briefing cannot be silently replaced.");
    }
    if (row.briefing_status !== "pending" && row.briefing_status !== "partial") {
      throw new Error("Briefing is not pending publication.");
    }
    const result = await client.query<{
      message_id: string; mailbox_id: string; content_revision: string; text_body: string | null;
    }>(
      `SELECT s.email_message_id AS message_id,s.mailbox_id,s.content_revision,m.text_body
       FROM summary_sources s JOIN email_messages m ON m.id=s.email_message_id
          AND m.organization_id=s.organization_id AND m.email_account_id=s.mailbox_id
       WHERE s.summary_id=$1 AND s.organization_id=$2 AND s.owner_user_id=$3 AND s.agent_id=$4`,
      [manifestId, principal.organizationId, principal.userId, principal.agentId],
    );
    const sources = new Map(result.rows.map(r => [r.message_id, r]));
    const registrations: Array<{ itemId: string; source: typeof result.rows[number]; representation: "complete" | "partial" }> = [];
    for (const item of generated) {
      if (!item || typeof item.id !== "string" || !/^[a-f0-9]{64}$/.test(item.id)
        || !Array.isArray(item.sourceIds) || !item.sourceIds.length || item.sourceIds.length > 10
        || !["complete","partial"].includes(item.representation)
        || !Array.isArray(item.evidence)) throw new Error("Malformed briefing item.");
      if (item.evidence.some(e => !item.sourceIds.includes(e.sourceId)
        || !sources.has(e.sourceId) || e.contentRevision !== sources.get(e.sourceId)?.content_revision
        || !Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < 0 || e.end <= e.start
        || typeof e.quote !== "string"
        || (sources.get(e.sourceId)?.text_body ?? "").slice(e.start, e.end) !== e.quote)) {
        throw new Error("Briefing evidence no longer matches canonical mail.");
      }
      for (const id of item.sourceIds) {
        const src = sources.get(id);
        if (!src) throw notAvailable();
        registrations.push({ itemId: item.id, source: src, representation: item.representation });
      }
    }
    const covered = new Set(registrations.map(r => r.source.message_id));
    const metadata = row.coverage_metadata as { selectionTruncated?: boolean } | null;
    const ready = !metadata?.selectionTruncated && sources.size === covered.size
      && registrations.length > 0 && registrations.every(r => r.representation === "complete");
    for (const record of registrations) {
      await client.query(
        `INSERT INTO mail_review_items(organization_id,owner_user_id,agent_id,mailbox_id,message_id,
            content_revision,item_id,representation)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8)
          ON CONFLICT(organization_id,owner_user_id,agent_id,message_id,content_revision,item_id)
          DO NOTHING`,
        [principal.organizationId, principal.userId, principal.agentId,
          record.source.mailbox_id, record.source.message_id, record.source.content_revision,
          record.itemId, record.representation],
      );
    }
    const status = ready ? "ready" : "partial";
    await client.query(
      `UPDATE summaries SET content_json=$1::jsonb,briefing_status=$2
        WHERE id=$3 AND organization_id=$4 AND owner_user_id=$5 AND agent_id=$6`,
      [JSON.stringify(generated), status, manifestId, principal.organizationId, principal.userId, principal.agentId],
    );
    await client.query(
      `UPDATE briefing_generation_jobs SET status=$1,updated_at=now()
        WHERE summary_id=$2 AND organization_id=$3 AND owner_user_id=$4 AND agent_id=$5`,
      [status, manifestId, principal.organizationId, principal.userId, principal.agentId],
    );
    return { status, itemCount: generated.length };
  });
}
