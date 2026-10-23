import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient, QueryResult } from 'pg';
import { briefingPeriod, planBriefingBatches, routineSourceEligible,
  type BriefingItem, type BriefingManifest, type BriefingRequest, type BriefingSource,
  type EffectiveBriefingScope, type RoutineCoverageSnapshot, type TrustedBriefingPrincipal } from '@ai-comms-agent/shared';
import { withTransaction } from '../client';
import { stableBriefingItemId } from './identity';
import { requireBriefingActor, requireBriefingIds, resolveBriefingScopeInTransaction } from './access';

type ScheduledRequest = Extract<BriefingRequest, { mode: 'scheduled' }>;
/** Host-only R3 integration. Implementations must authorize routine identity/revision
 * and use this transaction for their separate generation ledger; never delivery. */
export interface RoutineCoverageAdapter {
  load(client: PoolClient, principal: TrustedBriefingPrincipal, request: ScheduledRequest, scope: EffectiveBriefingScope): Promise<RoutineCoverageSnapshot>;
  complete(client: PoolClient, principal: TrustedBriefingPrincipal, request: ScheduledRequest, scope: EffectiveBriefingScope, manifestId: string, sources: BriefingSource[]): Promise<void>;
}
export type BriefingBatchClaim = { batchId: string; manifestId: string; leaseToken: string; workerId: string; sources: BriefingSource[]; partial: boolean };
const params = (p: TrustedBriefingPrincipal) => [p.organizationId, p.userId, p.agentId];
const conflict = (detail = 'scope or sources changed') => new Error(`Briefing conflict: ${detail}`);
const iso = (value: Date | string) => new Date(value).toISOString();

async function retrySnapshot<T>(fn: () => Promise<T>): Promise<T> {
  for (let n = 0; ; n++) {
    try { return await fn(); } catch (error) {
      if (n >= 2 || !['40001', '23505'].includes((error as { code?: string }).code ?? '')) throw error;
    }
  }
}
function manifest(row: Record<string, any>, scope: EffectiveBriefingScope, sourceCount: number): BriefingManifest {
  return { id: row.id, scope, mode: row.briefing_mode, status: row.briefing_status, sourceCount,
    period: { start: iso(row.period_start), end: iso(row.period_end) } };
}
async function currentManifest(client: PoolClient, p: TrustedBriefingPrincipal, id: string, lock = false) {
  requireBriefingIds(...params(p), id);
  await requireBriefingActor(client, p);
  const found = await client.query(`SELECT * FROM summaries WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND id=$4 ${lock ? 'FOR UPDATE' : 'FOR SHARE'}`, [...params(p), id]);
  const row = found.rows[0]; if (!row) throw conflict('unavailable manifest');
  const scope = await resolveBriefingScopeInTransaction(client, p, row.mailbox_ids);
  if (scope.scopeVersion !== row.scope_version) throw conflict();
  const sourceCount = (await client.query('SELECT count(*)::int n FROM summary_sources WHERE summary_id=$1', [id])).rows[0].n;
  if (!Array.isArray(row.selected_source_manifest) || row.selected_source_manifest.length !== sourceCount) throw conflict('missing provenance');
  const invalid = await client.query(`SELECT 1 FROM summary_sources s LEFT JOIN email_messages m ON m.id=s.email_message_id AND m.organization_id=s.organization_id AND m.email_account_id=s.mailbox_id
    WHERE s.summary_id=$1 AND (m.id IS NULL OR s.content_revision IS DISTINCT FROM briefing_content_revision(m.id)) LIMIT 1`, [id]);
  if (invalid.rowCount) throw conflict();
  return { row, scope };
}

