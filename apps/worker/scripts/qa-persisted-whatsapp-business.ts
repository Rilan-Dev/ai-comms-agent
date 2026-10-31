/**
 * Read-only provider-source replay into a temporary business rule.
 * Does not forge a Meta webhook, contact customers, or emit outbound actions.
 * The chosen inbound message must have a matching persisted Meta webhook record.
 * All synthetic QA rule/work-item rows are cleaned up in finally.
 */
import {query,changeBusinessWorkItem,closePostgresPool} from "@ai-comms-agent/db";
import {evaluateAutomationEvent} from "../src/automation/automation-engine";
if(process.env.ACA_QA_REAL_SOURCE!=="authorize-no-sends")throw Error("Explicit QA switch required");
type Source={organization_id:string;agent_id:string;account_id:string;provider_id:string;contact_id:string|null;body:string|null;message_type:string};
const selected=await query<Source>([
 "SELECT m.organization_id::text,m.whatsapp_account_id::text AS account_id,",
 "split_part(m.provider_message_id,':',1) AS provider_id,m.contact_id::text,",
 "m.body,m.message_type,a.id::text AS agent_id FROM whatsapp_messages m",
 "JOIN agents a ON a.organization_id=m.organization_id AND a.status='active'",
 "WHERE m.direction='inbound' AND m.provider_message_id IS NOT NULL",
 "AND m.created_at>=now()-interval '48 hours'",
 "AND EXISTS(SELECT 1 FROM whatsapp_webhook_events e",
 "WHERE e.whatsapp_account_id=m.whatsapp_account_id",
 "AND e.payload::text LIKE '%' || split_part(m.provider_message_id,':',1) || '%')",
 "ORDER BY m.created_at DESC LIMIT 1"
].join(" "));
const message=selected.rows[0];
if(!message)throw Error("No recent inbound message with a matching persisted webhook event");
const sourceKey=message.account_id+":"+message.provider_id;
const name="[QA] Persisted webhook source → service ticket 20261031";
let ruleId:string|null=null;
try{
 const owner=await query<{user_id:string}>(
  "SELECT m.user_id::text FROM organization_memberships m JOIN users u ON u.id=m.user_id WHERE m.organization_id=$1 AND m.status='active' AND m.role IN ('owner','admin') AND u.status='active' LIMIT 1",[message.organization_id]);
 const reviewer=owner.rows[0]?.user_id;
 if(!reviewer)throw Error("Active reviewer unavailable");
 const rule=await query<{id:string}>(
  "INSERT INTO automation_rules(organization_id,agent_id,name,trigger,conditions,actions,status) VALUES($1,$2,$3,$4::jsonb,'{}'::jsonb,$5::jsonb,'active') RETURNING id::text",
  [message.organization_id,message.agent_id,name,JSON.stringify({event:"whatsapp.received",match:{eventId:sourceKey}}),
   JSON.stringify([{type:"generate_summary"},{type:"create_work_item",kind:"service_ticket",priority:"normal"}])]
 );
 ruleId=rule.rows[0]?.id??null;
 if(!ruleId)throw Error("Rule not created");
 const event={organizationId:message.organization_id,type:"whatsapp.received",payload:{
  eventId:sourceKey,messageId:sourceKey,accountId:message.account_id,
  contactId:message.contact_id,body:(message.body??"").slice(0,2000),messageType:message.message_type}};
 const once=await evaluateAutomationEvent(event);
 const runs=await query<{status:string;result:Record<string,unknown>|null;error:string|null}>(
  "SELECT status,result,error FROM automation_runs WHERE automation_rule_id=$1 ORDER BY triggered_at DESC LIMIT 1",[ruleId]);
 const run=runs.rows[0];
 const items=await query<{id:string;status:string;review_status:string}>(
  "SELECT id::text,status,review_status FROM business_work_items WHERE organization_id=$1 AND source_event_key=$2 AND kind='service_ticket'",
  [message.organization_id,sourceKey]);
 const item=items.rows[0];
 if(!item||run?.status!=="completed")throw Error("Business action failed: "+JSON.stringify({runStatus:run?.status,reason:run?.error?.slice(0,120),itemCount:items.rows.length,failed:once.failed}));
 const duplicate=await evaluateAutomationEvent(event);
 const count=await query<{n:number}>("SELECT count(*)::integer AS n FROM business_work_items WHERE organization_id=$1 AND source_event_key=$2",[message.organization_id,sourceKey]);
 if(count.rows[0]?.n!==1)throw Error("Duplicate work item found");
 const premature=await changeBusinessWorkItem({organizationId:message.organization_id,id:item.id,actorId:reviewer,status:"completed"});
 if(premature!==null)throw Error("Completion without review was permitted");
 const assigned=await changeBusinessWorkItem({organizationId:message.organization_id,id:item.id,actorId:reviewer,assignedUserId:reviewer,status:"in_progress"});
 const approved=await changeBusinessWorkItem({organizationId:message.organization_id,id:item.id,actorId:reviewer,reviewStatus:"approved"});
 const closed=await changeBusinessWorkItem({organizationId:message.organization_id,id:item.id,actorId:reviewer,status:"completed"});
 if(!assigned||!approved||closed?.status!=="completed")throw Error("Manager lifecycle not completed");
 console.log("WEBHOOK_SOURCE_QA_PASS "+JSON.stringify({
  source:"persisted_actual_meta_webhook_not_new_delivery",ruleStatus:run.status,
  provider:run.result?.provider??"unknown",ticketCreated:true,
  duplicatesPrevented:count.rows[0].n===1,closureGated:true,
  assigned:true,approved:true,completed:true,externalMessagesSent:false,
  rerun:duplicate
 }));
}finally{
 if(ruleId){
  await query("DELETE FROM business_work_items WHERE organization_id=$1 AND source_event_key=$2 AND kind='service_ticket'",[message.organization_id,sourceKey]);
  await query("UPDATE automation_rules SET status='archived' WHERE id=$1 AND organization_id=$2",[ruleId,message.organization_id]);
 }
 await closePostgresPool();
}
