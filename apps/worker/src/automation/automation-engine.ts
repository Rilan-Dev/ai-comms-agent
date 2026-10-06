import { completeAutomationRun, createAutomationRun, failAutomationRun, listActiveAutomationRules } from "@ai-comms-agent/db";
import { dispatchAgentExecution } from "../agent/execution-dispatcher";

type Event={type:string;payload:Record<string,unknown>};
type Rule={id:string;agentId:string;organizationId:string;trigger:Record<string,unknown>;conditions:Record<string,unknown>;actions:unknown[]};

function objectEqualsSubset(payload:Record<string,unknown>, expected:Record<string,unknown>){
  return Object.entries(expected).every(([key,value])=>payload[key]===value);
}

export function automationMatches(rule:Pick<Rule,"trigger"|"conditions">,event:Event){
  const triggerType=typeof rule.trigger.type==="string"?rule.trigger.type:null;
  if(!triggerType||triggerType!==event.type) return false;
  const match=rule.trigger.match;
  if(match && typeof match==="object" && !Array.isArray(match) && !objectEqualsSubset(event.payload,match as Record<string,unknown>)) return false;
  return !rule.conditions || Object.keys(rule.conditions).length===0 || objectEqualsSubset(event.payload,rule.conditions);
}

export async function evaluateAutomationEvent(event:Event){
  if(!process.env.DATABASE_URL) return {matched:0,started:0,failed:0};
  const rules=await listActiveAutomationRules(); let matched=0,started=0,failed=0;
  for(const rule of rules as unknown as Rule[]){
    if(!automationMatches(rule,event)) continue;
    matched++;
    const runId=await createAutomationRun(rule.id,{eventType:event.type}); if(!runId){failed++;continue;}
    try{
      const result=await dispatchAgentExecution({executionId:runId,organizationId:rule.organizationId,agentId:rule.agentId,source:"automation",intent:"automation.execute",params:{actions:rule.actions,event:event.payload},requestedAt:new Date().toISOString()});
      if(result.status==="configuration_required") await failAutomationRun(runId,result.reason); else await completeAutomationRun(runId,{status:result.status,executionId:result.executionId});
      started++;
    }catch(error){ await failAutomationRun(runId,error instanceof Error?error.message:"Automation execution failed"); failed++; }
  }
  return {matched,started,failed};
}
