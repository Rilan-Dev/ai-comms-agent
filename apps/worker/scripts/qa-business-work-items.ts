/**
 * Operator-only QA: real DB-backed event execution for synthetic business
 * messages. This never sends any email/WhatsApp. All created work items are
 * removed after verification, while the archived rule and run audit remains.
 */
import {query,changeBusinessWorkItem,closePostgresPool} from "@ai-comms-agent/db";
import {evaluateAutomationEvent} from "../src/automation/automation-engine";
if(process.env.ACA_QA_BUSINESS_ITEMS!=="explicitly-authorized")throw Error("QA authorization required");
const marker="qa-business-work-items-20261031-e2";
const r=await query<{id:string;org:string}>("SELECT id::text,organization_id::text AS org FROM agents WHERE name='Sarvam AI' AND status='active' LIMIT 1");
const agent=r.rows[0];if(!agent)throw Error("Active Sarvam AI agent unavailable");
const owner=await query<{id:string;role:string}>(
 "SELECT user_id::text AS id,role::text FROM organization_memberships WHERE organization_id=$1 AND status='active' AND role IN ('owner','admin') ORDER BY CASE role WHEN 'owner' THEN 0 ELSE 1 END LIMIT 1",[agent.org]);
if(!owner.rows[0])throw Error("No owner/admin to review the test item");
const reviewer=owner.rows[0]!.id;
const cases=[
 {kind:"opportunity" as const,type:"email.action_required" as const,subject:"[QA] CCTV quotation requested",text:"Please send a quotation for 24 CCTV cameras.",contact:"qa-sales@example.invalid"},
 {kind:"service_ticket" as const,type:"whatsapp.received" as const,subject:"[QA] Access reader urgent support",text:"The entrance access reader is down; please check Site B.",contact:"qa-contact"}
];
for(const [idx,testCase] of cases.entries()){
 const key=marker+"-"+idx;
 const name="[QA] Business record "+testCase.kind+" 20261031";
 const existing=await query("SELECT id FROM automation_rules WHERE organization_id=$1 AND name=$2",[agent.org,name]);
 if(existing.rows.length)throw Error("QA rule already exists. Refusing duplicate.");
 const inserted=await query<{id:string}>(
  "INSERT INTO automation_rules(organization_id,agent_id,name,trigger,conditions,actions,status) VALUES($1,$2,$3,$4::jsonb,'{}'::jsonb,$5::jsonb,'active') RETURNING id::text",
  [agent.org,agent.id,name,JSON.stringify({event:testCase.type,match:{qaToken:key}}),
   JSON.stringify([{type:"generate_summary"},{type:"create_work_item",kind:testCase.kind,priority:"high"}])]
 );
 const ruleId=inserted.rows[0]!.id;
 const event={organizationId:agent.org,type:testCase.type,payload:{
  eventId:key,messageId:key,qaToken:key,eventType:testCase.type,
  ...(testCase.type==="whatsapp.received"?{accountId:"qa-fixture",body:testCase.text,contactId:testCase.contact}:
   {emailAccountId:"qa-fixture",subject:testCase.subject,from:testCase.contact,snippet:testCase.text,actionRequired:true})
 }};
 try{
  const run=await evaluateAutomationEvent(event);
  const result=await query<{id:string;status:string;result:Record<string,unknown>|null;error:string|null}>(
   "SELECT id::text,status,result,error FROM automation_runs WHERE automation_rule_id=$1 ORDER BY triggered_at DESC LIMIT 1",[ruleId]);
  const row=result.rows[0];
  const work=await query<{id:string;status:string;review_status:string;assigned_user_id:string|null}>(
   "SELECT id::text,status,review_status,assigned_user_id::text FROM business_work_items WHERE organization_id=$1 AND kind=$2 AND source_event_key=$3",[agent.org,testCase.kind,key]);
  const item=work.rows[0];
  if(!item||row?.status!=="completed")throw Error("Automation did not create "+testCase.kind+": "+JSON.stringify({run,row,work:work.rows}));
  const duplicate=await evaluateAutomationEvent(event);
  const count=await query<{n:number}>("SELECT count(*)::int AS n FROM business_work_items WHERE organization_id=$1 AND kind=$2 AND source_event_key=$3",[agent.org,testCase.kind,key]);
  if(count.rows[0]?.n!==1)throw Error("Idempotency violation");
  const denied=await changeBusinessWorkItem({organizationId:agent.org,id:item.id,actorId:"00000000-0000-4000-8000-000000000001",reviewStatus:"approved"});
  if(denied!==null)throw Error("Outsider was able to approve work item");
  const premature=await changeBusinessWorkItem({organizationId:agent.org,id:item.id,actorId:reviewer,status:"completed"});
  if(premature!==null)throw Error("Completion bypassed manager review");
  const assigned=await changeBusinessWorkItem({organizationId:agent.org,id:item.id,actorId:reviewer,assignedUserId:reviewer,status:"in_progress"});
  const approved=await changeBusinessWorkItem({organizationId:agent.org,id:item.id,actorId:reviewer,reviewStatus:"approved"});
  const completed=await changeBusinessWorkItem({organizationId:agent.org,id:item.id,actorId:reviewer,status:"completed"});
  if(!assigned||!approved||!completed||completed.status!=="completed")throw Error("Assignment/review/close failed");
  console.log(JSON.stringify({kind:testCase.kind,source:"SYNTHETIC_QA_not_provider_delivery",automatedRunStatus:row.status,
    resultProvider:row.result?.provider??null,workItemPersisted:true,workItemId:item.id,
    duplicateCount:count.rows[0].n,duplicateRunFailed:duplicate.failed,
    externalReviewDenied:denied===null,prematureCloseDenied:premature===null,
    assigned:true,reviewed:true,completed:true,noOutboundSend:true}));
  await query("DELETE FROM business_work_items WHERE organization_id=$1 AND id=$2 AND source_event_key=$3",[agent.org,item.id,key]);
  console.log("QA_ITEM_REMOVED "+testCase.kind);
 }finally{
  await query("UPDATE automation_rules SET status='archived',updated_at=now() WHERE organization_id=$1 AND id=$2 AND status='active'",[agent.org,ruleId]);
 }
}
await closePostgresPool();
