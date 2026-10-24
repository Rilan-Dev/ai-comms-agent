import {emailReplyMetadata} from "@ai-comms-agent/shared";
import { createHash } from "node:crypto";
import { query, withTransaction } from "../client";

type Row = Record<string, unknown>;

export type EmailActionType = "send_email" | "reply_email" | "forward_email";
export type EmailActionStatus =
  | "pending_approval"
  | "approved"
  | "executing"
  | "rejected"
  | "completed"
  | "failed"
  | "expired"
  | "cancelled";

/** A stable idempotency key belongs to one actor, agent, payload and still-pending review. */
export class EmailActionIdempotencyConflictError extends Error {
  readonly code = "email_action_conflict";
  constructor() {
    super("An approval already exists for this saved draft, the original review is no longer pending, or the request conflicts with an existing idempotency key. No new approval request was created. Review the existing action or create a new draft.");
    this.name = "EmailActionIdempotencyConflictError";
  }
}

export interface CreateEmailActionInput {
  organizationId: string;
  agentId?: string | null;
  emailAccountId: string;
  actionType: EmailActionType;
  draftId?: string | null;
  recipientSnapshot: Record<string, unknown>;
  requestedBy?: string | null;
  expiresAt?: string | null;
  idempotencyKey?: string | null;
  correlationId?: string | null;
}

function action(row: Row) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    agentId: row.agent_id ? String(row.agent_id) : null,
    emailAccountId: String(row.email_account_id),
    senderAddress: typeof row.sender_address === 'string' ? row.sender_address : null,
    senderStatus: typeof row.sender_status === 'string' ? row.sender_status : null,
    actionType: String(row.action_type) as EmailActionType,
    status: String(row.status) as EmailActionStatus,
    draftId: row.draft_id ? String(row.draft_id) : null,
    recipientSnapshot: (row.recipient_snapshot ?? {}) as Record<string, unknown>,
    contentHash: row.content_hash ? String(row.content_hash) : null,
    requestedBy: row.requested_by ? String(row.requested_by) : null,
    approvedBy: row.approved_by ? String(row.approved_by) : null,
    requestedAt: String(row.requested_at),
    approvedAt: row.approved_at ? String(row.approved_at) : null,
    expiresAt: row.expires_at ? String(row.expires_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
    result: (row.result ?? {}) as Record<string, unknown>,
    error: row.error ? String(row.error) : null,
    correlationId: row.correlation_id ? String(row.correlation_id) : null,
  };
}

/** Recheck the reviewed content AFTER locking the saved draft. A concurrent
 * PATCH may have committed between an API/tool read and this transaction.
 * Reusing the old snapshot could approve one message but dispatch another. */
function matchesPersistedSendDraftSnapshot(persisted: Row, recipientSnapshot: Record<string, unknown>): boolean {
  const recipients = (value: unknown, required: boolean): string[] | null => {
    if (value == null && !required) return [];
    if (!Array.isArray(value) || (required && value.length === 0)) return null;
    const entries: string[] = [];
    for (const item of value) {
      if (typeof item !== "string") return null;
      const address = item.trim().toLowerCase();
      if (!address) return null;
      entries.push(address);
    }
    return entries;
  };
  for (const [persistedKey, snapshotKey, required] of [
    ["to_recipients", "to", true],
    ["cc_recipients", "cc", false],
    ["bcc_recipients", "bcc", false],
  ] as const) {
    const current = recipients(persisted[persistedKey], required);
    const reviewed = recipients(recipientSnapshot[snapshotKey], required);
    if (!current || !reviewed || current.length !== reviewed.length
      || current.some((address, index) => address !== reviewed[index])) return false;
  }
  const reply=emailReplyMetadata(persisted);
  for(const key of ['inReplyTo','referencesHeader','providerThreadId'] as const){
    if((reply[key]??'')!==(recipientSnapshot[key]??''))return false;
  }
  return typeof recipientSnapshot.subject === "string"
    && typeof recipientSnapshot.bodyText === "string"
    && String(persisted.subject ?? "") === recipientSnapshot.subject
    && String(persisted.text_body ?? "") === recipientSnapshot.bodyText;
}

