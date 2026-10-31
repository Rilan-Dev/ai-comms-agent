import type {PoolClient} from 'pg';
import type {EmailMessageFlags} from '@ai-comms-agent/shared';
import {withTransaction} from '../client';

export type MailboxFlagScope={organizationId:string;emailAccountId:string};
export type MailboxFlagPage=MailboxFlagScope&{
  leaseAt:string;startedAt:string;cursorBefore:string|null;nextCursor:string|null;observedAfter:string;focused:boolean;
  messages:Array<{id:string;providerMessageId:string;messageIdHeader:string|null;revision:string;observationRevision:string}>;
};
export type MailboxFlagResult={flags:EmailMessageFlags[];missing:string[];refetched:Array<{providerMessageId:string;messageIdHeader:string|null}>};
const header=(value:unknown)=>typeof value==='string'&&value.trim()?value.trim():null;
const changed=(what:string)=>new Error(`Mailbox flags ${what} changed; retry reconciliation`);
async function lock(client:PoolClient,scope:MailboxFlagScope,leaseAt:string){
  return (await client.query(`SELECT s.*,s.provider_flags_started_at::text started_at,a.provider
    FROM email_sync_states s JOIN email_accounts a ON a.id=s.email_account_id AND a.organization_id=s.organization_id
    WHERE s.organization_id=$1 AND s.email_account_id=$2 AND s.status='running' AND s.last_attempt_at=$3::timestamptz
      AND a.deleted_at IS NULL AND a.status='connected' FOR UPDATE OF s`,[scope.organizationId,scope.emailAccountId,leaseAt])).rows[0];
}

/** Trusted mailbox worker only. This is a metadata snapshot, never user review. */
export async function prepareMailboxFlagPage(scope:MailboxFlagScope,leaseAt:string,limit=50,focused=false):Promise<MailboxFlagPage|null>{
  if(!Number.isInteger(limit)||limit<1||limit>200)throw new Error('Invalid metadata page bound');
  return withTransaction(async client=>{
    const state=await lock(client,scope,leaseAt);if(!state)return null;
    const observedAfter=(await client.query('SELECT clock_timestamp()::text value')).rows[0].value as string;
    let startedAt=focused?observedAfter:state.started_at as string|null;
    let cursor=focused?null:state.provider_flags_cursor as string|null;
    if(!startedAt){
      startedAt=(await client.query(`UPDATE email_sync_states SET provider_flags_started_at=clock_timestamp(),provider_flags_cursor=NULL
        WHERE organization_id=$1 AND email_account_id=$2 RETURNING provider_flags_started_at::text started_at`,[scope.organizationId,scope.emailAccountId])).rows[0].started_at;
      cursor=null;
    }
    const rows=(await client.query(`SELECT id,provider_message_id,internet_message_id,updated_at::text revision,mail_provider_observation_revision(id) observation_revision FROM email_messages
      WHERE organization_id=$1 AND email_account_id=$2 AND NOT is_draft AND NOT is_sent AND provider_message_id IS NOT NULL
        AND ($6::boolean OR (($3::uuid IS NULL OR id>$3) AND created_at<=$4::timestamptz))
        AND (NOT $6::boolean OR provider_flags_requested_at IS NOT NULL)
        ORDER BY CASE WHEN $6::boolean THEN provider_flags_requested_at END NULLS LAST,id LIMIT $5`,[scope.organizationId,scope.emailAccountId,cursor,startedAt,limit+1,focused])).rows;
    const selected=rows.slice(0,limit);
    return {...scope,leaseAt,startedAt:startedAt!,cursorBefore:cursor,nextCursor:rows.length>limit?selected.at(-1).id:null,observedAfter,focused,
      messages:selected.map(row=>({id:row.id,providerMessageId:row.provider_message_id,messageIdHeader:header(row.internet_message_id),revision:row.revision,observationRevision:row.observation_revision}))};
  });
}

/** Fence existing canonical refetch/deletion paths while they persist. These
 * paths use their normal DB connections; do not acquire message locks here. */
export async function withMailboxFlagLease(page:MailboxFlagPage,work:()=>Promise<void>):Promise<void>{
  await withTransaction(async client=>{
    const state=await lock(client,page,page.leaseAt);
    if(!state||(!page.focused&&(state.started_at!==page.startedAt||state.provider_flags_cursor!==page.cursorBefore)))throw changed('lease');
    await work();
  });
}

/** Advance only after every selected identity has a confirmed outcome. Provider
 * deletion/refetch work must already have persisted through normal ingestion. */