/** Authenticated host only; request keys are scoped to the current grant version. */
export async function prepareBriefing(p: TrustedBriefingPrincipal, request: BriefingRequest, routine?: RoutineCoverageAdapter): Promise<BriefingManifest> {
  if (!request || !['catch_up', 'scheduled'].includes(request.mode) || typeof request.requestKey !== 'string' || !request.requestKey.trim() || request.requestKey.length > 200 || typeof request.language !== 'string' || !request.language.trim() || request.language.length > 50) throw new Error('Invalid briefing request');
  if (request.mode === 'scheduled' && !routine) throw new Error('Trusted routine coverage adapter required');
  return retrySnapshot(() => withTransaction(async client => {
    await client.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
    const scope = await resolveBriefingScopeInTransaction(client, p, request.mailboxIds);
    const fingerprint = createHash('sha256').update(JSON.stringify([request.mode, scope.mailboxIds, request.period, request.language, request.mode === 'scheduled' ? request.routine : null])).digest('hex');
    const existing = await client.query(`SELECT j.request_fingerprint,s.* FROM briefing_generation_jobs j JOIN summaries s ON s.id=j.summary_id
      WHERE j.organization_id=$1 AND j.owner_user_id=$2 AND j.agent_id=$3 AND j.scope_version=$4 AND j.request_key=$5`, [...params(p), scope.scopeVersion, request.requestKey]);
    if (existing.rows[0]) {
      if (existing.rows[0].request_fingerprint !== fingerprint) throw conflict('request key reused with different input');
      const current = await currentManifest(client, p, existing.rows[0].id);
      await authorizeRoutineWork(client, p, current.row, current.scope, routine);
      const count = await client.query('SELECT count(*)::int n FROM summary_sources WHERE summary_id=$1', [current.row.id]);
      return manifest(current.row, scope, count.rows[0].n);
    }
    // Preserve PostgreSQL microseconds: truncating now() to JS milliseconds
    // can omit a reply committed earlier in this same millisecond.
    const now: string = (await client.query(`SELECT to_char(now() AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') value`)).rows[0].value;
    const history = await client.query(`SELECT history_start FROM briefing_selection_scopes WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND scope_version=$4`, [...params(p), scope.scopeVersion]);
    const period = briefingPeriod(request.period, now, history.rows[0] ? iso(history.rows[0].history_start) : null);
    let coverage: RoutineCoverageSnapshot | undefined;
    if (request.mode === 'scheduled') {
      coverage = await routine!.load(client, p, request, scope);
      if (!Number.isFinite(Date.parse(coverage.historyStart)) || Date.parse(coverage.historyStart) > Date.parse(period.start)) throw conflict('invalid routine history boundary');
    } else {
      await client.query(`INSERT INTO briefing_selection_scopes(organization_id,owner_user_id,agent_id,scope_version,history_start) VALUES($1,$2,$3,$4,$5)
        ON CONFLICT(organization_id,owner_user_id,agent_id,scope_version) DO UPDATE SET history_start=least(briefing_selection_scopes.history_start,EXCLUDED.history_start)`, [...params(p), scope.scopeVersion, period.start]);
    }
    const summary = (await client.query(`INSERT INTO summaries(organization_id,owner_user_id,agent_id,summary_type,content,content_json,period_start,period_end,mailbox_ids,briefing_status,briefing_mode,scope_version,coverage_metadata)
      VALUES($1,$2,$3,'personal_briefing','','[]',$4,$5,$6,'pending',$7,$8,$9) RETURNING *`, [...params(p), period.start, period.end, scope.mailboxIds, request.mode, scope.scopeVersion, JSON.stringify({ language: request.language, request })])).rows[0];
    const job = (await client.query(`INSERT INTO briefing_generation_jobs(organization_id,owner_user_id,agent_id,summary_id,request_key,scope_version,request_fingerprint) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [...params(p), summary.id, request.requestKey, scope.scopeVersion, fingerprint])).rows[0];
    const selected: { id: string; estimatedTokens: number }[] = [];
    const manifestSources: BriefingSource[] = [];
    let cursor: string | null = null;
    const start = request.mode === 'scheduled' && request.routine.window === 'since_previous_occurrence' ? coverage!.historyStart : period.start;
    // One repeatable-read snapshot for every200-row page. UUID keysets do not
    // truncate PostgreSQL microseconds or lose same-timestamp/late committed mail.
    for (;;) {
      const page: QueryResult = await client.query(`SELECT m.id,m.email_account_id,m.thread_id,coalesce(m.received_at,m.created_at) received_at,
        briefing_content_revision(m.id) revision,
        greatest(1,ceil((octet_length(coalesce(m.text_body,m.html_body_sanitized,m.snippet,''))+octet_length(coalesce(m.subject,'')))/4.0))::int tokens
        FROM email_messages m WHERE m.organization_id=$1 AND m.email_account_id=ANY($4::uuid[])
        AND NOT m.is_draft AND NOT m.is_sent
        AND ((coalesce(m.received_at,m.created_at)>=$5 AND coalesce(m.received_at,m.created_at)<$6)
          OR (NOT $8 AND m.created_at >= $5 AND m.created_at < $6)) AND ($7::uuid IS NULL OR m.id>$7)
        AND ($8 OR NOT EXISTS(SELECT 1 FROM briefing_review_sources r WHERE r.organization_id=$1 AND r.owner_user_id=$2 AND r.agent_id=$3 AND r.scope_version=$9 AND r.message_id=m.id AND r.content_revision=briefing_content_revision(m.id) AND r.reviewed_at IS NOT NULL))
        ORDER BY m.id LIMIT 200`, [...params(p), scope.mailboxIds, start, period.end, cursor, request.mode === 'scheduled', scope.scopeVersion]);
      for (const source of page.rows) {
        if (request.mode === 'scheduled' && !routineSourceEligible({ messageId: source.id, contentRevision: source.revision, receivedAt: iso(source.received_at) }, period, request.routine.window, coverage!)) continue;
        const saved = (await client.query(`INSERT INTO summary_sources(summary_id,organization_id,owner_user_id,agent_id,email_message_id,mailbox_id,content_revision,source_ordinal,source_thread_id,source_received_at,estimated_input_tokens)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`, [summary.id, ...params(p), source.id, source.email_account_id, source.revision, selected.length, source.thread_id, source.received_at, source.tokens])).rows[0];
        selected.push({ id: saved.id, estimatedTokens: source.tokens });
        manifestSources.push({ messageId: source.id, mailboxId: source.email_account_id, threadId: source.thread_id, contentRevision: source.revision });
      }
      if (page.rows.length < 200) break;
      cursor = page.rows.at(-1).id;
    }
    await client.query('UPDATE summaries SET selected_source_manifest=$2 WHERE id=$1', [summary.id, JSON.stringify(manifestSources)]);
    for (const [ordinal, batch] of planBriefingBatches(selected).entries()) {
      await client.query(`INSERT INTO briefing_generation_batches(organization_id,owner_user_id,agent_id,job_id,ordinal,source_count,estimated_input_tokens,source_ids,partial_representation)
        VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`, [...params(p), job.id, ordinal, batch.sourceIds.length, batch.estimatedTokens, batch.sourceIds, batch.partial]);
    }
    if (!selected.length) {
      summary.briefing_status = 'ready';
      await client.query("UPDATE summaries SET briefing_status='ready' WHERE id=$1", [summary.id]);
      await client.query("UPDATE briefing_generation_jobs SET status='ready' WHERE id=$1", [job.id]);
      if (request.mode === 'scheduled') await routine!.complete(client, p, request, scope, summary.id, []);
    }
    return manifest(summary, scope, selected.length);
  }));
}

export async function listBriefingSources(p: TrustedBriefingPrincipal, id: string, cursor: string | null = null, limit = 200): Promise<{
  items: Array<BriefingSource & { subject: string | null; sender: string | null; receivedAt: string | null }>;
  nextCursor: string | null;
}> {
  if (!Number.isInteger(limit) || limit < 1 || limit > 200 || (cursor !== null && !/^[0-9a-f-]{36}$/i.test(cursor))) throw new Error('Invalid source pagination');
  return withTransaction(async client => {
    // This revalidates owner + agent, all mailbox grants, scope fingerprint and
    // source revisions before any email header metadata is selected.
    await currentManifest(client, p, id);
    const rows = (await client.query(`
      SELECT s.email_message_id,s.mailbox_id,s.source_thread_id,s.content_revision,s.source_ordinal,
        m.subject,m.from_email,m.received_at
      FROM summary_sources s
      LEFT JOIN email_messages m ON m.id=s.email_message_id
        AND m.organization_id=s.organization_id AND m.email_account_id=s.mailbox_id
      WHERE s.summary_id=$1 AND ($2::uuid IS NULL OR s.email_message_id>$2::uuid)
        AND s.organization_id=$4 AND s.owner_user_id=$5 AND s.agent_id=$6
      ORDER BY s.email_message_id LIMIT $3
    `, [id, cursor, limit + 1, p.organizationId, p.userId, p.agentId])).rows;
    const selected = rows.slice(0, limit);
    // Only safe identifiers and header metadata, never raw bodies or attachments.
    return { items: selected.map(s => ({
      messageId: s.email_message_id, mailboxId: s.mailbox_id,
      threadId: s.source_thread_id, contentRevision: s.content_revision,
      subject: s.subject, sender: s.from_email,
      receivedAt: s.received_at ? new Date(s.received_at).toISOString() : null,
    })), nextCursor: rows.length > limit ? selected.at(-1).email_message_id : null };
  });
}

async function authorizeRoutineWork(client: PoolClient, p: TrustedBriefingPrincipal, row: Record<string, any>, scope: EffectiveBriefingScope, routine?: RoutineCoverageAdapter): Promise<void> {
  if (row.briefing_mode !== 'scheduled') return;
  if (!routine) throw new Error('Trusted routine coverage adapter required');
  await routine.load(client, p, row.coverage_metadata.request, scope);
}

export async function claimBriefingBatch(p: TrustedBriefingPrincipal, manifestId: string, workerId: string, routine?: RoutineCoverageAdapter): Promise<BriefingBatchClaim | null> {
  if (!workerId || workerId.length > 200) throw new Error('Invalid worker identity');
  return withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`briefing-batches:${p.organizationId}`]);
    const { row, scope } = await currentManifest(client, p, manifestId, true);
    await authorizeRoutineWork(client, p, row, scope, routine);
    const active = await client.query("SELECT count(*)::int n FROM briefing_generation_batches WHERE organization_id=$1 AND status='running' AND lease_expires_at>now()", [p.organizationId]);
    if (active.rows[0].n >= 2) return null;
    const result = await client.query(`SELECT b.* FROM briefing_generation_batches b JOIN briefing_generation_jobs j ON j.id=b.job_id
      WHERE j.summary_id=$1 AND (b.status='pending' OR (b.status='running' AND b.lease_expires_at<=now())) ORDER BY b.ordinal LIMIT 1 FOR UPDATE OF b SKIP LOCKED`, [manifestId]);
    const batch = result.rows[0]; if (!batch) return null;
    const token = randomUUID();
    await client.query("UPDATE briefing_generation_batches SET status='running',attempt=attempt+1,lease_owner=$2,lease_token=$3,lease_expires_at=now()+interval '120 seconds',updated_at=now() WHERE id=$1", [batch.id, workerId, token]);
    await client.query("UPDATE briefing_generation_jobs SET status='running',updated_at=now() WHERE id=$1", [batch.job_id]);
    const sources = (await client.query('SELECT * FROM summary_sources WHERE summary_id=$1 AND id=ANY($2::uuid[]) ORDER BY source_ordinal', [manifestId,batch.source_ids])).rows;
    return { batchId: batch.id, manifestId, leaseToken: token, workerId,
      sources: sources.map(s => ({ messageId: s.email_message_id, mailboxId: s.mailbox_id, threadId: s.source_thread_id, contentRevision: s.content_revision })), partial: batch.partial_representation };
  });
}
export async function heartbeatBriefingBatch(p: TrustedBriefingPrincipal, claim: BriefingBatchClaim, routine?: RoutineCoverageAdapter): Promise<boolean> {
  return withTransaction(async client => {
    const { row, scope } = await currentManifest(client, p, claim.manifestId);
    await authorizeRoutineWork(client, p, row, scope, routine);
    const result = await client.query(`UPDATE briefing_generation_batches b SET lease_expires_at=now()+interval '120 seconds',updated_at=now()
      FROM briefing_generation_jobs j WHERE b.job_id=j.id AND j.summary_id=$1 AND b.id=$2 AND b.lease_token=$3 AND b.lease_owner=$4 AND b.status='running' AND b.lease_expires_at>now() RETURNING b.id`, [claim.manifestId, claim.batchId, claim.leaseToken, claim.workerId]);
    return !!result.rowCount;
  });
}

async function lockReview(client: PoolClient, p: TrustedBriefingPrincipal): Promise<void> {
  await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', [`briefing-review:${params(p).join(':')}`]);
}
async function refreshReviewedSources(client: PoolClient, p: TrustedBriefingPrincipal, scopeVersion: string): Promise<void> {
  await client.query(`UPDATE briefing_review_sources s SET reviewed_at=CASE WHEN s.representation_complete AND
    EXISTS(SELECT 1 FROM mail_review_items i WHERE i.organization_id=s.organization_id AND i.owner_user_id=s.owner_user_id AND i.agent_id=s.agent_id AND i.scope_version=s.scope_version AND i.message_id=s.message_id AND i.content_revision=s.content_revision)
    AND NOT EXISTS(SELECT 1 FROM mail_review_items i WHERE i.organization_id=s.organization_id AND i.owner_user_id=s.owner_user_id AND i.agent_id=s.agent_id AND i.scope_version=s.scope_version AND i.message_id=s.message_id AND i.content_revision=s.content_revision AND (i.acknowledged_at IS NULL OR i.representation<>'complete'))
    THEN coalesce(s.reviewed_at,now()) ELSE NULL END
    WHERE s.organization_id=$1 AND s.owner_user_id=$2 AND s.agent_id=$3 AND s.scope_version=$4`, [...params(p), scopeVersion]);
}

/** Trusted generation boundary. C3 must additionally validate exact quote spans
 * and semantic grounding before calling this persistence operation. */
export async function completeBriefingBatch(p: TrustedBriefingPrincipal, claim: BriefingBatchClaim, input: BriefingItem[], partial: boolean, routine?: RoutineCoverageAdapter): Promise<void> {
  if (!Array.isArray(input) || input.length > 500 || typeof partial !== 'boolean') throw new Error('Invalid batch output');
  await withTransaction(async client => {
    await lockReview(client, p);
    const { row, scope } = await currentManifest(client, p, claim.manifestId, true);
    await authorizeRoutineWork(client, p, row, scope, routine);
    const batch = (await client.query(`SELECT b.* FROM briefing_generation_batches b JOIN briefing_generation_jobs j ON j.id=b.job_id
      WHERE j.summary_id=$1 AND b.id=$2 AND b.lease_token=$3 AND b.lease_owner=$4 AND b.status='running' AND b.lease_expires_at>now() FOR UPDATE OF b`, [claim.manifestId, claim.batchId, claim.leaseToken, claim.workerId])).rows[0];
    if (!batch) throw conflict('expired or superseded lease');
    const sources = (await client.query('SELECT * FROM summary_sources WHERE summary_id=$1 AND id=ANY($2::uuid[])', [row.id, batch.source_ids])).rows;
    const sourceMap = new Map(sources.map(s => [s.email_message_id, s]));
    const identities = sources.map(s => ({ messageId: s.email_message_id, contentRevision: s.content_revision }));
    const items: BriefingItem[] = [];
    for (const item of input) {
      const safeFallback = item?.representation === 'partial' && item.confidence === 'uncertain' && item.priority === 'low'
        && item.suggestedAction === 'review' && item.deadline === null && item.title === 'Review original email'
        && item.summary === 'An AI-generated summary is not available. Open this email for the complete information.'
        && item.reason === 'Grounded generation was unavailable or did not validate.';
      if (!item || !Array.isArray(item.sourceIds) || !item.sourceIds.length || item.sourceIds.some(id => !sourceMap.has(id)) ||
        !['high','medium','low'].includes(item.priority) || !['supported','uncertain'].includes(item.confidence) ||
        !['reply','review','follow_up','none'].includes(item.suggestedAction) || !['complete','partial'].includes(item.representation) ||
        [item.title,item.summary,item.reason].some(s => typeof s !== 'string' || s.length > 12000) ||
        (item.deadline !== null && typeof item.deadline !== 'string') ||
        !Array.isArray(item.evidence) || (!item.evidence.length && !safeFallback) || item.evidence.some(e => !e || !item.sourceIds.includes(e.sourceId) ||
          e.contentRevision !== sourceMap.get(e.sourceId)?.content_revision || !Number.isInteger(e.start) || !Number.isInteger(e.end) || e.start < 0 || e.end <= e.start ||
          typeof e.quote !== 'string' || e.quote.length > 12000 || !['deadline','amount','priority_reason','summary'].includes(e.supports))) throw new Error('Invalid represented item');
      const id = stableBriefingItemId(item, identities);
      if (items.some(i => i.id === id)) throw new Error('Duplicate represented item');
      items.push({ id, sourceIds: [...new Set(item.sourceIds)].sort(), priority: item.priority, title: item.title, summary: item.summary,
        reason: item.reason, deadline: item.deadline, confidence: item.confidence, suggestedAction: item.suggestedAction,
        evidence: item.evidence.map(e => ({ sourceId: e.sourceId, contentRevision: e.contentRevision, start: e.start, end: e.end, quote: e.quote, supports: e.supports })),
        representation: item.representation, snoozedUntil: null });
    }
    const incomplete = partial || batch.partial_representation || items.some(i => i.representation !== 'complete');
    if (!incomplete && sources.some(s => !items.some(i => i.sourceIds.includes(s.email_message_id)))) throw new Error('Complete output must represent every source');
    if (row.briefing_mode === 'catch_up') {
      for (const source of sources) {
        // A fully represented regeneration supersedes provisional fallback /
        // truncated items, but never discards a previously complete obligation.
        if (!incomplete) await client.query(`DELETE FROM mail_review_items WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND scope_version=$4
          AND message_id=$5 AND content_revision=$6 AND representation='partial' AND acknowledged_at IS NULL`,
        [...params(p), scope.scopeVersion, source.email_message_id, source.content_revision]);
        await client.query(`INSERT INTO briefing_review_sources(organization_id,owner_user_id,agent_id,scope_version,mailbox_id,message_id,content_revision,representation_complete)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(organization_id,owner_user_id,agent_id,scope_version,message_id,content_revision)
          DO UPDATE SET representation_complete=briefing_review_sources.representation_complete OR EXCLUDED.representation_complete`,
        [...params(p), scope.scopeVersion, source.mailbox_id, source.email_message_id, source.content_revision, !incomplete]);
        for (const item of items.filter(i => i.sourceIds.includes(source.email_message_id))) {
          await client.query(`INSERT INTO mail_review_items(organization_id,owner_user_id,agent_id,scope_version,mailbox_id,message_id,content_revision,item_id,representation)
            VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(organization_id,owner_user_id,agent_id,scope_version,message_id,content_revision,item_id)
            DO UPDATE SET representation=CASE WHEN EXCLUDED.representation='complete' THEN 'complete' ELSE mail_review_items.representation END`,
          [...params(p), scope.scopeVersion, source.mailbox_id, source.email_message_id, source.content_revision, item.id, item.representation]);
        }
      }
      await refreshReviewedSources(client, p, scope.scopeVersion);
    }
    const previous: BriefingItem[] = Array.isArray(row.content_json) ? row.content_json : [];
    await client.query('UPDATE summaries SET content_json=$2 WHERE id=$1', [row.id, JSON.stringify([...previous, ...items])]);
    await client.query("UPDATE briefing_generation_batches SET status='ready',partial_representation=$2,lease_expires_at=NULL,updated_at=now() WHERE id=$1", [batch.id, incomplete]);
    const remaining = (await client.query("SELECT count(*) FILTER(WHERE status<>'ready')::int pending,bool_or(partial_representation) partial FROM briefing_generation_batches WHERE job_id=$1", [batch.job_id])).rows[0];
    const status = remaining.pending > 0 ? 'pending' : remaining.partial ? 'partial' : 'ready';
    await client.query('UPDATE summaries SET briefing_status=$2 WHERE id=$1', [row.id, status]);
    await client.query('UPDATE briefing_generation_jobs SET status=$2,updated_at=now() WHERE id=$1', [batch.job_id, status]);
    if (row.briefing_mode === 'scheduled' && status === 'ready') {
      if (!routine) throw new Error('Trusted routine coverage adapter required');
      const request: ScheduledRequest = row.coverage_metadata.request;
      await routine.load(client, p, request, scope); // reauthorize current routine revision
      const all = (await client.query('SELECT * FROM summary_sources WHERE summary_id=$1 ORDER BY source_ordinal', [row.id])).rows;
      await routine.complete(client, p, request, scope, row.id, all.map(s => ({ messageId: s.email_message_id, mailboxId: s.mailbox_id, threadId: s.source_thread_id, contentRevision: s.content_revision })));
    }
  });
}

async function reviewableManifest(client: PoolClient, p: TrustedBriefingPrincipal, id: string, expectedScopeVersion: string) {
  const current = await currentManifest(client, p, id, true);
  if (current.scope.scopeVersion !== expectedScopeVersion) throw conflict();
  if (current.row.briefing_mode !== 'catch_up') throw conflict('scheduled coverage is separate from personal review');
  if (new Date(current.row.derived_expires_at).getTime() <= Date.now()) throw conflict('expired derived output');
  return current;
}
export async function acknowledgeBriefingItems(p: TrustedBriefingPrincipal, manifestId: string, itemIds: string[], expectedScopeVersion: string): Promise<{ reviewed: number }> {
  if (!Array.isArray(itemIds) || !itemIds.length || itemIds.length > 500 || itemIds.some(id => typeof id !== 'string')) throw new Error('Invalid review selection');
  return withTransaction(async client => {
    await lockReview(client, p);
    const { row, scope } = await reviewableManifest(client, p, manifestId, expectedScopeVersion);
    const items: BriefingItem[] = row.content_json;
    if (!Array.isArray(items) || itemIds.some(id => !items.some(i => i.id === id && i.representation === 'complete'))) throw new Error('Only complete represented items may be reviewed');
    const updated = await client.query(`UPDATE mail_review_items SET acknowledged_at=now(),snoozed_until=NULL
      WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND scope_version=$4 AND item_id=ANY($5::text[]) AND representation='complete' AND acknowledged_at IS NULL RETURNING item_id`, [...params(p), scope.scopeVersion, itemIds]);
    await refreshReviewedSources(client, p, scope.scopeVersion);
    return { reviewed: new Set(updated.rows.map(r => r.item_id)).size };
  });
}
export async function snoozeBriefingItem(p: TrustedBriefingPrincipal, manifestId: string, itemId: string, until: string, expectedScopeVersion: string): Promise<void> {
  if (typeof until !== 'string' || !/Z$/.test(until) || !Number.isFinite(Date.parse(until)) || Date.parse(until) <= Date.now()) throw new Error('Explicit future UTC instant required after local-zone confirmation');
  await withTransaction(async client => {
    await lockReview(client, p);
    const { row, scope } = await reviewableManifest(client, p, manifestId, expectedScopeVersion);
    if (!Array.isArray(row.content_json) || !row.content_json.some((i: BriefingItem) => i.id === itemId)) throw conflict('item not represented');
    const changed = await client.query(`UPDATE mail_review_items SET snoozed_until=$6 WHERE organization_id=$1 AND owner_user_id=$2 AND agent_id=$3 AND scope_version=$4 AND item_id=$5 AND acknowledged_at IS NULL RETURNING item_id`, [...params(p), scope.scopeVersion, itemId, until]);
    if (!changed.rowCount) throw conflict('item already reviewed or unavailable');
  });
}
