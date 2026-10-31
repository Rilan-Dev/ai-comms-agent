import type {AgentConfigurationSnapshotV1} from '@ai-comms-agent/shared';

export type ConfigurationTarget={organizationId:string;agentId:string};
export type ConfigurationFormContext={activeRevisionId:string;draftRevisionId:string|null};
export type ConfigurationFormPatch={identity?:Partial<AgentConfigurationSnapshotV1['identity']>;policy?:AgentConfigurationSnapshotV1['policy'];channels?:AgentConfigurationSnapshotV1['channels'];ai?:Partial<NonNullable<AgentConfigurationSnapshotV1['ai']>>;lifecycle?:AgentConfigurationSnapshotV1['lifecycle'];legacyVersion?:AgentConfigurationSnapshotV1['legacy']['version']};
export class ConfigurationEditorError extends Error{
 constructor(message:string,readonly status:number,readonly code:string,readonly reason?:string,readonly fields:string[]=[]){super(message);}
}
export function configurationEditorUrl(target:ConfigurationTarget){return `/api/agents/${encodeURIComponent(target.agentId)}/configuration?organizationId=${encodeURIComponent(target.organizationId)}`;}
export async function sendConfigurationCommand(target:ConfigurationTarget,command:Record<string,unknown>,fetcher:typeof fetch=fetch){
 const response=await fetcher(configurationEditorUrl(target),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(command)});
 const result=await response.json().catch(()=>null);
 if(!response.ok)throw new ConfigurationEditorError(typeof result?.message==='string'?result.message:'The change could not be confirmed. Your choices remain in this form.',response.status,typeof result?.error==='string'?result.error:'configuration_unavailable',typeof result?.reason==='string'?result.reason:undefined,Array.isArray(result?.fields)?result.fields.filter((field:unknown):field is string=>typeof field==='string'):[]);
 return result;
}
export function saveConfigurationForm(target:ConfigurationTarget,context:ConfigurationFormContext|null,patch:ConfigurationFormPatch,fetcher:typeof fetch=fetch){
 if(!context)return Promise.reject(new ConfigurationEditorError('Wait for the saved configuration to load before saving this draft.',409,'configuration_not_loaded'));
 return sendConfigurationCommand(target,{command:'save',context,patch},fetcher);
}
export function restoreConfigurationForm(target:ConfigurationTarget,context:ConfigurationFormContext|null,revisionId:string,fetcher:typeof fetch=fetch){
 if(!context)return Promise.reject(new ConfigurationEditorError('Load the saved configuration before restoring.',409,'configuration_not_loaded'));
 if(context.draftRevisionId)return Promise.reject(new ConfigurationEditorError('Finish or discard your current draft before restoring.',409,'draft_exists'));
 return sendConfigurationCommand(target,{command:'restore',revisionId,activeRevisionId:context.activeRevisionId},fetcher);
}
export function discardConfigurationForm(target:ConfigurationTarget,context:ConfigurationFormContext|null,fetcher:typeof fetch=fetch){
 if(!context?.draftRevisionId)return Promise.reject(new ConfigurationEditorError('There is no saved draft to discard.',409,'draft_not_found'));
 return sendConfigurationCommand(target,{command:'discard',context},fetcher);
}