export async function createEmailAction(input: CreateEmailActionInput) {
  const snapshot = JSON.stringify(input.recipientSnapshot);
  const contentHash = createHash("sha256").update(snapshot).digest("hex");
  const insertSql = `INSERT INTO email_actions
      (organization_id, agent_id, email_account_id, action_type, status, draft_id, recipient_snapshot, content_hash, requested_by, expires_at, idempotency_key, correlation_id)
     VALUES ($1,$2,$3,$4,'pending_approval',$5,$6::jsonb,$7,$8,COALESCE($9::timestamptz, now() + interval '15 minutes'),$10,$11)
     ON CONFLICT (organization_id, idempotency_key) WHERE idempotency_key IS NOT NULL
     DO UPDATE SET idempotency_key = EXCLUDED.idempotency_key
       WHERE email_actions.email_account_id = EXCLUDED.email_account_id
         AND email_actions.action_type = EXCLUDED.action_type
         AND email_actions.content_hash = EXCLUDED.content_hash
         AND email_actions.draft_id IS NOT DISTINCT FROM EXCLUDED.draft_id
         AND email_actions.requested_by IS NOT DISTINCT FROM EXCLUDED.requested_by
         AND email_actions.agent_id IS NOT DISTINCT FROM EXCLUDED.agent_id
         AND email_actions.status = 'pending_approval'
         AND (email_actions.expires_at IS NULL OR email_actions.expires_at > now())
     RETURNING *`;
  const params = [
    input.organizationId,
    input.agentId ?? null,
    input.emailAccountId,
    input.actionType,
    input.draftId ?? null,
    snapshot,
    contentHash,
    input.requestedBy ?? null,
    input.expiresAt ?? null,
    input.idempotencyKey ?? null,
    input.correlationId ?? null,
  ];

  // Lock the durable draft, not just the idempotency key. Manual Compose did
  // not supply an Idempotency-Key; Chat/voice can supply different keys for
  // the SAME draft. Locking serializes all of these callers and prevents two
  // separate human approvals (and ultimately two sends) for one draft.
  // Historical source-snapshot-only actions without a draftId keep their
  // previously authorized contract; reply/forward are unchanged.
  if (input.actionType === "send_email" && input.draftId) {
    return withTransaction(async client => {
      const locked = await client.query<Row>(
        "SELECT * FROM email_messages WHERE id=$1 AND organization_id=$2 AND email_account_id=$3 AND is_draft=true FOR UPDATE",
        [input.draftId, input.organizationId, input.emailAccountId],
      );
      const lockedDraft = locked.rows[0];
      if (!lockedDraft) throw new EmailActionIdempotencyConflictError();
      if(lockedDraft.in_reply_to){
        const thread=await client.query<Row>('SELECT provider_thread_id FROM email_threads WHERE id=$1 AND organization_id=$2 AND email_account_id=$3 FOR SHARE',[lockedDraft.thread_id,input.organizationId,input.emailAccountId]);
        if(!thread.rows[0])throw new EmailActionIdempotencyConflictError();
        lockedDraft.reply_provider_thread_id=thread.rows[0].provider_thread_id;
      }
      if (!matchesPersistedSendDraftSnapshot(lockedDraft, input.recipientSnapshot)) {
        throw new EmailActionIdempotencyConflictError();
      }
      const prior = await client.query<Row>(
        "SELECT *, (expires_at IS NULL OR expires_at > now()) AS unexpired FROM email_actions WHERE organization_id=$1 AND email_account_id=$2 AND draft_id=$3 AND action_type='send_email' ORDER BY requested_at ASC, id ASC LIMIT 1",
        [input.organizationId, input.emailAccountId, input.draftId],
      );
      const existing = prior.rows[0];
      if (existing) {
        // Return the SAME pending review only to its original requesting
        // actor/agent and with identical reviewed content. An approved,
        // rejected, expired or completed action always requires a new draft.
        const stillPending = existing.status === "pending_approval" && existing.unexpired === true;
        if (stillPending && existing.content_hash === contentHash
          && existing.requested_by === (input.requestedBy ?? null)
          && existing.agent_id === (input.agentId ?? null)) {
          return action(existing);
        }
        throw new EmailActionIdempotencyConflictError();
      }
      const inserted = await client.query<Row>(insertSql,params);
      const insertedRow = inserted.rows[0];
      if (!insertedRow) throw new EmailActionIdempotencyConflictError();
      return action(insertedRow);
    });
  }

  const r = await query<Row>(insertSql,params);
  const resultRow = r.rows[0];
  if (!resultRow) throw new EmailActionIdempotencyConflictError();
  return action(resultRow);
}

