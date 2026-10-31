import type {ToolContext} from './types';

/** A frozen turn is a ceiling, never a grant: live authorizers still apply
 * current user, policy, account and provider restrictions on each invocation. */
export function turnAllowsTool(context:ToolContext,name:string):boolean{
 const frozen=context.agent_configuration;if(!frozen)return true;
 return frozen.organizationId===context.organization_id&&frozen.agentId===context.agent_id&&frozen.snapshot.lifecycle.status==='active'&&frozen.snapshot.policy?.allowedTools.includes(name)===true;
}
export function turnRequiresHumanApproval(context:ToolContext):boolean{
 return context.require_human_approval===true||!!context.agent_configuration&&context.agent_configuration.snapshot.policy?.securityPolicy.autonomous_send!==true;
}
export function turnAllowsEmailAccount(context:ToolContext,accountId:string,operation:'read'|'draft'|'send'):boolean{
 const frozen=context.agent_configuration;if(!frozen)return true;
 if(frozen.organizationId!==context.organization_id||frozen.agentId!==context.agent_id)return false;
 const role=frozen.snapshot.channels.email.find(row=>row.accountId===accountId)?.role;
 return operation==='read'?role==='primary'||role==='read_only':operation==='draft'?role==='primary':role==='primary'||role==='send_only';
}
export function turnAllowsWhatsAppAccount(context:ToolContext,accountId:string):boolean{
 const frozen=context.agent_configuration;if(!frozen)return true;
 return frozen.organizationId===context.organization_id&&frozen.agentId===context.agent_id&&!!accountId&&frozen.snapshot.channels.whatsappAccountId===accountId;
}
