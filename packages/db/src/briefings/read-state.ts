import type {PoolClient} from 'pg';
export class MailboxReadStatePendingError extends Error {
  constructor(){super('Mailbox read status is being checked; try again shortly');this.name='MailboxReadStatePendingError';}
}

/** Called after resolving current personal mailbox grants. Never refreshes mail
 * or acknowledges review merely because the owner opens a briefing. */
export async function requireFreshMailboxFlags(client:PoolClient,organizationId:string,mailboxIds:string[]):Promise<void>{
  const ids=[...new Set(mailboxIds)];
  if(!ids.length)throw new MailboxReadStatePendingError();
  const result=await client.query(`SELECT a.id FROM email_accounts a JOIN email_sync_states s
    ON s.email_account_id=a.id AND s.organization_id=a.organization_id
    WHERE a.organization_id=$1 AND a.id=ANY($2::uuid[]) AND a.deleted_at IS NULL AND a.status='connected'
      AND s.provider_flags_started_at IS NULL AND s.provider_flags_error IS NULL
      AND s.provider_flags_checked_at>=now()-interval '5 minutes'`,[organizationId,ids]);
  if(result.rows.length!==ids.length)throw new MailboxReadStatePendingError();
}
