import type { AgentExecutionDispatchResult, AgentExecutionRequest } from "@ai-comms-agent/shared";

/**
 * Single worker-owned handoff for scheduled/automation execution.
 * Provider execution must never happen in the browser/API process.
 * The concrete Clara-backed agent runtime is wired in the agent-runtime phase;
 * until then, unsupported intents fail truthfully instead of being fabricated.
 */
export async function dispatchAgentExecution(request:AgentExecutionRequest):Promise<AgentExecutionDispatchResult>{
  const enabled=process.env.AGENT_EXECUTION_ENABLED==="true";
  if(!enabled) return {status:"configuration_required",executionId:request.executionId,reason:"Agent execution runtime is not configured"};
  return {status:"configuration_required",executionId:request.executionId,reason:"Agent execution runtime adapter is not implemented for this intent"};
}
