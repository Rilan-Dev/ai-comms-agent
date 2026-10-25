import type {AgentEmailAccountRole,AgentStatus} from './domain';

export const AGENT_AI_CONFIGURATION_COLUMNS={
 chatProvider:'chat_provider',chatModel:'chat_model',voiceChatProvider:'voice_chat_provider',voiceChatTtsModel:'voice_chat_tts_model',voiceChatSttModel:'voice_chat_stt_model',voiceChatVoiceId:'voice_chat_voice_id',
 realtimeVoiceProviderOverride:'realtime_voice_provider_override',realtimeSttModel:'realtime_stt_model',realtimeTtsModel:'realtime_tts_model',realtimeVoiceIdOverride:'realtime_voice_id_override',
 embeddingProvider:'embedding_provider',embeddingModel:'embedding_model',embeddingDimension:'embedding_dimension',systemPromptOverride:'system_prompt_override',temperatureOverride:'temperature_override',maxTokensOverride:'max_tokens_override',
} as const;
export const AGENT_AI_CONFIGURATION_FIELDS=Object.keys(AGENT_AI_CONFIGURATION_COLUMNS) as Array<keyof typeof AGENT_AI_CONFIGURATION_COLUMNS>;
export const LEGACY_AGENT_CONFIGURATION_FIELDS=['voice_provider','voice_model','voice_id',...Object.values(AGENT_AI_CONFIGURATION_COLUMNS)] as const;
type NumberField='embeddingDimension'|'temperatureOverride'|'maxTokensOverride';
export type AgentAiConfiguration={ -readonly [K in keyof typeof AGENT_AI_CONFIGURATION_COLUMNS]:K extends NumberField?number|null:string|null };
export type AgentConfigurationSnapshotV1={
 schemaVersion:1;
 lifecycle:{status:AgentStatus};
 identity:{name:string;slug:string;description:string|null};
 policy:{allowedTools:string[];allowedSenders:string[];blockedSenders:string[];securityPolicy:Record<string,unknown>;rateLimits:Record<string,unknown>}|null;
 channels:{email:Array<{accountId:string;role:AgentEmailAccountRole}>;whatsappAccountId:string|null};
 ai:AgentAiConfiguration|null;
 legacy:{agent:Record<string,unknown>;ai:{providerConfigId:string|null;modelOverrides:Record<string,unknown>;featureFlags:Record<string,unknown>}|null;version:{sourceId:string|null;config:Record<string,unknown>;voiceProvider:string|null;voiceModel:string|null;voiceId:string|null}};
 dependencies:{fingerprint:string;revocationGeneration:number};
};
export type ConfigurationDiff=Array<{path:string[];before:unknown;after:unknown}>;
type JsonObject=Record<string,unknown>;
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const numeric=new Set(['embeddingDimension','temperatureOverride','maxTokensOverride']);
const secretKey=/^(?:password|passphrase|secret|client[_-]?secret|api[_-]?key|access[_-]?token|refresh[_-]?token|token|authorization|credentials?)$/i;
const reusableCredential=/^(?:EAA[A-Za-z0-9]{40,}|sk-[A-Za-z0-9_-]{20,}|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;
function object(value:unknown):value is JsonObject{return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function keys(value:unknown,expected:readonly string[],label:string):asserts value is JsonObject{
 if(!object(value)||Object.keys(value).length!==expected.length||expected.some(key=>!Object.hasOwn(value,key)))throw Error(`Incomplete or invalid ${label} configuration`);
}
function nullableString(value:unknown):boolean{return value===null||typeof value==='string';}
function protectedMarker(value:unknown):value is {kind:'protectedCurrentValue';path:string[]}{return object(value)&&value.kind==='protectedCurrentValue'&&Array.isArray(value.path)&&value.path.every(part=>typeof part==='string')&&Object.keys(value).length===2;}
function protectedAt(value:unknown,path:string[]):boolean{return protectedMarker(value)&&JSON.stringify(value.path)===JSON.stringify(path);}
function secret(value:unknown,key:string):boolean{return value!==null&&value!==''&&typeof value!=='boolean'&&(secretKey.test(key)||(typeof value==='string'&&reusableCredential.test(value)));}

/** Generic JSON editors do not become credential editors. Capture uses opaque
 * current-resource references; candidate edits cannot supply reusable secrets.
 * No historical protected reference contains the original credential value. */
function safeJson(value:unknown,path:string[],capture:boolean,seen=new Set<object>()):unknown{
 if(path.length>64)throw Error('Configuration nesting is too deep');
 if(protectedMarker(value)){
  if(!protectedAt(value,path))throw Error('Invalid protected configuration reference');
  return {kind:'protectedCurrentValue',path:[...path]};
 }
 if(secret(value,path.at(-1)??'')){
  if(!capture)throw Error('Use the secure editor for protected values');
  return {kind:'protectedCurrentValue',path:[...path]};
 }
 if(value===null||typeof value==='boolean'||typeof value==='string'||(typeof value==='number'&&Number.isFinite(value)))return value;
 if(typeof value!=='object'||seen.has(value))throw Error('Configuration must contain JSON values');
 seen.add(value);
 let result:unknown;
 if(Array.isArray(value))result=value.map((entry,index)=>safeJson(entry,[...path,String(index)],capture,seen));
 else if(object(value))result=Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,safeJson(entry,[...path,key],capture,seen)]));
 else throw Error('Configuration must contain JSON objects');
 seen.delete(value);return result;
}

