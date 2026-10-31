import {query} from '@ai-comms-agent/db';
import {readWhatsAppWidget,type WhatsAppWidget,type WorkflowStatus} from './whatsapp-workflow-contract';

export type WorkflowScope={organizationId:string;agentId:string;conversationId:string;userId:string};
export const WORKFLOW_FALLBACK='Use the options below to check WhatsApp, edit the recipient and review your message. Sending requires a separate approval.';

export async function createWhatsAppWorkflow(scope:WorkflowScope,request:string,reference:string,turnId:string,content=WORKFLOW_FALLBACK,status:'draft'|'requesting'='draft'){
 const widget:WhatsAppWidget={version:1,kind:'whatsapp_workflow',revision:0,ownerId:scope.userId,turnId,reference,
  // Preserve only an unambiguous exact number. Never turn an email request or
  // model-generated explanation into the outgoing body without user review.
  recipient:request.match(/\+[1-9]\d{7,14}\b/g)?.length===1?request.match(/\+[1-9]\d{7,14}\b/)![0]:'',body:'',
  accountId:null,accountLabel:null,readiness:null,actionId:null,status,notice:'',expiresAt:new Date(Date.now()+86400000).toISOString()};
 const result=await query<{id:string}>(`INSERT INTO conversation_messages(conversation_id,role,content,content_json)
  SELECT c.id,'assistant',$4,$5::jsonb FROM conversations c
  WHERE c.organization_id=$1 AND c.agent_id=$2 AND c.id=$3 AND c.channel='chat' RETURNING id`,
  [scope.organizationId,scope.agentId,scope.conversationId,content,JSON.stringify({ui:widget})]);
 if(!result.rows[0])throw new Error('Workflow conversation unavailable');
 return {messageId:result.rows[0].id,widget,content};
}

export async function loadWorkflow(scope:WorkflowScope,messageId:string){
 const result=await query<{content_json:unknown}>(`SELECT m.content_json FROM conversation_messages m JOIN conversations c ON c.id=m.conversation_id
  WHERE c.organization_id=$1 AND c.agent_id=$2 AND c.id=$3 AND m.id=$4 AND c.channel='chat' AND m.role='assistant'`,
  [scope.organizationId,scope.agentId,scope.conversationId,messageId]);
 const widget=readWhatsAppWidget(result.rows[0]?.content_json);
 return widget?.ownerId===scope.userId?widget:null;
}

/** Compare-and-swap is the operation claim. A losing tab never invokes tools. */
export async function replaceWorkflow(scope:WorkflowScope,messageId:string,previous:WhatsAppWidget,next:WhatsAppWidget,content?:string){
 const widget={...next,revision:previous.revision+1};
 const result=await query<{id:string}>(`UPDATE conversation_messages m SET content_json=jsonb_set(COALESCE(m.content_json,'{}'::jsonb),'{ui}',$7::jsonb),content=COALESCE($8, m.content)
  FROM conversations c WHERE c.id=m.conversation_id AND c.organization_id=$1 AND c.agent_id=$2 AND c.id=$3 AND m.id=$4
  AND m.role='assistant' AND m.content_json->'ui'->>'ownerId'=$5 AND (m.content_json->'ui'->>'revision')::integer=$6 RETURNING m.id`,
  [scope.organizationId,scope.agentId,scope.conversationId,messageId,scope.userId,previous.revision,JSON.stringify(widget),content??null]);
 return result.rows.length?widget:null;
}

/** Existing action is authoritative, including after a lost HTTP response. */
export async function reconcileWorkflow(scope:WorkflowScope,widget:WhatsAppWidget):Promise<WhatsAppWidget>{
 const result=await query<{id:string;status:string;expires_at:string;recipient_phone:string;message_body:string;whatsapp_account_id:string}>(
  `SELECT id,status,expires_at,recipient_phone,message_body,whatsapp_account_id FROM whatsapp_send_actions
   WHERE organization_id=$1 AND agent_id=$2 AND requested_by=$3 AND idempotency_key LIKE $4 ORDER BY created_at DESC LIMIT 2`,
  [scope.organizationId,scope.agentId,scope.userId,`agent:${scope.agentId}:${widget.turnId}:%`]);
 if(result.rows.length>1)return {...widget,status:'unknown',notice:'More than one request exists for this turn. Review the WhatsApp queue before another request.'};
 const action=result.rows[0];
 if(!action)return widget.status==='requesting'?{...widget,status:'unknown',notice:'The previous request is still unconfirmed. Check status again before creating another.'}:widget;
 const status:WorkflowStatus=action.status==='pending'&&new Date(action.expires_at).getTime()<=Date.now()?'expired':
  ['pending','approved','queued','sent','failed','expired','rejected','requires_template'].includes(action.status)?action.status as WorkflowStatus:'unknown';
 return {...widget,actionId:action.id,status,recipient:action.recipient_phone,body:action.message_body,accountId:action.whatsapp_account_id,notice:''};
}
