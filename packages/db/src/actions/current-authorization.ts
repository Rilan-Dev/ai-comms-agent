import {asOrganizationId,asUserId} from '@ai-comms-agent/shared';
import {query} from '../client';
import {PostgresIdentityRepository} from '../identity/supabase';

export class ActionAuthorizationRevokedError extends Error {
 constructor(){super('Action authorization is no longer valid');this.name='ActionAuthorizationRevokedError';}
}
const denied=()=>new ActionAuthorizationRevokedError();
async function actor(organizationId:string,userId:string|null,permission:string){
 if(!userId)throw denied();
 const identities=new PostgresIdentityRepository();
 const membership=await identities.getMembership(asOrganizationId(organizationId),asUserId(userId));
 if(!membership||membership.status!=='active')throw denied();
 const permissions=await identities.getPermissionsForRole(asOrganizationId(organizationId),membership.role);
 if(!permissions.includes(permission as typeof permissions[number]))throw denied();
}

async function agent(organizationId:string,agentId:string|null,accountId:string,tool:string,channel:'email'|'whatsapp',required=false){
 // Manual actions carry no agent. The persisted action, never a browser flag,
 // determines whether agent authorization is required.
 if(!agentId){if(required)throw denied();return;}
 const binding=channel==='email'
  ? await query<{role:string}>(`SELECT b.role FROM agent_email_accounts b JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1 WHERE b.agent_id=$2 AND b.email_account_id=$3`,[organizationId,agentId,accountId])
  : await query<{role:string}>(`SELECT 'primary' AS role FROM agent_whatsapp_accounts b JOIN agents a ON a.id=b.agent_id AND a.organization_id=$1 WHERE b.agent_id=$2 AND b.whatsapp_account_id=$3`,[organizationId,agentId,accountId]);
 if(!binding.rows.some(row=>row.role==='primary'||row.role==='send_only'))throw denied();
 const policy=await query<{allowed_tools:string[]}>(`SELECT p.allowed_tools FROM agent_policies p JOIN agents a ON a.id=p.agent_id WHERE a.organization_id=$1 AND a.id=$2`,[organizationId,agentId]);
 const tools=policy.rows[0]?.allowed_tools;
 if(!Array.isArray(tools)||!tools.includes(tool))throw denied();
}

export async function assertCurrentEmailActionAuthorization(action:{organizationId:string;emailAccountId:string;agentId:string|null;actionType:string;requestedBy:string|null;approvedBy:string|null}){
 await actor(action.organizationId,action.requestedBy,'email.write');
 await actor(action.organizationId,action.approvedBy,'organization.update');
 const account=await query(`SELECT id FROM email_accounts WHERE id=$1 AND organization_id=$2 AND status='connected' AND deleted_at IS NULL`,[action.emailAccountId,action.organizationId]);
 if(!account.rows.length)throw denied();
 const tool=({send_email:'email.send.request',reply_email:'email.reply.request',forward_email:'email.forward.request'} as Record<string,string>)[action.actionType];
 if(!tool)throw denied();
 await agent(action.organizationId,action.agentId,action.emailAccountId,tool,'email');
}

export async function assertCurrentWhatsAppActionAuthorization(action:{organizationId:string;accountId:string;agentId:string|null;bindingRequired:boolean;requestedBy:string|null;approvedBy:string|null}){
 await actor(action.organizationId,action.requestedBy,'whatsapp.send');
 await actor(action.organizationId,action.approvedBy,'whatsapp.send');
 await agent(action.organizationId,action.agentId,action.accountId,'whatsapp.send','whatsapp',action.bindingRequired);
}
