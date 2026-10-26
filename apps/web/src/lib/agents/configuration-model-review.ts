import {AGENT_AI_CONFIGURATION_FIELDS,type AgentAiConfiguration} from '@ai-comms-agent/shared';

type Field=keyof AgentAiConfiguration;
type Purpose='chat'|'tts'|'stt'|'realtime'|'embedding';
type Check={value:string|number|null;status:'verified'|'custom_accepted'};
export type ConfigurationModelReviewDependencies={
 defaults:Partial<AgentAiConfiguration>;
 catalog:(provider:string,purpose:Purpose)=>Promise<{available:boolean;source:'live'|'documented'|'unavailable';models:readonly string[]}>;
};
const groups:ReadonlyArray<{provider:Field;models:ReadonlyArray<{field:Field;purpose:Purpose}>;extra?:Field}>= [
 {provider:'chatProvider',models:[{field:'chatModel',purpose:'chat'}]},
 {provider:'voiceChatProvider',models:[{field:'voiceChatTtsModel',purpose:'tts'},{field:'voiceChatSttModel',purpose:'stt'}]},
 {provider:'realtimeVoiceProviderOverride',models:[{field:'realtimeSttModel',purpose:'realtime'},{field:'realtimeTtsModel',purpose:'tts'}]},
 {provider:'embeddingProvider',models:[{field:'embeddingModel',purpose:'embedding'}],extra:'embeddingDimension'},
];

/** Build server-owned checks from provider results. A browser may acknowledge
 * a custom choice, never declare a provider result verified. Existing custom
 * values are not replaced just because a catalog no longer advertises them. */
export async function reviewConfigurationModels(before:AgentAiConfiguration|null,after:AgentAiConfiguration|null,acceptedCustomFields:readonly string[],dependencies:ConfigurationModelReviewDependencies):Promise<Partial<Record<Field,Check>>>{
 if(!Array.isArray(acceptedCustomFields)||acceptedCustomFields.length>AGENT_AI_CONFIGURATION_FIELDS.length||acceptedCustomFields.some(key=>!AGENT_AI_CONFIGURATION_FIELDS.includes(key as Field)))throw Error('Invalid custom model acknowledgement');
 const checks:Partial<Record<Field,Check>>={};
 const changed=(field:Field)=>(before?.[field]??null)!==(after?.[field]??null);
 const effective=(field:Field)=>after?.[field]??dependencies.defaults[field]??null;
 const cached=new Map<string,ReturnType<ConfigurationModelReviewDependencies['catalog']>>();
 for(const group of groups){
  const fields=[group.provider,...group.models.map(row=>row.field),...(group.extra?[group.extra]:[])];
  const edited=fields.filter(changed);if(!edited.length)continue;
  const provider=effective(group.provider);if(typeof provider!=='string'||!provider)throw Error('Choose an available provider before reviewing this change.');
  let groupStatus:Check['status']='verified';
  for(const model of group.models){
   if(!changed(group.provider)&&!changed(model.field)&&!(group.extra&&changed(group.extra)))continue;
   const key=provider+':'+model.purpose;
   if(!cached.has(key))cached.set(key,dependencies.catalog(provider,model.purpose));
   const catalog=await cached.get(key)!;
   if(!catalog.available)throw Error('Configure and enable the provider for this capability before reviewing the change.');
   const modelId=effective(model.field);
   const verified=catalog.source==='live'&&(modelId===null||(typeof modelId==='string'&&catalog.models.includes(modelId)));
   if(!verified){
    // A provider change can expose an unchanged model to a different API.
    // Confirm that provider choice or that exact model rather than inheriting
    // the old provider's model availability.
    if(!acceptedCustomFields.includes(model.field)&&!acceptedCustomFields.includes(group.provider))throw Error('Review and confirm this custom or documented model choice; provider availability has not been verified.');
    groupStatus='custom_accepted';
   }
   if(changed(model.field))checks[model.field]={value:after?.[model.field]??null,status:verified?'verified':'custom_accepted'};
  }
  for(const field of edited)if(!checks[field])checks[field]={value:after?.[field]??null,status:groupStatus};
 }
 return checks;
}
