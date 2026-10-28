type Scope={organizationId:string;agentId:string;permissions:ReadonlySet<string>};
type CountQuery=(sql:string,params:string[])=>Promise<{rows:Array<{count:string|number}>}>;
function count(row:{count:string|number}|undefined){if(!row)return null;const value=Number(row.count);return Number.isSafeInteger(value)&&value>=0?value:null;}

/** Unknown or unauthorized counts remain null rather than being presented as zero. */
export async function getAgentOperationalSummary(scope:Scope,query:CountQuery){
 const result:{emailApprovals:number|null;whatsappApprovals:number|null}={emailApprovals:null,whatsappApprovals:null};
 if(scope.permissions.has('organization.update')){
  const response=await query(`SELECT count(*) AS count FROM email_actions WHERE organization_id=$1 AND agent_id=$2 AND status='pending_approval' AND (expires_at IS NULL OR expires_at>now())`,[scope.organizationId,scope.agentId]);
  result.emailApprovals=count(response.rows[0]);
 }
 if(scope.permissions.has('whatsapp.read')){
  const response=await query(`SELECT count(*) AS count FROM whatsapp_send_actions WHERE organization_id=$1 AND agent_id=$2 AND status='pending' AND queued_message_id IS NULL AND expires_at>now()`,[scope.organizationId,scope.agentId]);
  result.whatsappApprovals=count(response.rows[0]);
 }
 return result;
}
