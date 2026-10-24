import { query } from "@ai-comms-agent/db";
import { claraRuntime } from "@ai-comms-agent/clara-core";
import type { AgentExecutionDispatchResult, AgentExecutionRequest } from "@ai-comms-agent/shared";
import { executeProductActions } from "./product-action-executor";

function buildPrompt(request:AgentExecutionRequest){
  const params=JSON.stringify(request.params);
  return [
    "Execute this tenant-bound agent task using the available Clara knowledge context.",
    "Intent: "+request.intent,
    "Parameters: "+params,
    "Do not claim that an external side effect occurred unless the host execution tool explicitly confirms it.",
  ].join("\n");
}

export async function dispatchAgentExecution(request:AgentExecutionRequest):Promise<AgentExecutionDispatchResult>{
  const configured = await query<{ knowledge_base_id: string }>("SELECT knowledge_base_id FROM organization_ai_runtime_settings WHERE organization_id=$1", [request.organizationId]);
  const kbId=configured.rows[0]?.knowledge_base_id?.trim() || process.env.CLARA_KB_ID?.trim();
  const customerReply=request.source==='whatsapp' && request.intent==='whatsapp.inbound_command';
  if(!kbId && !customerReply) return {status:"configuration_required",executionId:request.executionId,reason:"CLARA_KB_ID is not configured"};
  const turn=customerReply
    ? await claraRuntime.createCustomerReplyTurn({orgId:request.organizationId,agentId:request.agentId,kbId:kbId??''},typeof request.params.message==='string'?request.params.message:'')
    : await claraRuntime.createChatTurn({
    orgId:request.organizationId,
    agentId:request.agentId,
    kbId:kbId??'',
    userId:null,
    sessionId:request.executionId,
    surface:"chat",
    ragMode:"hybrid",
    messages:[{role:"user",content:buildPrompt(request)}],
  });
  let output=""; for await(const chunk of turn.stream) output+=chunk;
  const actions=await executeProductActions({ organizationId:request.organizationId, agentId:request.agentId, executionId:request.executionId, output }, request.params);
  const blocked=actions.find((action)=>action.status==="configuration_required");
  if(blocked) return {status:"configuration_required",executionId:request.executionId,reason:String(blocked.reason ?? "Product action requires configuration"),actions};
  return {status:"completed",executionId:request.executionId,output,provider:turn.providerName,model:turn.model,actions};
}
