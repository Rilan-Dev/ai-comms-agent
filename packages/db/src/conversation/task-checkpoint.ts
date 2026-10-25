import {randomUUID} from 'node:crypto';
import type {OperationResult} from '@ai-comms-agent/shared';
import type {PoolClient} from 'pg';
import {withTransaction} from '../client';

export type CheckpointScope={organizationId:string;agentId:string;conversationId:string;userId:string};
type PreparedMailTask={count:number;recipient:string;account:string;requireHumanApproval:true;body:string;asOf:string;sources:Array<{messageId:string;mailbox:string}>};
export type MailTaskCheckpoint={kind:'mail_whatsapp_review';version:1;creatorId:string;agentId:string;createdAt:string;expiresAt:string;prepared:PreparedMailTask;turnId:string;correlationId:string;operation?:OperationResult};
export type MailTaskCheckpointInput=CheckpointScope & {prepared:PreparedMailTask;turnId:string;correlationId:string};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validPrepared(task:PreparedMailTask):boolean {
 return Number.isInteger(task.count)&&task.count>=1&&task.count<=10&&/^\+[1-9]\d{7,14}$/.test(task.recipient)
  &&typeof task.account==='string'&&task.account.trim().length>0&&task.account.length<=128&&task.requireHumanApproval===true
  &&typeof task.body==='string'&&task.body.trim().length>0&&task.body.length<=4096&&Number.isFinite(Date.parse(task.asOf))
  &&Array.isArray(task.sources)&&task.sources.length>0&&task.sources.length<=task.count
  &&new Set(task.sources.map(source=>source.messageId)).size===task.sources.length
  &&task.sources.every(source=>uuid.test(source.messageId)&&typeof source.mailbox==='string'&&source.mailbox.length>0&&source.mailbox.length<=320);
}

async function sourcesReadable(client:PoolClient,scope:CheckpointScope,task:PreparedMailTask):Promise<boolean>{
 const result=await client.query<{n:number}>(`SELECT COUNT(DISTINCT m.id)::int AS n
  FROM jsonb_to_recordset($3::jsonb) AS source("messageId" text,mailbox text)
  JOIN email_messages m ON m.id::text=source."messageId" AND m.organization_id=$1
  JOIN email_accounts a ON a.id=m.email_account_id AND a.organization_id=$1 AND lower(a.email_address)=lower(source.mailbox)
   AND a.status='connected' AND a.deleted_at IS NULL
  WHERE EXISTS(SELECT 1 FROM agent_email_accounts b JOIN agents g ON g.id=b.agent_id AND g.organization_id=$1
   WHERE b.agent_id=$2 AND b.email_account_id=a.id AND b.role IN ('primary','read_only'))`,[scope.organizationId,scope.agentId,JSON.stringify(task.sources)]);
 return result.rows[0]?.n===task.sources.length;
}

/** Host-only metadata: HTTP clients supply an opaque ref, never a replacement
 * body, source list, identity, expiry or approval mode. No raw mail is stored. */
export async function saveMailTaskCheckpoint(input:MailTaskCheckpointInput):Promise<string>{
 if(!validPrepared(input.prepared)||!input.turnId||!input.correlationId)throw Error('Invalid mail task checkpoint');
 return withTransaction(async client=>{
  const conversation=await client.query(`SELECT c.id FROM conversations c JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id
   WHERE c.id=$1 AND c.organization_id=$2 AND c.agent_id=$3 AND c.channel='chat'`,[input.conversationId,input.organizationId,input.agentId]);
  if(!conversation.rows.length||!await sourcesReadable(client,input,input.prepared))throw Error('Mail task scope is unavailable');
  const now=Date.now();
  const checkpoint:MailTaskCheckpoint={kind:'mail_whatsapp_review',version:1,creatorId:input.userId,agentId:input.agentId,createdAt:new Date(now).toISOString(),expiresAt:new Date(now+15*60_000).toISOString(),prepared:input.prepared,turnId:input.turnId,correlationId:input.correlationId};
  const ref=randomUUID();
  await client.query(`INSERT INTO conversation_messages(id,conversation_id,role,content,content_json) VALUES($1,$2,'assistant',$3,$4::jsonb)`,[ref,input.conversationId,input.prepared.body,JSON.stringify(checkpoint)]);
  await client.query('UPDATE conversations SET updated_at=now(),last_message_at=now() WHERE id=$1 AND organization_id=$2',[input.conversationId,input.organizationId]);
  return ref;
 });
}

async function readCheckpoint(client:PoolClient,scope:CheckpointScope,ref:string,lock=false):Promise<MailTaskCheckpoint|null>{
 if(!uuid.test(ref))return null;
 const result=await client.query<{content_json:MailTaskCheckpoint}>(`SELECT m.content_json FROM conversation_messages m
  JOIN conversations c ON c.id=m.conversation_id JOIN agents a ON a.id=c.agent_id AND a.organization_id=c.organization_id
  WHERE m.id=$1 AND c.organization_id=$2 AND c.agent_id=$3 AND c.id=$4 AND c.channel='chat' AND m.role='assistant'
  ${lock?'FOR UPDATE OF m':''}`,[ref,scope.organizationId,scope.agentId,scope.conversationId]);
 const checkpoint=result.rows[0]?.content_json;
 if(!checkpoint||checkpoint.kind!=='mail_whatsapp_review'||checkpoint.version!==1||checkpoint.creatorId!==scope.userId||checkpoint.agentId!==scope.agentId
  ||!Number.isFinite(Date.parse(checkpoint.expiresAt))||Date.parse(checkpoint.expiresAt)<=Date.now()||!validPrepared(checkpoint.prepared)
  ||!checkpoint.turnId||!checkpoint.correlationId||!await sourcesReadable(client,scope,checkpoint.prepared))return null;
 return checkpoint;
}

export async function loadMailTaskCheckpoint(scope:CheckpointScope,ref:string):Promise<MailTaskCheckpoint|null>{
 return withTransaction(client=>readCheckpoint(client,scope,ref));
}

/** The row lock serializes continuations across processes. The registered
 * executor keeps its original turn id, so even a crash between tool persistence
 * and checkpoint commit reconciles the same idempotency key, never a new send.
 * Any unclassified exception is retained as uncertainty, not retried. */
export async function reconcileMailTaskCheckpoint(scope:CheckpointScope,ref:string,
 authorize:(checkpoint:MailTaskCheckpoint)=>Promise<boolean>,
 execute:(checkpoint:MailTaskCheckpoint)=>Promise<OperationResult>,
 refresh?:(operation:OperationResult,checkpoint:MailTaskCheckpoint)=>Promise<OperationResult>,
):Promise<OperationResult|null>{
 return withTransaction(async client=>{
  const checkpoint=await readCheckpoint(client,scope,ref,true);
  if(!checkpoint||!await authorize(checkpoint))return null;
  let operation=checkpoint.operation;
  if(operation){if(refresh)operation=await refresh(operation,checkpoint);}
  else {
   try{operation=await execute(checkpoint);}
   catch{operation={channel:'whatsapp',operation:'send',state:'outcome_unknown',turnId:checkpoint.turnId,correlationId:checkpoint.correlationId,callId:ref};}
  }
  await client.query('UPDATE conversation_messages SET content_json=$2::jsonb WHERE id=$1',[ref,JSON.stringify({...checkpoint,operation})]);
  return operation;
 });
}
