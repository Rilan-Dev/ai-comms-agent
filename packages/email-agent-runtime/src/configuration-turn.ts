import {loadActiveAgentConfiguration,type ActiveAgentConfiguration} from '@ai-comms-agent/db';
import {agentRuntime,type AgentRuntimeContext} from '@ai-comms-agent/agent-core';
import type {AgentAiConfiguration} from '@ai-comms-agent/shared';

export type AgentConfigurationTurn={configuration:ActiveAgentConfiguration;agentContext:AgentRuntimeContext};
type Dependencies={
 load:typeof loadActiveAgentConfiguration;
 prepare:(context:AgentRuntimeContext,settings:AgentAiConfiguration|null)=>Promise<AgentRuntimeContext>;
};
export class AgentConfigurationTurnChangedError extends Error{
 readonly code='configuration_changed';constructor(){super('Configuration changed during setup. Start a new turn with the current saved settings.');}
}
function available(configuration:ActiveAgentConfiguration,context:AgentRuntimeContext){
 return configuration.organizationId===context.orgId&&configuration.agentId===context.agentId&&configuration.snapshot.lifecycle.status==='active';
}

/** Establish a consistent revision/defaults cut before executing tools. AI
 * preparation only resolves the existing server configuration, not a model
 * request. No SQL lock spans model/provider work. A racing apply/default edit
 * gets one bounded retry; repeated change fails without executing anything. */
export async function prepareAgentConfigurationTurn(context:AgentRuntimeContext,dependencies:Dependencies={load:loadActiveAgentConfiguration,prepare:agentRuntime.prepareTurn}):Promise<AgentConfigurationTurn>{
 if(!context.orgId||!context.agentId)throw Error('An organization and agent are required for a configuration turn.');
 const scope={organizationId:context.orgId,agentId:context.agentId};
 for(let attempt=0;attempt<2;attempt++){
  const before=await dependencies.load(scope);
  if(!available(before,context))throw Error('This agent is unavailable. Review its current deployment before starting a turn.');
  const agentContext=await dependencies.prepare(context,before.snapshot.ai);
  const after=await dependencies.load(scope);
  if(available(after,context)&&before.revisionId===after.revisionId&&before.revocationGeneration===after.revocationGeneration&&before.dependencyFingerprint===after.dependencyFingerprint)return {configuration:before,agentContext};
 }
 throw new AgentConfigurationTurnChangedError();
}
