import { query } from '@ai-comms-agent/db';
import type { RollingMailRow } from './rolling-summary';

export type MailReportScope={unreadOnly:boolean;sender?:string;topic?:string;mailbox?:string;inboxOnly?:boolean};
export type MailReportEvidence={scope:MailReportScope;fromUtc:string;toUtc:string;matchedCount:number;includedCount:number;hasMore:boolean;lastSyncAt:string|null;rows:RollingMailRow[];mailboxCounts:Array<{account_email:string;unread_count:number}>};
export class MailReportScopeError extends Error {}

/** A single database snapshot determines the selected rows and their count.
 * Scope is always rechecked against the organization and readable bindings.
 * IMAP folder UIDs are representations; RFC Message-ID identifies copies in
 * one mailbox. Other providers and different mailboxes retain their identity.
 * Historical rows are never deleted or changed by reporting. */
export async function getMailReportEvidence(args:{organizationId:string;agentId:string;scope:MailReportScope;fromUtc:string;toUtc:string;exclusiveEnd?:boolean;limit?:number}):Promise<MailReportEvidence>{
  const limit=Math.min(500,Math.max(1,args.limit??500));
  const {scope}=args;
  const accounts=await query<{id:string;last_synced_at:string|Date|null}>(`SELECT a.id,a.last_synced_at FROM email_accounts a
    WHERE a.organization_id=$1 AND a.deleted_at IS NULL AND a.status='connected'
      AND ($3::text IS NULL OR lower(a.email_address)=lower($3))
      AND EXISTS(SELECT 1 FROM agent_email_accounts b JOIN agents g ON g.id=b.agent_id AND g.organization_id=$1
        WHERE b.email_account_id=a.id AND b.agent_id=$2 AND b.role IN ('primary','read_only'))`,[args.organizationId,args.agentId,scope.mailbox??null]);
  if(scope.mailbox && accounts.rows.length!==1)throw new MailReportScopeError('Choose one connected mailbox assigned to this agent; the requested address is unavailable or ambiguous.');
  const result=await query<RollingMailRow & {mailbox_counts:MailReportEvidence['mailboxCounts']}>(`WITH ranked AS (
    SELECT m.id,m.thread_id,m.from_email::text AS from_email,m.from_name,m.subject,m.received_at,m.is_read,m.text_body AS search_body,
      LEFT(m.snippet,600) AS snippet,LEFT(m.text_body,1200) AS text_body,
      a.email_address AS account_email,
      (f.role='inbox' OR UPPER(f.provider_folder_id)='INBOX') AS in_inbox,
      ROW_NUMBER() OVER(PARTITION BY m.email_account_id,
        CASE WHEN a.provider='imap_smtp' AND NULLIF(BTRIM(m.internet_message_id),'') IS NOT NULL
          THEN 'message:'||BTRIM(m.internet_message_id) ELSE 'row:'||m.id::text END
        ORDER BY CASE WHEN f.role='inbox' OR UPPER(f.provider_folder_id)='INBOX' THEN 0 ELSE 1 END,m.received_at DESC,m.id DESC) AS representation_rank
    FROM email_messages m JOIN email_accounts a ON a.id=m.email_account_id
      AND a.organization_id=$1 AND a.deleted_at IS NULL AND a.status='connected'
    LEFT JOIN email_folders f ON f.id=m.folder_id AND f.email_account_id=m.email_account_id
    WHERE m.organization_id=$1 AND m.received_at >= $3::timestamptz
      AND (CASE WHEN $9::boolean THEN m.received_at < $4::timestamptz ELSE m.received_at <= $4::timestamptz END)
      AND m.is_draft IS FALSE AND m.is_sent IS FALSE
      AND ($10::text IS NULL OR lower(a.email_address)=lower($10))
      AND EXISTS(SELECT 1 FROM agent_email_accounts b JOIN agents bound_agent ON bound_agent.id=b.agent_id AND bound_agent.organization_id=$1
        WHERE b.email_account_id=a.id AND b.agent_id=$2 AND b.role IN ('primary','read_only'))
  ), matched AS (
    SELECT * FROM ranked m WHERE representation_rank=1
      AND (NOT $7::boolean OR m.is_read IS FALSE)
      AND (NOT $11::boolean OR m.in_inbox IS TRUE)
      AND ($5::text IS NULL OR strpos(lower(coalesce(m.from_email,'')),lower($5))>0 OR strpos(lower(coalesce(m.from_name,'')),lower($5))>0)
      AND ($6::text IS NULL OR strpos(lower(coalesce(m.subject,'')),lower($6))>0 OR strpos(lower(coalesce(m.search_body,'')),lower($6))>0)
  ) SELECT m.id,m.thread_id,m.from_email,m.from_name,m.subject,m.received_at,m.snippet,m.text_body,m.account_email,
    COUNT(*) OVER()::integer AS total_count,
    (SELECT jsonb_agg(jsonb_build_object('account_email',counts.account_email,'unread_count',counts.unread_count) ORDER BY counts.account_email)
      FROM (SELECT account_email,COUNT(*)::integer AS unread_count FROM matched GROUP BY account_email) counts) AS mailbox_counts
    FROM matched m ORDER BY m.received_at DESC,m.id DESC LIMIT $8`,[
    args.organizationId,args.agentId,args.fromUtc,args.toUtc,scope.sender??null,scope.topic??null,scope.unreadOnly,limit,args.exclusiveEnd??false,scope.mailbox??null,scope.inboxOnly??false,
  ]);
  const matchedCount=Number(result.rows[0]?.total_count??0);
  const syncTimes=accounts.rows.map(account=>account.last_synced_at?new Date(account.last_synced_at).getTime():NaN);
  const lastSyncAt=syncTimes.length && syncTimes.every(Number.isFinite)?new Date(Math.min(...syncTimes)).toISOString():null;
  return {scope,fromUtc:args.fromUtc,toUtc:args.toUtc,matchedCount,includedCount:result.rows.length,hasMore:matchedCount>result.rows.length,lastSyncAt,rows:result.rows,mailboxCounts:result.rows[0]?.mailbox_counts??[]};
}