export function validateAgentConfigurationSnapshot(input:unknown):AgentConfigurationSnapshotV1{
 keys(input,['schemaVersion','lifecycle','identity','policy','channels','ai','legacy','dependencies'],'agent');
 if(input.schemaVersion!==1)throw Error('Unsupported configuration schema');
 keys(input.lifecycle,['status'],'lifecycle');
 if(typeof input.lifecycle.status!=='string'||!['draft','active','paused','archived'].includes(input.lifecycle.status))throw Error('Invalid lifecycle configuration');
 keys(input.identity,['name','slug','description'],'identity');
 if(typeof input.identity.name!=='string'||!input.identity.name.trim()||input.identity.name.length>120||typeof input.identity.slug!=='string'||input.identity.slug.length>80||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.identity.slug)||!nullableString(input.identity.description)||(typeof input.identity.description==='string'&&input.identity.description.length>500))throw Error('Invalid identity configuration');
 if(input.policy!==null){
  keys(input.policy,['allowedTools','allowedSenders','blockedSenders','securityPolicy','rateLimits'],'policy');
  for(const key of ['allowedTools','allowedSenders','blockedSenders']){const value=input.policy[key];if(!Array.isArray(value)||value.length>100||value.some(entry=>typeof entry!=='string'||!entry.trim()))throw Error('Invalid policy list');}
  for(const key of ['securityPolicy','rateLimits'])if(!object(input.policy[key])||JSON.stringify(input.policy[key]).length>50_000)throw Error('Invalid custom policy');
 }
 keys(input.channels,['email','whatsappAccountId'],'channels');
 if(!Array.isArray(input.channels.email)||input.channels.email.length>100||!nullableString(input.channels.whatsappAccountId)||(input.channels.whatsappAccountId!==null&&!uuid.test(input.channels.whatsappAccountId as string)))throw Error('Invalid channel binding');
 const accounts=new Set<string>();
 for(const binding of input.channels.email){keys(binding,['accountId','role'],'email binding');if(typeof binding.accountId!=='string'||!uuid.test(binding.accountId)||accounts.has(binding.accountId)||typeof binding.role!=='string'||!['primary','read_only','send_only'].includes(binding.role))throw Error('Invalid or duplicate email binding');accounts.add(binding.accountId);}
 if(input.ai!==null){keys(input.ai,AGENT_AI_CONFIGURATION_FIELDS,'AI');for(const key of AGENT_AI_CONFIGURATION_FIELDS){const value=input.ai[key];if(value!==null&&(numeric.has(key)?typeof value!=='number'||!Number.isFinite(value):typeof value!=='string'))throw Error('Invalid AI configuration');}}
 keys(input.legacy,['agent','ai','version'],'legacy');keys(input.legacy.agent,LEGACY_AGENT_CONFIGURATION_FIELDS,'legacy agent');
 for(const value of Object.values(input.legacy.agent))if(value!==null&&typeof value!=='string'&&typeof value!=='number')throw Error('Invalid legacy agent setting');
 if(input.legacy.ai!==null){keys(input.legacy.ai,['providerConfigId','modelOverrides','featureFlags'],'legacy AI');if((input.legacy.ai.providerConfigId!==null&&(typeof input.legacy.ai.providerConfigId!=='string'||!uuid.test(input.legacy.ai.providerConfigId)))||!object(input.legacy.ai.modelOverrides)||!object(input.legacy.ai.featureFlags))throw Error('Invalid legacy AI setting');}
 keys(input.legacy.version,['sourceId','config','voiceProvider','voiceModel','voiceId'],'legacy version');
 const legacyVersion=input.legacy.version;
 if((legacyVersion.sourceId!==null&&(typeof legacyVersion.sourceId!=='string'||!uuid.test(legacyVersion.sourceId)))||!object(legacyVersion.config)||JSON.stringify(legacyVersion.config).length>100_000||!['voiceProvider','voiceModel','voiceId'].every(key=>nullableString(legacyVersion[key])))throw Error('Invalid legacy version configuration');
 keys(input.dependencies,['fingerprint','revocationGeneration'],'dependencies');
 if(typeof input.dependencies.fingerprint!=='string'||!/^[0-9a-f]{64}$/.test(input.dependencies.fingerprint)||!Number.isInteger(input.dependencies.revocationGeneration)||Number(input.dependencies.revocationGeneration)<0)throw Error('Invalid configuration dependencies');
 const result=safeJson(input,[],false);
 if(JSON.stringify(result).length>500_000)throw Error('Configuration is too large');
 return result as AgentConfigurationSnapshotV1;
}