export async function completeMailboxFlagPage(page:MailboxFlagPage,result:MailboxFlagResult):Promise<void>{
  if(page.messages.length>200)throw new Error('Invalid metadata page bound');
  const expected=new Map(page.messages.map(message=>[message.providerMessageId,message]));
  const all=[...result.flags.map(flag=>flag.provider_message_id),...result.missing,...result.refetched.map(item=>item.providerMessageId)];
  if(expected.size!==page.messages.length||all.length!==expected.size||new Set(all).size!==all.length||all.some(id=>!expected.has(id)))throw new Error('Invalid metadata source coverage or duplicate identity');
  if(result.flags.some(flag=>[flag.is_read,flag.is_starred,flag.is_draft,flag.is_outbound].some(value=>typeof value!=='boolean')))throw new Error('Invalid provider flags');
  await withTransaction(async client=>{
    const state=await lock(client,page,page.leaseAt);
    if(!state||(!page.focused&&(state.started_at!==page.startedAt||state.provider_flags_cursor!==page.cursorBefore)))throw changed('lease or cursor');
    const current=(await client.query(`SELECT id,provider_message_id,internet_message_id,thread_id,updated_at::text revision,mail_provider_observation_revision(id) observation_revision FROM email_messages
      WHERE organization_id=$1 AND email_account_id=$2 AND id=ANY($3::uuid[]) FOR UPDATE`,[page.organizationId,page.emailAccountId,page.messages.map(message=>message.id)])).rows;
    const byId=new Map(current.map(row=>[row.id,row]));
    for(const id of result.missing)if(byId.has(expected.get(id)!.id))throw new Error('Missing provider source is still present locally');
    for(const receipt of result.refetched){
      const row=byId.get(expected.get(receipt.providerMessageId)!.id);
      if(!row||row.provider_message_id!==receipt.providerMessageId||header(row.internet_message_id)!==header(receipt.messageIdHeader))throw changed('refetched source identity');
    }
    for(const flag of result.flags){
      const original=expected.get(flag.provider_message_id)!;const row=byId.get(original.id);
      if(!row||row.provider_message_id!==original.providerMessageId||row.revision!==original.revision||row.observation_revision!==original.observationRevision)throw changed('source');
      if(header(flag.message_id_header)!==original.messageIdHeader||(state.provider==='imap_smtp'&&!original.messageIdHeader))throw new Error('Provider source identity requires a canonical refetch');
    }
    const updates=result.flags.map(flag=>({id:expected.get(flag.provider_message_id)!.id,is_read:flag.is_read,is_starred:flag.is_starred,is_draft:flag.is_draft,is_sent:flag.is_outbound}));
    if(updates.length)await client.query(`UPDATE email_messages m SET is_read=f.is_read,is_starred=f.is_starred,is_draft=f.is_draft,is_sent=f.is_sent,updated_at=now()
      FROM jsonb_to_recordset($3::jsonb) AS f(id uuid,is_read boolean,is_starred boolean,is_draft boolean,is_sent boolean)
      WHERE m.organization_id=$1 AND m.email_account_id=$2 AND m.id=f.id
        AND (m.is_read,m.is_starred,m.is_draft,m.is_sent) IS DISTINCT FROM (f.is_read,f.is_starred,f.is_draft,f.is_sent)`,[page.organizationId,page.emailAccountId,JSON.stringify(updates)]);
    await client.query(`UPDATE email_messages SET provider_flags_observed_at=$4::timestamptz,
      provider_flags_observation_revision=mail_provider_observation_revision(id),
      provider_flags_requested_at=CASE WHEN provider_flags_requested_at<=$4::timestamptz THEN NULL ELSE provider_flags_requested_at END
      WHERE organization_id=$1 AND email_account_id=$2 AND id=ANY($3::uuid[])`,
      [page.organizationId,page.emailAccountId,page.messages.filter(message=>!result.missing.includes(message.providerMessageId)).map(message=>message.id),page.observedAfter]);
    await client.query(`UPDATE email_threads t SET is_unread=EXISTS(SELECT 1 FROM email_messages m WHERE m.thread_id=t.id AND m.organization_id=t.organization_id AND NOT m.is_read AND NOT m.is_draft AND NOT m.is_sent)
      WHERE t.organization_id=$1 AND t.email_account_id=$2 AND t.id=ANY($3::uuid[])`,[page.organizationId,page.emailAccountId,current.map(row=>row.thread_id).filter(Boolean)]);
    if(!page.focused)await client.query(`UPDATE email_sync_states SET provider_flags_cursor=$3,
      provider_flags_checked_at=CASE WHEN $3::uuid IS NULL THEN $4::timestamptz ELSE provider_flags_checked_at END,
      provider_flags_started_at=CASE WHEN $3::uuid IS NULL THEN NULL ELSE provider_flags_started_at END,
      provider_flags_error=NULL,updated_at=now() WHERE organization_id=$1 AND email_account_id=$2`,[page.organizationId,page.emailAccountId,page.nextCursor,page.startedAt]);
  });
}
