import {query,reconcileMailTaskCheckpoint,saveMailTaskCheckpoint,type CheckpointScope,type MailTaskCheckpoint} from '@ai-comms-agent/db';
import {ForbiddenError,operationResultFromToolCall,turnAllowsTool,type OperationResult,type ToolContext} from '@ai-comms-agent/shared';
import {createEmailToolRuntime,invokeEmailReadTool} from '../../../../worker/src/agent/email-tool-runtime';
import {createWhatsAppToolRuntime,invokeWhatsAppTool} from '../../../../worker/src/agent/whatsapp-tool-runtime';
import {getMailReportEvidence} from '../mail/report-evidence';
import {completeMailWhatsAppTask,prepareMailWhatsAppTask,type MailWhatsAppTask} from './mail-whatsapp-task';

function scopeOf(context:ToolContext):CheckpointScope{
 if(!context.user_id||!context.conversation_id||context.auth_subject.user_id!==context.user_id
  ||!context.auth_subject.permissions.includes('email.read')||!context.auth_subject.permissions.includes('whatsapp.send')){
  throw new ForbiddenError('missing_permission','Current email read and WhatsApp send access are required.');
 }
 return {organizationId:context.organization_id,agentId:context.agent_id,conversationId:context.conversation_id,userId:context.user_id};
}

async function currentAuthority(context:ToolContext,accountId?:string,mailboxes:readonly string[]=[]):Promise<boolean>{
 const scope=scopeOf(context);
 const [mail,whatsapp]=await Promise.all([createEmailToolRuntime(scope.organizationId,scope.agentId),createWhatsAppToolRuntime(scope.organizationId,scope.agentId)]);
 const reader=mail.registry.listForAgent(scope.agentId).filter(tool=>turnAllowsTool(context,tool.name)).find(tool=>tool.name==='email.search'||tool.name==='email.messages.list');
 const sender=whatsapp.registry.listForAgent(scope.agentId).filter(tool=>turnAllowsTool(context,tool.name)).find(tool=>tool.name==='whatsapp.send');
 if(!reader||!sender)return false;
 if(!(await mail.authorize(reader,{},context)).allowed||!(await whatsapp.authorize(sender,accountId?{account_id:accountId}:{},context)).allowed)return false;
 for(const mailbox of new Set(mailboxes))if(!(await mail.authorize(reader,{account_id:mailbox},context)).allowed)return false;
 return true;
}

type ActionRow={id:string;status:string;expires_at:string|Date;whatsapp_account_id:string;recipient_phone:string;message_body:string;payload_type:string;requested_by:string;agent_id:string};
async function existingOperation(context:ToolContext,checkpoint:MailTaskCheckpoint,ref:string):Promise<OperationResult|null>{
 const task=checkpoint.prepared;
 const result=await query<ActionRow>(`SELECT id,status,expires_at,whatsapp_account_id,recipient_phone,message_body,payload_type,requested_by,agent_id
  FROM whatsapp_send_actions WHERE organization_id=$1 AND idempotency_key=$2 LIMIT 1`,[context.organization_id,`agent:${context.agent_id}:${checkpoint.turnId}:${task.recipient}`]);
 const action=result.rows[0];
 if(!action)return null;
 const identity={channel:'whatsapp' as const,operation:'send' as const,turnId:checkpoint.turnId,correlationId:checkpoint.correlationId,callId:ref};
 if(action.requested_by!==context.user_id||action.agent_id!==context.agent_id||action.whatsapp_account_id!==task.account||action.recipient_phone!==task.recipient||action.message_body!==task.body||action.payload_type!=='text')return {...identity,state:'failed',errorCode:'idempotency_conflict'};
 const base={...identity,resourceId:action.id};
 if(action.status==='pending')return {...base,state:new Date(action.expires_at).getTime()<=Date.now()?'expired':'pending_approval'};
 if(action.status==='rejected'||action.status==='expired'||action.status==='queued')return {...base,state:action.status};
 if(action.status==='sent')return {...base,state:'provider_accepted'};
 if(action.status==='failed'||action.status==='requires_template')return {...base,state:'failed',errorCode:action.status==='requires_template'?'requires_template':'provider_failed'};
 return {...base,state:'outcome_unknown'};
}

/** Fresh request auth supplies context; all mutable content comes from the
 * creator-scoped host checkpoint. Reconcile first, never replay a saved action. */
