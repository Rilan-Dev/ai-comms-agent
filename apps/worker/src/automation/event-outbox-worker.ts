import {query,withTransaction,recoverStaleAutomationRuns,recordAuditEvent} from "@ai-comms-agent/db";
import {evaluateAutomationEvent,stableEventKey} from "./automation-engine";
type Outbox={id:string;organization_id:string;event_type:string;payload:Record<string,unknown>;attempts:number};
// Scan provider records independently of slow LLM executions.
// At most two event executions overlap, each with a separate leased outbox row.
let activeExecutions=0;
const MAX_CONCURRENT_EXECUTIONS=2;
let scanning=false;
const activeEventIds=new Set<string>();
async function scanProviderEvents(){
 if(scanning)return;
 scanning=true;
 try{await enqueueRecentEmailAutomationEvents();}finally{scanning=false;}
}
// Only recently received messages from an established incremental sync, after
// the rule existed. Durable source-row deduplication survives worker restarts.
export async function enqueueRecentEmailAutomationEvents(limit=50):Promise<number>{
 let total=0;
 for(const type of ["email.received","email.action_required"] as const){
  const sql=[
   "INSERT INTO automation_event_outbox(organization_id,event_type,source_key,payload)",
   "SELECT m.organization_id,$1,m.id::text,",
   "jsonb_build_object('eventId',m.id::text,'messageId',m.id::text,'emailAccountId',m.email_account_id::text,'from',m.from_email::text,'subject',m.subject,'snippet',left(coalesce(m.snippet,''),1200),'actionRequired',m.action_required,'receivedAt',m.received_at)",
   "FROM email_messages m JOIN email_sync_states s ON s.email_account_id=m.email_account_id AND s.organization_id=m.organization_id",
   "WHERE m.is_draft=false AND m.is_sent=false AND m.created_at>=now()-interval '48 hours'",
   "AND m.received_at>=now()-interval '48 hours' AND s.last_success_at IS NOT NULL AND s.sync_mode='incremental'",
   "AND ($1::text='email.received' OR m.action_required=true)",
   "AND EXISTS(SELECT 1 FROM automation_rules a WHERE a.organization_id=m.organization_id AND a.status='active' AND a.created_at<=m.created_at AND COALESCE(a.trigger->>'event',a.trigger->>'type')=$1)",
   "AND NOT EXISTS(SELECT 1 FROM automation_event_outbox o WHERE o.organization_id=m.organization_id AND o.event_type=$1 AND o.source_key=m.id::text)",
   "ORDER BY m.created_at ASC LIMIT $2",
   "ON CONFLICT(organization_id,event_type,source_key) DO NOTHING RETURNING id"
  ].join(" ");
  const r=await query<{id:string}>(sql,[type,limit]);total+=r.rows.length;
 }

 const inboundSql=[
  "INSERT INTO automation_event_outbox(organization_id,event_type,source_key,payload)",
  "SELECT DISTINCT ON (m.organization_id,m.whatsapp_account_id,split_part(m.provider_message_id,':',1))",
  "m.organization_id,'whatsapp.received',m.whatsapp_account_id::text || ':' || split_part(m.provider_message_id,':',1),",
  "jsonb_build_object('eventId',m.whatsapp_account_id::text || ':' || split_part(m.provider_message_id,':',1),'messageId',m.whatsapp_account_id::text || ':' || split_part(m.provider_message_id,':',1),'accountId',m.whatsapp_account_id::text,'contactId',m.contact_id::text,'body',left(coalesce(m.body,''),2000),'messageType',m.message_type)",
  "FROM whatsapp_messages m",
  "WHERE m.direction='inbound' AND m.created_at>=now()-interval '48 hours' AND m.provider_message_id IS NOT NULL",
  "AND EXISTS (SELECT 1 FROM automation_rules a WHERE a.organization_id=m.organization_id AND a.status='active' AND a.created_at<=m.created_at AND COALESCE(a.trigger->>'event',a.trigger->>'type')='whatsapp.received')",
  "ORDER BY m.organization_id,m.whatsapp_account_id,split_part(m.provider_message_id,':',1),m.created_at LIMIT $1",
  "ON CONFLICT(organization_id,event_type,source_key) DO NOTHING RETURNING id",
 ].join(" ");
 const inbound=await query<{id:string}>(inboundSql,[limit]);
 total+=inbound.rows.length;
 return total;
}
/** A worker may crash after claiming a provider event. Never silently
 * re-execute an uncertain downstream side effect or mark it completed.
 * Reconcile both the outbox and any running rule records in one transaction.
 */