export function captureAgentConfigurationSnapshot(input:unknown):AgentConfigurationSnapshotV1{return validateAgentConfigurationSnapshot(safeJson(input,[],true));}

/** Apply hydrates only from CURRENT protected resources. Missing current
 * values stay missing; restoring an old revision never resurrects a secret. */
export function restoreProtectedConfigurationValues(snapshot:AgentConfigurationSnapshotV1,current:AgentConfigurationSnapshotV1):AgentConfigurationSnapshotV1{
 validateAgentConfigurationSnapshot(snapshot);
 function visit(value:unknown,now:unknown):unknown{
  if(protectedMarker(value))return now;
  if(Array.isArray(value))return value.map((entry,index)=>visit(entry,Array.isArray(now)?now[index]:undefined));
  if(object(value))return Object.fromEntries(Object.entries(value).map(([key,entry])=>[key,visit(entry,object(now)&&Object.hasOwn(now,key)?now[key]:undefined)]).filter(([,entry])=>entry!==undefined));
  return value;
 }
 const restored=visit(snapshot,current) as AgentConfigurationSnapshotV1;
 function keepCurrentProtected(value:unknown,path:string[]){
  if(secret(value,path.at(-1)??'')&&!protectedMarker(value)){
   let parent:unknown=restored;
   for(const part of path.slice(0,-1)){
    if(!parent||typeof parent!=='object'||!Object.hasOwn(parent,part))throw Error('Protected current settings cannot be removed by restoring history. Use the secure editor.');
    parent=(parent as JsonObject)[part];
   }
   if(!parent||typeof parent!=='object')throw Error('Protected current settings must remain in secure configuration.');
   Object.defineProperty(parent,path.at(-1)!,{value,writable:true,enumerable:true,configurable:true});return;
  }
  if(Array.isArray(value))value.forEach((entry,index)=>keepCurrentProtected(entry,[...path,String(index)]));
  else if(object(value))for(const [key,entry] of Object.entries(value))keepCurrentProtected(entry,[...path,key]);
 }
 keepCurrentProtected(current,[]);
 return restored;
}

function stable(value:unknown):string{
 if(Array.isArray(value))return '['+value.map(stable).join(',')+']';
 if(object(value))return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable(value[key])).join(',')+'}';
 return JSON.stringify(value)??'undefined';
}
export function diffAgentConfiguration(before:AgentConfigurationSnapshotV1,after:AgentConfigurationSnapshotV1):ConfigurationDiff{
 const safeBefore=captureAgentConfigurationSnapshot(before),safeAfter=captureAgentConfigurationSnapshot(after);const changes:ConfigurationDiff=[];
 function visit(left:unknown,right:unknown,path:string[]){
  const setLike=path.join('.')==='policy.allowedTools'||path.join('.')==='channels.email';
  if(setLike&&Array.isArray(left)&&Array.isArray(right)&&stable([...new Set(left.map(stable))].sort())===stable([...new Set(right.map(stable))].sort()))return;
  if(stable(left)===stable(right))return;
  if(object(left)&&object(right)&&!protectedMarker(left)&&!protectedMarker(right)){for(const key of [...new Set([...Object.keys(left),...Object.keys(right)])].sort())visit(left[key],right[key],[...path,key]);return;}
  changes.push({path,before:left??null,after:right??null});
 }
 for(const key of ['lifecycle','identity','policy','channels','ai','legacy'] as const)visit(safeBefore[key],safeAfter[key],[key]);
 return changes;
}
