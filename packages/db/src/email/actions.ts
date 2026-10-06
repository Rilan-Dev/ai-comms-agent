import { createHash } from "node:crypto";
import { query } from "../client";

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

export interface CreateEmailActionInput {
  organizationId: string;
  agentId?: string | null;
  emailAccountId: string;
  actionType: EmailActionType;
  draftId?: string | null;
  recipientSnapshot: Record<string, unknown>;
  requestedBy?: string | null;
  expiresAt?: string | null;
}

function action(row: Row) {
  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    agentId: row.agent_id ? String(row.agent_id) : null,
    emailAccountId: String(row.email_account_id),
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
  };
}

export async function createEmailAction(input: CreateEmailActionInput) {
  const snapshot = JSON.stringify(input.recipientSnapshot);
  const contentHash = createHash("sha256").update(snapshot).digest("hex");
  const r = await query<Row>(
    `INSERT INTO email_actions
      (organization_id, agent_id, email_account_id, action_type, status, draft_id, recipient_snapshot, content_hash, requested_by, expires_at)
     VALUES ($1,$2,$3,$4,'pending_approval',$5,$6::jsonb,$7,$8,COALESCE($9::timestamptz, now() + interval '15 minutes'))
     RETURNING *`,
    [
      input.organizationId,
      input.agentId ?? null,
      input.emailAccountId,
      input.actionType,
      input.draftId ?? null,
      snapshot,
      contentHash,
      input.requestedBy ?? null,
      input.expiresAt ?? null,
    ],
  );
  const row = r.rows[0];
  if (!row) throw new Error("Email action insert returned no row");
  return action(row);
}

export async function listPendingEmailActionsForOrganization(organizationId: string) {
  const r = await query<Row>(
    `SELECT * FROM email_actions
       WHERE organization_id = $1
         AND status = 'pending_approval'
         AND (expires_at IS NULL OR expires_at > now())
       ORDER BY requested_at ASC`,
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
           approved_by = CASE WHEN $1 = 'approved' THEN $3 ELSE approved_by END,
           approved_at = CASE WHEN $1 = 'approved' THEN now() ELSE approved_at END,
           error = CASE WHEN $1 = 'rejected' THEN COALESCE($4, 'Rejected by user') ELSE NULL END
       WHERE id = $2
         AND organization_id = $5
         AND status = 'pending_approval'
         AND (expires_at IS NULL OR expires_at > now())
       RETURNING *
     )
     INSERT INTO email_action_approvals
       (email_action_id, organization_id, decision, decided_by, comment)
     SELECT id, organization_id, $1, $3, $4 FROM transitioned
     RETURNING email_action_id`,
    [decision, actionId, decidedBy, comment ?? null, organizationId],
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

export async function claimApprovedEmailAction(actionId: string) {
  const r = await query<Row>(
    `UPDATE email_actions
     SET status = 'executing'
     WHERE id = $1
       AND status = 'approved'
       AND (expires_at IS NULL OR expires_at > now())
     RETURNING *`,
    [actionId],
  );
  return r.rows[0] ? action(r.rows[0]) : null;
}

export async function completeEmailAction(
  actionId: string,
  status: "completed" | "failed",
  result?: Record<string, unknown>,
  error?: string | null,
) {
  const r = await query<Row>(
    `UPDATE email_actions
     SET status = $2, result = $3::jsonb, error = $4, completed_at = now()
     WHERE id = $1 AND status = 'executing'
     RETURNING *`,
    [actionId, status, JSON.stringify(result ?? {}), error ?? null],
  );
  return r.rows[0] ? action(r.rows[0]) : null;
}