export async function recoverInterruptedAutomationEvents():Promise<number>{
 const stale=await withTransaction(async client=>{
  const r=await client.query<Outbox>(
   "UPDATE automation_event_outbox SET status='failed',completed_at=now(),last_error='Execution lease expired; downstream outcome uncertain. Inspect approval and run history before any retry.' WHERE status='processing' AND claimed_at<now()-interval '20 minutes' AND NOT (id=ANY($1::uuid[])) RETURNING id,organization_id,event_type,payload,attempts",
   [[...activeEventIds]]
  );
  for(const event of r.rows){
   const eventKey=stableEventKey({organizationId:event.organization_id,type:event.event_type,payload:event.payload});
   if(eventKey)await client.query(
    "UPDATE automation_runs run SET status='failed',finished_at=now(),error='Event worker lease expired; outcome unknown, verify before retrying.',result=COALESCE(run.result,'{}'::jsonb) || '{\"manualVerificationRequired\":true,\"downstreamOutcomeUnknown\":true,\"recoveredStaleExecution\":true}'::jsonb FROM automation_rules rule WHERE rule.id=run.automation_rule_id AND rule.organization_id=$1 AND run.trigger_event_key=$2 AND run.status='running'",
    [event.organization_id,eventKey]
   );
  }
  return r.rows.length;
 });
 return stale;
}
export async function processAutomationEventOutbox(limit=1):Promise<{claimed:number;completed:number;failed:number}>{
 // Ingestion runs on every tick, even if all execution slots are busy.
 await scanProviderEvents();
 await recoverInterruptedAutomationEvents();
 if(activeExecutions>=MAX_CONCURRENT_EXECUTIONS)return {claimed:0,completed:0,failed:0};
 activeExecutions++;
 try{
  // A crash can leave an automation run "running" indefinitely, while a
  // duplicate unique event cannot be reinserted. Mark its outcome unknown,
  // preserve its original idempotency key, and require manual reconciliation.
  const abandoned=await recoverStaleAutomationRuns();
  for(const run of abandoned){
    try{
      await recordAuditEvent({
        organizationId:run.organization_id,actorUserId:null,
        eventType:"automation.execution.interrupted",targetType:"automation_run",
        targetId:run.id,action:"recover",decision:"denied",correlationId:run.id,
        metadata:{ruleId:run.automation_rule_id,downstreamOutcomeUnknown:true,manualVerificationRequired:true},
      });
    }catch(error){
      console.error("[automation] recovered run audit needs reconciliation",{
        runId:run.id,errorType:error instanceof Error?error.name:"unknown",
      });
    }
  }
  const events=await withTransaction(async client=>{
   const r=await client.query<Outbox>(
    "SELECT id,organization_id,event_type,payload,attempts FROM automation_event_outbox WHERE status='queued' AND next_attempt_at<=now() ORDER BY created_at ASC LIMIT $1 FOR UPDATE SKIP LOCKED",[Math.min(limit,1)]);
   for(const row of r.rows)await client.query("UPDATE automation_event_outbox SET status='processing',claimed_at=now(),attempts=attempts+1 WHERE id=$1",[row.id]);
   return r.rows;
  });
  let completed=0,failed=0;
  for(const event of events){
   activeEventIds.add(event.id);
   const heartbeat=setInterval(()=>{
    void query("UPDATE automation_event_outbox SET claimed_at=now() WHERE id=$1 AND status='processing'",[event.id]).catch(()=>{});
   },60_000);
   try{
    const result=await evaluateAutomationEvent({organizationId:event.organization_id,type:event.event_type,payload:event.payload});
    if(result.failed>0){
     // A failed downstream rule is not a successfully completed automation.
     // The run is already idempotently recorded, so retain terminal failure
     // rather than retrying potentially irreversible provider actions.
     await query("UPDATE automation_event_outbox SET status='failed',completed_at=now(),last_error=$2 WHERE id=$1 AND status='processing'",[event.id,"Matching automation execution failed for "+result.failed+" rule(s). Review run history before retrying."]);
     console.error("[automation] event failed",{outboxId:event.id,failedRules:result.failed});
     failed++;
    }else{
     await query("UPDATE automation_event_outbox SET status='completed',completed_at=now(),last_error=NULL WHERE id=$1 AND status='processing'",[event.id]);
     completed++;
    }
   }catch(e){
    const message=e instanceof Error?e.message:"Automation event evaluation failed";
    await query("UPDATE automation_event_outbox SET status=CASE WHEN attempts>=3 THEN 'failed' ELSE 'queued' END,next_attempt_at=now()+interval '2 minutes',last_error=$2 WHERE id=$1 AND status='processing'",[event.id,message.slice(0,500)]);
    failed++;
   }finally{
    clearInterval(heartbeat);
    activeEventIds.delete(event.id);
   }
  }
  return {claimed:events.length,completed,failed};
 }finally{activeExecutions--;}
}
