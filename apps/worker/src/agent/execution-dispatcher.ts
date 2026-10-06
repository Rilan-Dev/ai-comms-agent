import { claraRuntime } from "@ai-comms-agent/clara-core";
import type { AgentExecutionDispatchResult, AgentExecutionRequest } from "@ai-comms-agent/shared";

function buildPrompt(request:AgentExecutionRequest){
  const params=JSON.stringify(request.params);
  return [
    "Execute this scheduled/automation task using the available tenant-bound Clara knowledge context.",
    "Intent: "+request.intent,
    "Parameters: "+params,
    "Do not claim that an external side effect occurred unless the host execution tool explicitly confirms it.",
  ].join("\n");
}

export async function dispatchAgentExecution(request:AgentExecutionRequest):Promise<AgentExecutionDispatchResult>{
  const kbId=process.env.CLARA_KB_ID?.trim();
  if(!kbId) return {status:"configuration_required",executionId:request.executionId,reason:"CLARA_KB_ID is not configured"};
  const turn=await claraRuntime.createChatTurn({
    orgId:request.organizationId,
    agentId:request.agentId,
    kbId,
    userId:null,
    sessionId:request.executionId,
    surface:"chat",
    ragMode:"hybrid",
    messages:[{role:"user",content:buildPrompt(request)}],
  });
  let output=""; for await(const chunk of turn.stream) output+=chunk;
  return {status:"completed",executionId:request.executionId,output,provider:turn.providerName,model:turn.model};
}
