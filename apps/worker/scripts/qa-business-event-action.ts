/** Business acceptance: controlled event → real bound Gmail → AI → unsent reply draft.
 * Only reuses an internal QA message delivered between connected accounts.
 * No customer communication and no provider send. Archives QA rule in finally.
 */
import {query} from "@ai-comms-agent/db";
import {evaluateAutomationEvent} from "../src/automation/automation-engine";
const marker="qa-business-approval-action-20261031-b1";
const subject="Action Required: Please approve QA email QA_ACCEPTANCE_20261031_C2";
const ruleName="[QA] Business approval draft 20261031";
if(process.env.ACA_QA_EVENT_DRAFT!=="explicitly-authorized")throw Error("Explicit QA gate required.");
const rows=await query<{id:string;organization_id:string;email_account_id:string;from_email:string;subject:string;thread_id:string;agent_id:string}>(
 ["SELECT m.id::text,m.organization_id::text,m.email_account_id::text,m.from_email::text,m.subject,m.thread_id::text,ag.id::text AS agent_id",
 "FROM email_messages m JOIN email_accounts a ON a.id=m.email_account_id JOIN agent_email_accounts bound ON bound.email_account_id=a.id",
 "JOIN agents ag ON ag.id=bound.agent_id AND ag.organization_id=a.organization_id AND ag.status='active'",
 "WHERE a.provider='gmail' AND a.status='connected' AND m.is_draft=false AND m.is_sent=false AND m.subject=$1",
 "ORDER BY m.created_at DESC LIMIT 1"].join(" "),[subject]);
const m=rows.rows[0];
if(!m)throw Error("Internal Gmail QA source not found; test not run.");
const existing=await query<{id:string}>("SELECT id::text FROM automation_rules WHERE organization_id=$1 AND name=$2 LIMIT 1",[m.organization_id,ruleName]);
if(existing.rows.length)throw Error("QA event rule already exists; refusing duplicate.");
const active=await query<{n:number}>(
 "SELECT count(*)::int AS n FROM automation_rules WHERE organization_id=$1 AND status='active' AND coalesce(trigger->>'event',trigger->>'type')='email.action_required'",[m.organization_id]);
if((active.rows[0]?.n??0)!==0)throw Error("Other active action-required rules exist. Do not replay a synthetic event into customer automation.");
const inserted=await query<{id:string}>(
 "INSERT INTO automation_rules(organization_id,agent_id,name,trigger,conditions,actions,status,created_by) VALUES($1,$2,$3,$4::jsonb,'{}'::jsonb,$5::jsonb,'active',NULL) RETURNING id::text",
 [m.organization_id,m.agent_id,ruleName,JSON.stringify({event:"email.action_required",match:{qaToken:marker}}),
 JSON.stringify([{type:"create_draft",emailAccountId:m.email_account_id,subject:"[QA] Event-generated approval reply 20261031"}])]);
const rule=inserted.rows[0];
if(!rule)throw Error("QA rule insertion failed");
try{
 const response=await evaluateAutomationEvent({
  organizationId:m.organization_id,type:"email.action_required",
  payload:{qaToken:marker,eventId:marker,messageId:m.id,emailAccountId:m.email_account_id,from:m.from_email,subject:m.subject,
   actionRequired:true,snippet:"Internal action-required approval request; generate a short acknowledgment for review, do not approve and do not send."}
 });
 const runs=await query<{status:string;error:string|null;result:Record<string,unknown>|null}>(
  "SELECT status,error,result FROM automation_runs WHERE organization_id=$1 AND automation_rule_id=$2 ORDER BY triggered_at DESC LIMIT 1",[m.organization_id,rule.id]);
 const run=runs.rows[0];
 const actions=Array.isArray(run?.result?.actions)?run.result.actions as Array<{actionId?:string;type?:string;status?:string}>:[];
 const draftId=actions.find(a=>a.type==="create_draft"&&a.status==="completed")?.actionId;
 let draft:null|{id:string;thread_id:string;is_sent:boolean;is_draft:boolean;provider_draft_sync_status:string}=null;
 if(draftId){
  const d=await query<typeof draft & object>("SELECT id::text,thread_id::text,is_sent,is_draft,provider_draft_sync_status FROM email_messages WHERE organization_id=$1 AND id=$2",[m.organization_id,draftId]);
  draft=d.rows[0]??null;
 }
 const verified=Boolean(run?.status==="completed"&&draft&&!draft.is_sent&&draft.is_draft&&draft.thread_id===m.thread_id);
 console.log(JSON.stringify({test:"event_to_actual_draft",eventIsSynthetic:true,sourceIsRealInternalProviderMail:true,
  ruleMatched:response.matched,ruleStarted:response.started,ruleFailed:response.failed,
  runStatus:run?.status??"none",failureReason:run?.error?.slice(0,170)??null,
  draftSaved:Boolean(draft),originalThreadPreserved:draft?.thread_id===m.thread_id,
  draftIsUnsent:draft?.is_sent===false,verified}));
 if(draft?.id && verified){
  const clean=await query<{id:string}>(
   "DELETE FROM email_messages WHERE id=$1 AND organization_id=$2 AND is_draft=true AND is_sent=false AND provider_draft_sync_status IN ('queued','local_only') RETURNING id::text",
   [draft.id,m.organization_id]);
  console.log(JSON.stringify({temporaryDraftRemoved:clean.rows.length===1,providerReviewNeeded:clean.rows.length===0}));
 }
 if(!verified)process.exitCode=2;
}finally{
 await query("UPDATE automation_rules SET status='archived',updated_at=now() WHERE organization_id=$1 AND id=$2 AND status='active'",[m.organization_id,rule.id]);
 console.log("QA_RULE_ARCHIVED=true");
}
