import {NextResponse} from "next/server";
import {query} from "@ai-comms-agent/db";
import {asOrganizationId} from "@ai-comms-agent/shared";
import {authorize, authorizationErrorToResponse} from "@/lib/identity/authorization";
import {getIdentityAdapter, getIdentityRepository} from "@/lib/identity/repository";
import {planOverviewRead} from "@/lib/overview/permission-plan";
import {aiTodayTimestamp, buildAiTodayWindow, parseAiTodayDays, projectAiTodaySource, type AiTodaySourceRow, type AiTodaySchedule, type AiTodaySnapshot} from "@/lib/ai-today/snapshot";

export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const headers = {"Cache-Control": "private, no-store"};
const respond = (data: object, status = 200) => NextResponse.json(data, {status, headers});

/**
 * Phase 1 source-backed snapshot. This is not C3 generated briefing content:
 * no model inference, foreground-tracking mutation, grants, sends or read flags.
 * The existing email.read permission governs organization-level inbox access.
 */
export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return respond({error: "database_not_configured"}, 503);
    const params = new URL(request.url).searchParams;
    const organizationId = params.get("organizationId") ?? "";
    if (!uuid.test(organizationId)) return respond({error: "validation_error", message: "Select an organization."}, 422);
    let days: ReturnType<typeof parseAiTodayDays>;
    try { days = parseAiTodayDays(params.get("days")); }
    catch { return respond({error: "validation_error", message: "Select a supported lookback window."}, 422); }
    // Host identity and active organization membership are authoritative.
    // email.read is not implied by organization.read or the current URL.
    const subject = await authorize(request, {organizationId: asOrganizationId(organizationId), permission: "email.read"}, getIdentityAdapter(), getIdentityRepository());
    const access = planOverviewRead(subject.permissions);
    const requestedAgentId = params.get("agentId");
    if (requestedAgentId && !uuid.test(requestedAgentId)) return respond({error:"validation_error"},422);

    // AI Today is personal: email.read alone never grants an organization's
    // entire mailbox collection. Require BOTH an active agent binding and a
    // non-revoked grant for the authenticated user.
    const granted = await query<{agent_id:string;agent_name:string;mailbox_id:string}>(`
      SELECT DISTINCT a.id AS agent_id,a.name AS agent_name,e.id AS mailbox_id
      FROM briefing_mailbox_grants g
      JOIN email_accounts e ON e.id=g.mailbox_id AND e.organization_id=g.organization_id
      JOIN agent_email_accounts b ON b.email_account_id=e.id AND b.role IN ('primary','read_only')
      JOIN agents a ON a.id=b.agent_id AND a.organization_id=e.organization_id AND a.status='active'
      WHERE g.organization_id=$1 AND g.user_id=$2 AND g.revoked_at IS NULL
        AND e.deleted_at IS NULL AND e.status='connected'
      ORDER BY a.name,a.id,e.id
    `,[organizationId,subject.user.id]);
    const choiceMap = new Map<string,{id:string;name:string;mailboxCount:number}>();
    for(const row of granted.rows){
      const current = choiceMap.get(row.agent_id);
      if(current) current.mailboxCount++;
      else choiceMap.set(row.agent_id,{id:row.agent_id,name:row.agent_name,mailboxCount:1});
    }
    const agents = [...choiceMap.values()];
    if(requestedAgentId && !choiceMap.has(requestedAgentId)) return respond({error:"forbidden"},403);
    const selectedAgentId = requestedAgentId ?? agents[0]?.id ?? null;
    const now = new Date();
    const window = buildAiTodayWindow(days, now);
    const source = selectedAgentId ? await query<AiTodaySourceRow & {matched_count: string | number}>(`
      WITH scoped AS (
        SELECT m.id, m.thread_id, m.email_account_id, a.email_address AS account_email,
          COALESCE(m.from_email, m.from_name, '') AS from_address, m.subject, m.snippet,
          m.received_at, m.is_read, m.action_required, m.is_starred, m.importance_score,
          m.action_deadline,
          ROW_NUMBER() OVER (
            PARTITION BY m.email_account_id,
              CASE WHEN a.provider = 'imap_smtp' AND NULLIF(BTRIM(m.internet_message_id), '') IS NOT NULL
                THEN 'message:' || LOWER(BTRIM(m.internet_message_id))
                ELSE 'row:' || m.id::text END
            ORDER BY CASE WHEN f.role='inbox' OR UPPER(f.provider_folder_id)='INBOX' THEN 0 ELSE 1 END,
              m.received_at DESC NULLS LAST, m.id DESC
          ) AS copy_rank
        FROM email_messages m
        JOIN email_accounts a ON a.id=m.email_account_id
        LEFT JOIN email_folders f ON f.id=m.folder_id AND f.email_account_id=m.email_account_id
        WHERE m.organization_id = $1 AND a.organization_id = $1
          AND a.deleted_at IS NULL AND a.status='connected'
          AND EXISTS (
            SELECT 1 FROM briefing_mailbox_grants g
            JOIN agent_email_accounts b ON b.email_account_id=g.mailbox_id
            JOIN agents scoped_agent ON scoped_agent.id=b.agent_id
            WHERE g.organization_id=$1 AND g.user_id=$2 AND g.mailbox_id=a.id
              AND g.revoked_at IS NULL AND b.agent_id=$3
              AND b.role IN ('primary','read_only')
              AND scoped_agent.organization_id=$1 AND scoped_agent.status='active'
          )
          AND m.is_draft = false
          AND (
            (f.id IS NOT NULL AND (f.role='inbox' OR UPPER(f.provider_folder_id)='INBOX'))
            OR (a.provider <> 'imap_smtp' AND m.folder_id IS NULL AND m.is_sent = false)
          )
          AND m.received_at >= $4::timestamptz AND m.received_at <= $5::timestamptz
          AND (m.is_read = false OR m.action_required = true OR m.is_starred = true)
      )
      SELECT id, thread_id, email_account_id, account_email, from_address, subject, snippet,
        received_at, is_read, action_required, is_starred, importance_score, action_deadline,
        count(*) OVER() AS matched_count
      FROM scoped WHERE copy_rank=1
      ORDER BY CASE WHEN action_required THEN 0 WHEN is_starred THEN 1
        WHEN (importance_score BETWEEN 0.7 AND 1 OR importance_score >= 70) THEN 2 ELSE 3 END,
        received_at DESC NULLS LAST, id DESC
      LIMIT 18
    `, [organizationId, subject.user.id, selectedAgentId, window.from, window.to]) : {rows: [] as (AiTodaySourceRow & {matched_count:string|number})[]};

    const coverage = selectedAgentId ? await query<{connected_mailboxes: number | string; last_sync_at: Date | string | null; oldest_sync_at:Date|string|null; unsynced_mailboxes:number|string}>(`
      SELECT count(*) AS connected_mailboxes,max(COALESCE(e.last_synced_at,e.last_sync_at)) AS last_sync_at,
        min(COALESCE(e.last_synced_at,e.last_sync_at)) AS oldest_sync_at,
        count(*) FILTER(WHERE COALESCE(e.last_synced_at,e.last_sync_at) IS NULL) AS unsynced_mailboxes
      FROM email_accounts e
      WHERE e.organization_id=$1 AND e.status='connected' AND e.deleted_at IS NULL
        AND EXISTS(SELECT 1 FROM briefing_mailbox_grants g
          JOIN agent_email_accounts b ON b.email_account_id=g.mailbox_id
          JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1 AND a.status='active'
          WHERE g.organization_id=$1 AND g.user_id=$2 AND g.mailbox_id=e.id
            AND g.revoked_at IS NULL AND b.agent_id=$3 AND b.role IN ('primary','read_only'))
    `, [organizationId, subject.user.id, selectedAgentId]) : {rows:[] as {connected_mailboxes:number|string;last_sync_at:Date|string|null;oldest_sync_at:Date|string|null;unsynced_mailboxes:number|string}[]};
    const activity = selectedAgentId ? await query<{last_foreground_at:Date|string|null}>(`
      SELECT last_foreground_at FROM user_mail_activity
      WHERE organization_id=$1 AND user_id=$2 AND agent_id=$3
    `,[organizationId,subject.user.id,selectedAgentId]) : {rows:[] as {last_foreground_at:Date|string|null}[]};

    // Only schedules created by the current authenticated user; never expose
    // coworkers' task names, prompts, recipients or execution errors.
    const scheduled = await query<{id:string;name:string;status:string;last_fire_at:Date|string|null;next_fire_at:Date|string|null}>(`
      SELECT id,name,status,last_fire_at,next_fire_at FROM scheduled_jobs
      WHERE organization_id=$1 AND created_by=$2 AND status IN ('active','error','paused')
      ORDER BY next_fire_at ASC NULLS LAST, id ASC LIMIT 5
    `, [organizationId, subject.user.id]);

    // Approval counts require independent authorization and user ownership.
    // No approval metadata, recipients or content leaves this endpoint.
    const approvals = access.approvals ? await query<{email_pending: number | string; whatsapp_pending: number | string}>(`
      SELECT
        (SELECT count(*) FROM email_actions WHERE organization_id=$1 AND requested_by=$2 AND status='pending_approval') AS email_pending,
        (SELECT count(*) FROM whatsapp_send_actions WHERE organization_id=$1 AND requested_by=$2 AND status='pending' AND expires_at>now()) AS whatsapp_pending
    `, [organizationId, subject.user.id]) : null;

    const snapshot: AiTodaySnapshot = {
      windowDays: days, asOf: window.to,
      agentId:selectedAgentId, agents,
      lastVisitAt:aiTodayTimestamp(activity.rows[0]?.last_foreground_at),
      connectedMailboxes: Number(coverage.rows[0]?.connected_mailboxes ?? 0),
      lastSyncAt: aiTodayTimestamp(coverage.rows[0]?.last_sync_at),
      oldestSyncAt: aiTodayTimestamp(coverage.rows[0]?.oldest_sync_at),
      unsyncedMailboxes:Number(coverage.rows[0]?.unsynced_mailboxes??0),
      totalMatches: Number(source.rows[0]?.matched_count ?? 0),
      items: source.rows.map(projectAiTodaySource),
      pendingEmailApprovals: approvals ? Number(approvals.rows[0]?.email_pending ?? 0) : null,
      pendingWhatsAppApprovals: approvals ? Number(approvals.rows[0]?.whatsapp_pending ?? 0) : null,
      schedules: scheduled.rows.map((row): AiTodaySchedule => ({
        id: row.id, name: row.name.slice(0,150), status: row.status,
        lastFireAt: aiTodayTimestamp(row.last_fire_at), nextFireAt: aiTodayTimestamp(row.next_fire_at),
      })),
    };
    return respond({snapshot});
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
