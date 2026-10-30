import { query } from "@ai-comms-agent/db";
import { agentRuntime } from "@ai-comms-agent/agent-core";
import type { AgentExecutionDispatchResult, AgentExecutionRequest } from "@ai-comms-agent/shared";
import { executeProductActions } from "./product-action-executor";
import {prepareAgentConfigurationTurn} from '@ai-comms-agent/email-agent-runtime';
import {sourceSummaryFallback,summaryOnlyAutomation,recoverableSummaryProviderError} from "../automation/source-summary-fallback";

function buildPrompt(request:AgentExecutionRequest){
  const params=JSON.stringify(request.params);
  return [
    "Execute this tenant-bound agent task using the available knowledge context.",
    "Intent: "+request.intent,
    "Parameters: "+params,
    "Do not claim that an external side effect occurred unless the host execution tool explicitly confirms it.",
  ].join("\n");
}

export async function dispatchAgentExecution(request:AgentExecutionRequest):Promise<AgentExecutionDispatchResult>{
  const configured = await query<{ knowledge_base_id: string }>("SELECT knowledge_base_id FROM organization_ai_runtime_settings WHERE organization_id=$1", [request.organizationId]);
  const kbId=configured.rows[0]?.knowledge_base_id?.trim() || process.env.AGENT_KB_ID?.trim();
  const customerReply=request.source==='whatsapp' && request.intent==='whatsapp.inbound_command';
  if(!kbId && !customerReply) return {status:"configuration_required",executionId:request.executionId,reason:"AGENT_KB_ID is not configured"};
  const configurationTurn=process.env.AGENT_CONFIGURATION_REVISIONS_ENABLED==='true'
    ?await prepareAgentConfigurationTurn({orgId:request.organizationId,agentId:request.agentId,kbId:kbId??'',skipGrounding:customerReply}):undefined;
  let output="";
  let modelProvider="";
  let modelName="";
  const sourceFallback=(reason:"empty"|"provider_error")=>{
    const recap=sourceSummaryFallback({source:request.source,intent:request.intent,params:request.params},reason);
    return recap?{status:"completed" as const,executionId:request.executionId,output:recap,provider:"source-only-fallback",model:"none",actions:[{type:"generate_summary",status:"completed" as const}]}:null;
  };
  try {
    const turn=customerReply
      ? await agentRuntime.createCustomerReplyTurn(configurationTurn?.agentContext??{orgId:request.organizationId,agentId:request.agentId,kbId:kbId??''},typeof request.params.message==='string'?request.params.message:'')
      : await agentRuntime.createChatTurn({
        orgId:request.organizationId,agentId:request.agentId,kbId:kbId??'',
        userId:null,sessionId:request.executionId,surface:"chat",ragMode:"hybrid",
        messages:[{role:"user",content:buildPrompt(request)}],
      },configurationTurn?.agentContext);
    modelProvider=turn.providerName;
    modelName=turn.model;
    for await(const chunk of turn.stream)output+=chunk;
  }catch(error){
    if(summaryOnlyAutomation({source:request.source,intent:request.intent,params:request.params})&&recoverableSummaryProviderError(error)){
      const fallback=sourceFallback("provider_error");
      if(fallback)return fallback;
    }
    throw error;
  }
  if(!output.trim()){
    const fallback=sourceFallback("empty");
    if(fallback)return fallback;
  }
  const actions=await executeProductActions({ organizationId:request.organizationId, agentId:request.agentId, executionId:request.executionId, output,...(configurationTurn?{configuration:configurationTurn.configuration}:{}) }, request.params);
  // Provider action failures must never be stored as successful event runs.
  const blocked=actions.find((action)=>action.status==="configuration_required"||action.status==="failed"||action.status==="unsupported");
  if(blocked) return {status:"configuration_required",executionId:request.executionId,reason:String(blocked.reason ?? "Product action failed or requires configuration"),actions};
  return {status:"completed",executionId:request.executionId,output,provider:modelProvider,model:modelName,actions};
}
