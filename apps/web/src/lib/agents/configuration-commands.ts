import {applyAgentConfigurationRevision,discardAgentConfigurationDraft,getAgentConfigurationEditor,getAgentConfigurationHistory,getDecryptedProviderConfig,getOrgAiRuntimeSettings,restoreAgentConfigurationRevision,reviewAgentConfigurationRevision,revokeAgentAccessNow,saveAgentConfigurationPatch,type AgentConfigurationDraftContext,type AgentConfigurationRevision,type AgentConfigurationScope} from '@ai-comms-agent/db';
import {ForbiddenError,asOrganizationId,diffAgentConfiguration,type AuthSubject,type ConfigurationDiff} from '@ai-comms-agent/shared';
import {authorize} from '@/lib/identity/authorization';
import {getIdentityAdapter,getIdentityRepository} from '@/lib/identity/repository';
import {documentedRealtimeModels,documentedSarvamVoiceModels,fetchLiveModelCatalog,hasDocumentedRealtimeModels,hasDocumentedSarvamVoiceModels,supportsLiveCatalog,type LiveModelPurpose} from '@/lib/ai/live-model-catalog';
import {reviewConfigurationModels,type ConfigurationModelReviewDependencies} from './configuration-model-review';

type Target={organizationId:string;agentId:string};
type RecordValue=Record<string,unknown>;
export class ConfigurationCommandInputError extends Error{readonly code='invalid_configuration_command';constructor(){super('Invalid configuration command input. Reload the saved settings and try again.');}}
function record(value:unknown):value is RecordValue{return !!value&&typeof value==='object'&&!Array.isArray(value);}
function inputError():never{throw new ConfigurationCommandInputError();}
function text(value:unknown):string{if(typeof value!=='string'||!value.trim()||value.length>200)inputError();return value;}
function context(value:unknown):AgentConfigurationDraftContext{
 if(!record(value)||Object.keys(value).some(key=>!['activeRevisionId','draftRevisionId'].includes(key))||value.draftRevisionId!==null&&typeof value.draftRevisionId!=='string')inputError();
 return {activeRevisionId:text(value.activeRevisionId),draftRevisionId:value.draftRevisionId===null?null:text(value.draftRevisionId)};
}
function strings(value:unknown):string[]{if(value===undefined)return [];if(!Array.isArray(value)||value.length>300||value.some(entry=>typeof entry!=='string'||entry.length>200))inputError();return value;}
async function subjectFor(request:Request,target:Target){return authorize(request,{organizationId:asOrganizationId(target.organizationId),role:'admin'},getIdentityAdapter(),getIdentityRepository());}
function assertOwner(subject:AuthSubject){if(subject.membership?.role!=='owner')throw new ForbiddenError('insufficient_role','An organization owner must review and apply this deployment.');}
function assertFields(subject:AuthSubject,diff:ConfigurationDiff){
 for(const change of diff){
  if(change.path[0]==='lifecycle')assertOwner(subject);
  if((change.path[0]==='ai'||change.path[0]==='legacy'&&change.path[1]!=='version')&&!subject.permissions.has('organization.update'))throw new ForbiddenError('missing_permission','Organization-update permission is required for AI settings.');
 }
}
function visibleRevision(revision:AgentConfigurationRevision,includeAi:boolean){
 if(includeAi)return revision;
 const {ai:_ai,legacy,...visible}=revision.snapshot;void _ai;
 return {...revision,snapshot:{...visible,legacy:{version:legacy.version}}};
}

export async function getAgentConfigurationView(request:Request,target:Target){
 const subject=await subjectFor(request,target),scope={...target,userId:subject.user.id};
 const state=await getAgentConfigurationEditor(scope),includeAi=subject.permissions.has('organization.update');
 const history=await getAgentConfigurationHistory(scope,{policy:true,ai:includeAi,legacy:includeAi});
 return {active:visibleRevision(state.active,includeAi),draft:state.draft?visibleRevision(state.draft,includeAi):null,dependencyFingerprint:state.dependencyFingerprint,revocationGeneration:state.revocationGeneration,requiredRevocations:state.requiredRevocations,history,canApply:subject.membership?.role==='owner',canEditAi:includeAi};
}

