/**
 * Explicit controlled QA for a real previously received intra-organization
 * Gmail message. No email or WhatsApp send is performed.
 */
import {query} from "@ai-comms-agent/db";
import {executeProductActions} from "../src/agent/product-action-executor";
const subject="Action Required: Please approve QA email QA_ACCEPTANCE_20261031_C2";
const qaSubject="[QA] Business workflow reply draft 2026-10-31";
if(process.env.ACA_QA_BUSINESS_DRAFT!=="explicitly-authorized")throw Error("QA mode authorization required");
const messages=await query<{
 id:string;organization_id:string;email_account_id:string;subject:string;
 from_email:string;thread_id:string;agent_id:string
}>([
 "SELECT m.id::text,m.organization_id::text,m.email_account_id::text,m.subject,m.from_email::text,",
 "m.thread_id::text,ag.id::text AS agent_id",
 "FROM email_messages m JOIN email_accounts ea ON ea.id=m.email_account_id",
 "JOIN agent_email_accounts bind ON bind.email_account_id=m.email_account_id",
 "JOIN agents ag ON ag.id=bind.agent_id AND ag.organization_id=ea.organization_id AND ag.status='active'",
 "WHERE ea.provider='gmail' AND ea.status='connected' AND m.subject=$1 AND m.is_draft=false AND m.is_sent=false",
 "ORDER BY m.created_at DESC LIMIT 1"
].join(" "),[subject]);
const m=messages.rows[0];
if(!m)throw Error("Intra-organization Gmail source unavailable; no draft created.");
const existing=await query<{id:string}>("SELECT id::text FROM email_messages WHERE email_account_id=$1 AND subject=$2",[m.email_account_id,qaSubject]);
if(existing.rows.length)throw Error("QA draft already present. Refusing duplicate.");
const denied=await executeProductActions({
 organizationId:m.organization_id,agentId:m.agent_id,executionId:"qa-deny-20261031",
 output:"No send: validation only.",
},{actions:[{type:"create_draft",emailAccountId:"00000000-0000-4000-8000-000000000001",to:"foo@example.invalid"}],
event:{emailAccountId:"00000000-0000-4000-8000-000000000001",from:"foo@example.invalid"}});
if(denied[0]?.status!=="configuration_required")throw Error("Unbound mailbox was not rejected.");
const result=await executeProductActions({
 organizationId:m.organization_id,agentId:m.agent_id,executionId:"qa-business-draft-20261031",
 output:"Thank you for sending the revised bill of quantities. We have received it and will review the details. We have NOT approved the revision; a manager will confirm the decision after verification. Internal acceptance test; do not send.",
},{actions:[{type:"create_draft",emailAccountId:m.email_account_id,subject:qaSubject}],
event:{emailAccountId:m.email_account_id,from:m.from_email,subject:m.subject,messageId:m.id}});
if(result.length!==1||result[0]?.status!=="completed"||!result[0]?.actionId){
 console.log(JSON.stringify({test:"real_incoming_email_reply_draft",result,unboundMailboxRejected:true}));
 throw Error("Draft executor did not create a verified draft.");
}
const draftId=result[0].actionId;
const rows=await query<{
 id:string;is_draft:boolean;is_sent:boolean;thread_id:string;to_recipients:unknown;provider_draft_sync_status:string;in_reply_to:string|null
}>("SELECT id::text,is_draft,is_sent,thread_id::text,to_recipients,provider_draft_sync_status,in_reply_to FROM email_messages WHERE id=$1 AND organization_id=$2",[draftId,m.organization_id]);
const d=rows.rows[0];
const recipients=Array.isArray(d?.to_recipients)?d.to_recipients:[];
const rightRecipient=recipients.some((x:unknown)=>typeof x==="string"&&x.toLowerCase()===m.from_email.toLowerCase());
const verified=Boolean(d&&d.is_draft===true&&d.is_sent===false&&d.thread_id===m.thread_id&&rightRecipient);
console.log(JSON.stringify({test:"real_incoming_email_reply_draft",unboundMailboxRejected:true,appDraftSaved:Boolean(d),sourceThreadMatched:d?.thread_id===m.thread_id,originalSenderIsRecipient:rightRecipient,isDraft:d?.is_draft,isSent:d?.is_sent,draftSyncStatus:d?.provider_draft_sync_status,verified}));
if(!verified)throw Error("Draft exists but recipient/threading or not-sent verification failed.");
const cleanup=await query<{id:string}>(
 "DELETE FROM email_messages WHERE id=$1 AND organization_id=$2 AND is_draft=true AND is_sent=false AND provider_draft_sync_status IN ('queued','local_only') RETURNING id::text",
 [draftId,m.organization_id]);
console.log(JSON.stringify({qaDraftCleanedBeforeProviderSync:cleanup.rows.length===1,retainedForReview:cleanup.rows.length!==1}));