export async function continueMailWhatsAppReview(context:ToolContext,ref:string):Promise<OperationResult|null>{
 const scope=scopeOf(context);
 return reconcileMailTaskCheckpoint(scope,ref,
  checkpoint=>currentAuthority(context,checkpoint.prepared.account,checkpoint.prepared.sources.map(source=>source.mailbox)),
  async checkpoint=>{
   const existing=await existingOperation(context,checkpoint,ref);
   if(existing)return existing;
   const runtime=await createWhatsAppToolRuntime(scope.organizationId,scope.agentId);
   const trusted={...context,turn_id:checkpoint.turnId,correlation_id:checkpoint.correlationId,require_human_approval:true};
   const task=checkpoint.prepared;
   const result=await invokeWhatsAppTool(runtime,'whatsapp.send',{account_id:task.account,to:task.recipient,payload_type:'text',body:task.body},trusted);
   return operationResultFromToolCall({context:trusted,callId:ref,registeredName:'whatsapp.send',result})
    ?? {channel:'whatsapp',operation:'send',state:'outcome_unknown',turnId:checkpoint.turnId,correlationId:checkpoint.correlationId,callId:ref};
  },
  async (operation,checkpoint)=>await existingOperation(context,checkpoint,ref)??{...operation,state:'outcome_unknown'},
 );
}

export async function startMailWhatsAppReview(context:ToolContext,task:MailWhatsAppTask){
 const scope=scopeOf(context);
 // Pin the actual assigned phone before saving. A later label change cannot
 // redirect the frozen summary to a different WhatsApp sender.
 const accounts=await query<{id:string}>(`SELECT w.id FROM whatsapp_accounts w JOIN agent_whatsapp_accounts b ON b.whatsapp_account_id=w.id AND b.agent_id=$2
  JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1
  WHERE w.organization_id=$1 AND w.status='connected' AND w.deleted_at IS NULL
   AND (w.id::text=$3 OR lower(w.display_name)=lower($3) OR w.phone_number=$3) LIMIT 2`,[scope.organizationId,scope.agentId,task.account]);
 const account=accounts.rows.length===1?accounts.rows[0]!.id:null;
 if(!account||!await currentAuthority(context,account))throw new ForbiddenError('missing_permission','Choose an assigned WhatsApp phone and enable the required current access before preparing this review.');
 const prepared=await prepareMailWhatsAppTask({...task,account},async args=>{
  const evidence=await getMailReportEvidence({...args,organizationId:scope.organizationId,agentId:scope.agentId,
   readableAccountIds:context.agent_configuration?.snapshot.channels.email.filter(binding=>binding.role==='primary'||binding.role==='read_only').map(binding=>binding.accountId)});
  const runtime=await createEmailToolRuntime(scope.organizationId,scope.agentId);
  const reader=runtime.registry.listForAgent(scope.agentId).filter(tool=>turnAllowsTool(context,tool.name)).find(tool=>tool.name==='email.search'||tool.name==='email.messages.list');
  if(!reader)throw new ForbiddenError('missing_permission','Mailbox summary access changed.');
  // Aggregate selection stays a single canonical snapshot; every selected
  // mailbox is also read through the existing audited registered executor.
  // If its bounded result no longer contains the selected sources, refresh
  // instead of claiming that a changed or denied selection was summarized.
  for(const mailbox of new Set(evidence.rows.map(row=>row.account_email))){
   if(!mailbox)throw Error('Incomplete mail selection scope');
   const read=await invokeEmailReadTool(runtime,reader.name,{account_id:mailbox,unread_only:true,limit:task.count,date_from:args.fromUtc,date_to:args.toUtc},context);
   const output=read.output as {messages?:Array<{id:string}>}|undefined;
   const ids=new Set(output?.messages?.map(message=>message.id));
   if(!read.ok||evidence.rows.some(row=>row.account_email===mailbox&&!ids.has(row.id)))throw new ForbiddenError('missing_permission','The selected mail changed or is no longer readable. Refresh the summary.');
  }
  return evidence;
 },new Date().toISOString());
 if(!await currentAuthority(context,account,prepared.sources.map(source=>source.mailbox)))throw new ForbiddenError('missing_permission','Source access changed. Refresh the summary before requesting review.');
 const result=await completeMailWhatsAppTask(prepared,{
  save:value=>saveMailTaskCheckpoint({...scope,prepared:value,turnId:context.turn_id,correlationId:context.correlation_id}),
  send:ref=>continueMailWhatsAppReview(context,ref),
 });
 return {...result,summary:prepared.body};
}