async function modelChecks(scope:AgentConfigurationScope,before:AgentConfigurationRevision,after:AgentConfigurationRevision,acceptedCustomFields:string[]){
 const settings=await getOrgAiRuntimeSettings(scope.organizationId);
 const defaults:ConfigurationModelReviewDependencies['defaults']={chatProvider:settings?.defaultProvider??process.env.AI_PROVIDER??'openai',voiceChatProvider:settings?.voiceChatProvider??settings?.realtimeVoiceProvider??'openai',voiceChatTtsModel:settings?.voiceChatTtsModel??null,voiceChatSttModel:settings?.voiceChatSttModel??null,realtimeVoiceProviderOverride:settings?.realtimeVoiceProvider??'openai',realtimeSttModel:settings?.realtimeSttModel??null,realtimeTtsModel:settings?.realtimeTtsModel??null,embeddingProvider:settings?.embeddingProvider??'openai',embeddingModel:settings?.embeddingModel??null,embeddingDimension:settings?.embeddingDimension??null};
 const chatChanged=(before.snapshot.ai?.chatProvider??null)!==(after.snapshot.ai?.chatProvider??null)||(before.snapshot.ai?.chatModel??null)!==(after.snapshot.ai?.chatModel??null);
 const configs=new Map<string,Awaited<ReturnType<typeof getDecryptedProviderConfig>>>();
 if(chatChanged){
  const provider=after.snapshot.ai?.chatProvider??defaults.chatProvider!;
  const saved=await getDecryptedProviderConfig(scope.organizationId,String(provider),'chat');configs.set(provider+':chat',saved);defaults.chatModel=saved?.model??null;
 }
 return reviewConfigurationModels(before.snapshot.ai,after.snapshot.ai,acceptedCustomFields,{defaults,catalog:async(provider,purpose)=>{
  const key=provider+':'+purpose;
  const saved=configs.has(key)?configs.get(key):await getDecryptedProviderConfig(scope.organizationId,provider,purpose as LiveModelPurpose);
  if(!saved?.enabled||(!saved.apiKey&&provider!=='tei'))return {available:false,source:'unavailable',models:[]};
  if(hasDocumentedSarvamVoiceModels(provider,purpose))return {available:true,source:'documented',models:documentedSarvamVoiceModels(provider,purpose).map(model=>model.id)};
  if(hasDocumentedRealtimeModels(provider,purpose))return {available:true,source:'documented',models:documentedRealtimeModels(provider,purpose).map(model=>model.id)};
  if(!supportsLiveCatalog(provider,purpose))return {available:true,source:'unavailable',models:[]};
  try{return {available:true,source:'live',models:(await fetchLiveModelCatalog(provider,purpose,saved.apiKey!)).map(model=>model.id)};}
  catch{return {available:true,source:'unavailable',models:[]};}
 }});
}

/** Manual host commands only. No model tool registration, caller actor,
 * provider token, executable script or client-generated validation accepted. */
export async function runAgentConfigurationCommand(request:Request,target:Target,input:unknown){
 const subject=await subjectFor(request,target),scope={...target,userId:subject.user.id};
 if(!record(input))inputError();
 const allowed:Record<string,string[]>={save:['patch','context'],review:['revisionId','acceptedCustomFields','acknowledgedRevocations'],apply:['revisionId','activeRevisionId','reviewId','environment'],restore:['revisionId','activeRevisionId'],revoke:['activeRevisionId','changes'],discard:['context']};
 if(typeof input.command!=='string'||!Object.hasOwn(allowed,input.command)||Object.keys(input).some(key=>key!=='command'&&!allowed[input.command as string]!.includes(key)))inputError();
 switch(input.command){
  case 'save':{
   if(!record(input.patch))inputError();
   // Current DB checks revalidate the complete merged candidate atomically.
   if(Object.hasOwn(input.patch,'ai')&&!subject.permissions.has('organization.update'))throw new ForbiddenError('missing_permission','Organization-update permission is required for AI settings.');
   if(Object.hasOwn(input.patch,'lifecycle'))assertOwner(subject);
   return {draft:visibleRevision(await saveAgentConfigurationPatch(scope,input.patch,context(input.context)),subject.permissions.has('organization.update'))};
  }
  case 'review':{
   const id=text(input.revisionId),state=await getAgentConfigurationEditor(scope,id);
   assertFields(subject,diffAgentConfiguration(state.active.snapshot,state.candidate.snapshot));
   const checks=await modelChecks(scope,state.active,state.candidate,strings(input.acceptedCustomFields));
   return {review:await reviewAgentConfigurationRevision(scope,id,{expectedDependencyFingerprint:state.dependencyFingerprint,validation:{schemaVersion:1,acknowledgedRevocations:strings(input.acknowledgedRevocations),modelChecks:checks}})};
  }
  case 'apply':{
   assertOwner(subject);const environment=input.environment??'production';if(environment!=='production'&&environment!=='preview')inputError();
   return {application:await applyAgentConfigurationRevision(scope,text(input.revisionId),text(input.activeRevisionId),{reviewId:text(input.reviewId),environment})};
  }
  case 'restore':return {draft:visibleRevision(await restoreAgentConfigurationRevision(scope,text(input.revisionId),text(input.activeRevisionId)),subject.permissions.has('organization.update'))};
  case 'revoke':{
   if(!record(input.changes))inputError();if(input.changes.pause!==undefined)assertOwner(subject);
   return {revocation:await revokeAgentAccessNow(scope,input.changes,text(input.activeRevisionId))};
  }
  case 'discard':await discardAgentConfigurationDraft(scope,context(input.context));return {discarded:true};
 }
 return inputError();
}
