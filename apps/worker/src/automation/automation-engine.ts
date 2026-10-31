import { completeAutomationRun, createAutomationRun, getAutomationRunStatus, failAutomationRun, listActiveAutomationRules } from "@ai-comms-agent/db";
import { dispatchAgentExecution } from "../agent/execution-dispatcher";

type Event={organizationId:string;type:string;payload:Record<string,unknown>};
type Rule={id:string;agentId:string;organizationId:string;trigger:Record<string,unknown>;conditions:Record<string,unknown>;actions:unknown[]};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function objectEqualsSubset(payload:Record<string,unknown>, expected:Record<string,unknown>){
  return Object.entries(expected).every(([key,value])=>payload[key]===value);
}

/** A trigger can use the legacy worker "type" key or the web UI "event" key. */
export function automationMatches(rule:Pick<Rule,"organizationId"|"trigger"|"conditions">,event:Event){
  // A bad JSON rule must never become a match-all rule. An event payload
  // must also be an object before any policy filters are evaluated.
  if(!event.organizationId || rule.organizationId!==event.organizationId ||
     !isRecord(rule.trigger) || !isRecord(event.payload)) return false;
  const {type, event: legacyEvent} = rule.trigger;
  if(typeof type==="string" && typeof legacyEvent==="string" && type!==legacyEvent) return false;
  const triggerType=typeof type==="string"?type:typeof legacyEvent==="string"?legacyEvent:null;
  if(!triggerType||triggerType!==event.type) return false;
  const match=rule.trigger.match;
  // Missing/null filters are historically optional. Present filters must
  // be objects, not strings, lists or numbers that silently match all.
  if(match!=null && (!isRecord(match) || !objectEqualsSubset(event.payload,match))) return false;
  const conditions=rule.conditions;
  return conditions==null || (isRecord(conditions) && objectEqualsSubset(event.payload,conditions));
}

export function stableEventKey(event:Event){
  // Provider outcome events have trusted source-row identities. Generic eventId
  // and messageId metadata must not override those identities or suppress
  // unrelated actions through the automation_runs uniqueness constraint.
  const candidate = event.type.startsWith("email.action.")
    ? event.payload.actionId
    : event.type.startsWith("whatsapp.message.")
      ? event.payload.messageId
      : event.payload.eventId ?? event.payload.messageId ?? event.payload.actionId ?? event.payload.correlationId;
  return typeof candidate === "string" && candidate.trim() ? event.type + ":" + candidate.trim() : null;
}

export async function evaluateAutomationEvent(event:Event){
  // Fail closed rather than trusting event.payload.organizationId or performing
  // a global rule lookup when the authenticated source identity is missing.
  if(typeof event.organizationId!=="string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(event.organizationId)){
    throw new Error("A trusted automation event organization ID is required");
  }
  if(!process.env.DATABASE_URL) return {matched:0,started:0,failed:0};
  const rules=await listActiveAutomationRules(event.organizationId); let matched=0,started=0,failed=0;
  for(const rule of rules as unknown as Rule[]){
    if(!automationMatches(rule,event)) continue;
    matched++;
    const eventKey=stableEventKey(event);
    const runId=await createAutomationRun(rule.id,rule.organizationId,{eventType:event.type,eventKey},eventKey);
    if(!runId){
      // An existing attempt may have sent an email or WhatsApp before a crash.
      // Completed duplicates are idempotent; pending/failed/unknown outcomes
      // must remain failed and visible, not falsely turn the outbox green.
      const previous=eventKey?await getAutomationRunStatus(rule.id,eventKey):null;
      if(previous!=="completed")failed++;
      continue;
    }
    try{
      const result=await dispatchAgentExecution({executionId:runId,organizationId:rule.organizationId,agentId:rule.agentId,source:"automation",intent:"automation.execute",params:{actions:rule.actions,event:{...event.payload,eventType:event.type}},requestedAt:new Date().toISOString()});
      if(result.status==="configuration_required"){
        await failAutomationRun(runId,result.reason??"Execution denied");failed++;
      }else{
        const settled=await completeAutomationRun(runId,{status:result.status,executionId:result.executionId,output:result.output??null,provider:result.provider??null,model:result.model??null,actions:result.actions??[]});
        if(settled)started++;else failed++; // Recovered or externally settled while executing.
      }
    }catch(error){ await failAutomationRun(runId,error instanceof Error?error.message:"Automation execution failed"); failed++; }
  }
  return {matched,started,failed};
}