export async function listPendingEmailActionsForOrganization(organizationId: string) {
  const r = await query<Row>(
    `SELECT ea.*, a.email_address AS sender_address, a.status AS sender_status FROM email_actions ea
       LEFT JOIN email_accounts a ON a.id=ea.email_account_id AND a.organization_id=ea.organization_id AND a.deleted_at IS NULL
       WHERE ea.organization_id = $1
         AND ea.status = 'pending_approval'
         AND (ea.expires_at IS NULL OR ea.expires_at > now())
       ORDER BY ea.requested_at ASC`,
    [organizationId],
  );
  return r.rows.map(action);
}

export async function getEmailActionForOrganization(organizationId: string, actionId: string) {
  const r = await query<Row>(
    `SELECT * FROM email_actions
     WHERE id = $1 AND organization_id = $2
     LIMIT 1`,
    [actionId, organizationId],
  );
  return r.rows[0] ? action(r.rows[0]) : null;
}

export async function decideEmailAction(
  organizationId: string,
  actionId: string,
  decidedBy: string,
  decision: "approved" | "rejected",
  comment?: string | null,
) {
  const r = await query<Row>(
    `WITH transitioned AS (
       UPDATE email_actions
       SET status = $1,
           approved_by = CASE WHEN $7::boolean THEN $3 ELSE approved_by END,
           approved_at = CASE WHEN $7::boolean THEN now() ELSE approved_at END,
           error = CASE WHEN NOT $7::boolean THEN COALESCE($4, 'Rejected by user') ELSE NULL END
       WHERE id = $2
         AND organization_id = $5
         AND status = 'pending_approval'
         AND (expires_at IS NULL OR expires_at > now())
       RETURNING *
     )
     INSERT INTO email_action_approvals
       (email_action_id, organization_id, decision, decided_by, comment)
     SELECT id, organization_id, $6, $3, $4 FROM transitioned
     RETURNING email_action_id`,
    [decision, actionId, decidedBy, comment ?? null, organizationId, decision, decision === "approved"],
  );
  if (!r.rows[0]) return null;
  return getEmailActionForOrganization(organizationId, actionId);
}

export async function listApprovedEmailActions(limit = 10) {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const r = await query<Row>(
    `SELECT * FROM email_actions
     WHERE status = 'approved' AND (expires_at IS NULL OR expires_at > now())
     ORDER BY approved_at ASC NULLS LAST, requested_at ASC
     LIMIT $1`,
    [safeLimit],
  );
  return r.rows.map(action);
}

export async function claimApprovedEmailAction(actionId: string, organizationId: string) {
  const r = await query<Row>(
    `UPDATE email_actions
     SET status = 'executing',
         result = COALESCE(result,'{}'::jsonb) || jsonb_build_object('execution_started_at', now())
     WHERE id = $1
       AND organization_id = $2
       AND status = 'approved'
       AND (expires_at IS NULL OR expires_at > now())
     RETURNING *`,
    [actionId, organizationId],
  );
  return r.rows[0] ? action(r.rows[0]) : null;
}

export async function completeEmailAction(
  actionId: string,
  organizationId: string,
  status: "completed" | "failed",
  result?: Record<string, unknown>,
  error?: string | null,
) {
  const r = await query<Row>(
    `UPDATE email_actions
     SET status = $2, result = $3::jsonb, error = $4, completed_at = now()
     WHERE id = $1 AND organization_id = $5 AND status = 'executing'
     RETURNING *`,
    [actionId, status, JSON.stringify(result ?? {}), error ?? null, organizationId],
  );
  return r.rows[0] ? action(r.rows[0]) : null;
}


/**
 * Fail closed on actions whose worker lease was abandoned.
 * We deliberately do not return them to "approved": the provider may have
 * accepted the request before the worker crashed, so automatic replay could
 * create a duplicate externally-visible message.
 */
export async function recoverStaleExecutingEmailActions(maxAgeMinutes = 15) {
  const safeAge = Math.min(Math.max(Math.floor(maxAgeMinutes), 1), 24 * 60);
  const r = await query<Row>(
    `UPDATE email_actions
     SET status = 'failed',
         error = 'Worker execution interrupted; provider outcome is unknown. Manual verification required.',
         completed_at = now(),
         result = COALESCE(result,'{}'::jsonb) || jsonb_build_object(
           'recoveredStaleExecution', true,
           'providerOutcomeUnknown', true
         )
     WHERE status = 'executing'
       AND COALESCE(NULLIF(result->>'execution_started_at','')::timestamptz, approved_at, requested_at)
           < now() - make_interval(mins => $1)
     RETURNING *`,
    [safeAge],
  );
  return r.rows.map(action);
}
