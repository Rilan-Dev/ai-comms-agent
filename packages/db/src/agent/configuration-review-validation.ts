import type {AgentConfigurationSnapshotV1,AgentAiConfiguration} from '@ai-comms-agent/shared';
import {requestedRevokedAccess,type ConfigurationDenials} from './configuration-denials';

export type ConfigurationModelCheck={value:string|number|null;status:'verified'|'custom_accepted';provider?:string;model?:string};
export type ConfigurationReviewValidation={schemaVersion:1;acknowledgedRevocations:string[];modelChecks:Partial<Record<keyof AgentAiConfiguration,ConfigurationModelCheck>>};
export type ConfigurationReviewOptions={validation?:ConfigurationReviewValidation;expectedDependencyFingerprint?:string};
const modelFields:ReadonlyArray<keyof AgentAiConfiguration>=['chatProvider','chatModel','voiceChatProvider','voiceChatTtsModel','voiceChatSttModel','realtimeVoiceProviderOverride','realtimeSttModel','realtimeTtsModel','embeddingProvider','embeddingModel','embeddingDimension'];
export function changedConfigurationModelFields(before:AgentConfigurationSnapshotV1,after:AgentConfigurationSnapshotV1):Array<keyof AgentAiConfiguration>{return modelFields.filter(field=>(before.ai?.[field]??null)!==(after.ai?.[field]??null));}

/** Network/catalog checks happen before the review transaction, in the
 * authorized host adapter. Only its bounded matching attestation is stored;
 * apply rechecks this receipt and its current dependency fingerprint. */
export function assertConfigurationReviewValidation(before:AgentConfigurationSnapshotV1,after:AgentConfigurationSnapshotV1,barrier:ConfigurationDenials,options:ConfigurationReviewOptions):ConfigurationReviewValidation{
 const validation=options.validation??{schemaVersion:1,acknowledgedRevocations:[],modelChecks:{}};
 if(validation.schemaVersion!==1||!Array.isArray(validation.acknowledgedRevocations)||validation.acknowledgedRevocations.length>300||validation.acknowledgedRevocations.some(value=>typeof value!=='string'||value.length>200)||!validation.modelChecks||typeof validation.modelChecks!=='object'||Array.isArray(validation.modelChecks))throw Error('Invalid configuration review context');
 const revoked=requestedRevokedAccess(after,barrier);
 if(revoked.some(key=>!validation.acknowledgedRevocations.includes(key)))throw Error('This would restore revoked access. Review and explicitly confirm those permissions again.');
 for(const field of changedConfigurationModelFields(before,after)){
  const check=validation.modelChecks[field];
  if(!check||!['verified','custom_accepted'].includes(check.status)||check.value!==(after.ai?.[field]??null)||!options.expectedDependencyFingerprint)throw Error('Review the changed AI model and provider settings before applying them.');
 }
 for(const field of ['temperatureOverride','maxTokensOverride','embeddingDimension'] as const){
  const value=after.ai?.[field]??null;if(value===(before.ai?.[field]??null)||value===null)continue;
  if(field==='temperatureOverride'?(value<0||value>2):(!Number.isInteger(value)||value<1||value>(field==='embeddingDimension'?4096:32768)))throw Error('An edited AI numeric setting is outside the supported range.');
 }
 const providers={chatProvider:['openai','gemini','sarvam'],voiceChatProvider:['openai','gemini','sarvam','elevenlabs'],realtimeVoiceProviderOverride:['openai','gemini','sarvam','elevenlabs'],embeddingProvider:['openai','gemini','tei']} as const;
 for(const field of Object.keys(providers) as Array<keyof typeof providers>){const value=after.ai?.[field]??null;if(value!==(before.ai?.[field]??null)&&value!==null&&!(providers[field] as readonly string[]).includes(value))throw Error('The selected AI model provider is unsupported.');}
 // Strip extra input fields; none may become an accidental credential store.
 return {schemaVersion:1,acknowledgedRevocations:[...new Set(validation.acknowledgedRevocations)].sort(),modelChecks:Object.fromEntries(changedConfigurationModelFields(before,after).map(field=>{const check=validation.modelChecks[field]!;return [field,{value:check.value,status:check.status,...(typeof check.provider==='string'?{provider:check.provider.slice(0,100)}:{}),...(typeof check.model==='string'?{model:check.model.slice(0,1000)}:{})}];}))};
}
