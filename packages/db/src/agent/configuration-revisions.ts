import {createHash} from 'node:crypto';
import type {PoolClient} from 'pg';
import {AGENT_AI_CONFIGURATION_COLUMNS,AGENT_AI_CONFIGURATION_FIELDS,LEGACY_AGENT_CONFIGURATION_FIELDS,captureAgentConfigurationSnapshot,captureAgentConfigurationEdit,validateAgentConfigurationSnapshot,diffAgentConfiguration,type AgentConfigurationSnapshotV1,type AgentAiConfiguration,type ConfigurationDiff} from '@ai-comms-agent/shared';
import {withTransaction} from '../client';
import {lockConfigurationActors,assertConfigurationChangeAuthority} from './configuration-authority';
import {readConfigurationDenials,type ConfigurationDenials} from './configuration-denials';
import {assertConfigurationResources} from './configuration-resources';
import {assertConfigurationReviewValidation,type ConfigurationReviewOptions,type ConfigurationReviewValidation} from './configuration-review-validation';

export type AgentConfigurationScope={organizationId:string;agentId:string;userId:string|null};
type Row=Record<string,unknown>;
export type AgentConfigurationRevision={id:string;organizationId:string;agentId:string;revisionNumber:number;kind:'baseline'|'draft'|'restore'|'legacy_restore'|'revocation';baseRevisionId:string|null;parentDraftId:string|null;restoredFromId:string|null;legacySourceVersionId:string|null;coverage:'complete'|'legacy_partial';snapshot:AgentConfigurationSnapshotV1;createdBy:string|null;createdAt:string};
export type AgentConfigurationReview={id:string;revisionId:string;baseRevisionId:string;dependencyFingerprint:string;snapshotDigest:string;diff:ConfigurationDiff;validation:ConfigurationReviewValidation;createdBy:string|null;createdAt:string;expiresAt:string};
export type ConfigurationHistoryAccess={policy?:boolean;ai?:boolean;legacy?:boolean};
export type ConfigurationHistoryView=Omit<AgentConfigurationRevision,'snapshot'> & {snapshot:Omit<AgentConfigurationSnapshotV1,'policy'|'ai'|'legacy'> & Partial<Pick<AgentConfigurationSnapshotV1,'policy'|'ai'|'legacy'>>;state:'active'|'draft'|'superseded'};
export class AgentConfigurationConflictError extends Error{readonly code='configuration_changed';constructor(){super('Active configuration changed. Reload and review your changes again.');}}
const obj=(value:unknown):Row=>value&&typeof value==='object'&&!Array.isArray(value)?value as Row:{};
const textOrNull=(value:unknown):string|null=>value==null?null:String(value);
const strings=(value:unknown):string[]=>Array.isArray(value)?value.map(String):[];
function stable(value:unknown):string{if(value instanceof Date)return JSON.stringify(value.toISOString());if(Array.isArray(value))return '['+value.map(stable).join(',')+']';if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+stable((value as Row)[key])).join(',')+'}';return JSON.stringify(value)??'null';}
export function agentConfigurationDigest(value:unknown):string{return createHash('sha256').update(stable(value)).digest('hex');}
export function mapAgentConfigurationRevision(row:Row):AgentConfigurationRevision{return {id:String(row.id),organizationId:String(row.organization_id),agentId:String(row.agent_id),revisionNumber:Number(row.revision_number),kind:row.kind as AgentConfigurationRevision['kind'],baseRevisionId:textOrNull(row.base_revision_id),parentDraftId:textOrNull(row.parent_draft_id),restoredFromId:textOrNull(row.restored_from_id),legacySourceVersionId:textOrNull(row.legacy_source_version_id),coverage:row.coverage as AgentConfigurationRevision['coverage'],snapshot:validateAgentConfigurationSnapshot(row.snapshot),createdBy:textOrNull(row.created_by),createdAt:new Date(String(row.created_at)).toISOString()};}
const revision=mapAgentConfigurationRevision;

/** Metadata only: encrypted credentials, source messages and provider tokens
 * never enter dependency snapshots. Only referenced channels affect the hash. */
export async function agentConfigurationDependencyFingerprint(client:PoolClient,scope:AgentConfigurationScope,snapshot:AgentConfigurationSnapshotV1,revocationGeneration:number):Promise<string>{
 const defaults=await client.query('SELECT to_jsonb(s) AS settings FROM organization_ai_runtime_settings s WHERE organization_id=$1',[scope.organizationId]);
 const providers=await client.query('SELECT id,provider,purpose,model,enabled,updated_at FROM ai_provider_configs WHERE organization_id=$1 ORDER BY id',[scope.organizationId]);
 const email=await client.query('SELECT id,status,capabilities,deleted_at FROM email_accounts WHERE organization_id=$1 AND id=ANY($2::uuid[]) ORDER BY id',[scope.organizationId,snapshot.channels.email.map(binding=>binding.accountId)]);
 const whatsapp=await client.query('SELECT id,status,deleted_at FROM whatsapp_accounts WHERE organization_id=$1 AND id=ANY($2::uuid[]) ORDER BY id',[scope.organizationId,snapshot.channels.whatsappAccountId?[snapshot.channels.whatsappAccountId]:[]]);
 return agentConfigurationDigest({defaults:defaults.rows,providers:providers.rows,email:email.rows,whatsapp:whatsapp.rows,revocationGeneration});
}

export async function lockAgentConfiguration(client:PoolClient,scope:AgentConfigurationScope):Promise<Row|null>{
 const result=await client.query<Row>('SELECT * FROM agents WHERE organization_id=$1 AND id=$2 FOR UPDATE',[scope.organizationId,scope.agentId]);return result.rows[0]??null;
}
export async function readAgentConfigurationHead(client:PoolClient,scope:Pick<AgentConfigurationScope,'organizationId'|'agentId'>):Promise<{activeRevisionId:string;revocationGeneration:number;barrier:ConfigurationDenials}>{
 const result=await client.query<Row>('SELECT active_revision_id,revocation_generation,revocation_barrier FROM agent_configuration_heads WHERE organization_id=$1 AND agent_id=$2',[scope.organizationId,scope.agentId]);
 const row=result.rows[0];if(!row)throw Error('Configuration baseline is unavailable');
 return {activeRevisionId:String(row.active_revision_id),revocationGeneration:Number(row.revocation_generation),barrier:readConfigurationDenials(row.revocation_barrier)};
}

export async function captureAgentConfigurationProjection(client:PoolClient,scope:AgentConfigurationScope,agent:Row,revocationGeneration=0,includeCurrentProtectedValues=false):Promise<AgentConfigurationSnapshotV1>{
 const policies=await client.query<Row>('SELECT * FROM agent_policies WHERE agent_id=$1',[scope.agentId]);
 const settings=await client.query<Row>('SELECT * FROM agent_ai_settings WHERE organization_id=$1 AND agent_id=$2',[scope.organizationId,scope.agentId]);
 const emails=await client.query<Row>('SELECT email_account_id,role FROM agent_email_accounts WHERE agent_id=$1 ORDER BY email_account_id',[scope.agentId]);
 const whatsapp=await client.query<Row>('SELECT whatsapp_account_id FROM agent_whatsapp_accounts WHERE agent_id=$1',[scope.agentId]);
 if(whatsapp.rows.length>1)throw Error('Ambiguous WhatsApp bindings require review');
 const versions=await client.query<Row>('SELECT * FROM agent_versions WHERE agent_id=$1 AND ($2::uuid IS NULL OR id=$2) ORDER BY version_number DESC LIMIT 1',[scope.agentId,agent.current_version_id??null]);
 const policy=policies.rows[0],ai=settings.rows[0],version=versions.rows[0];
 const numeric=new Set(['embeddingDimension','temperatureOverride','maxTokensOverride']);
 const rawSnapshot={schemaVersion:1,lifecycle:{status:String(agent.status)},identity:{name:String(agent.name),slug:String(agent.slug),description:textOrNull(agent.description)},
  policy:policy?{allowedTools:strings(policy.allowed_tools),allowedSenders:strings(policy.allowed_senders),blockedSenders:strings(policy.blocked_senders),securityPolicy:obj(policy.security_policy),rateLimits:obj(policy.rate_limits)}:null,
  channels:{email:emails.rows.map(row=>({accountId:String(row.email_account_id),role:String(row.role)})),whatsappAccountId:textOrNull(whatsapp.rows[0]?.whatsapp_account_id)},
  ai:ai?Object.fromEntries(AGENT_AI_CONFIGURATION_FIELDS.map(key=>{const value=ai[AGENT_AI_CONFIGURATION_COLUMNS[key]];return [key,value==null?null:numeric.has(key)?Number(value):String(value)];})) as AgentAiConfiguration:null,
  legacy:{agent:Object.fromEntries(LEGACY_AGENT_CONFIGURATION_FIELDS.map(key=>[key,agent[key]??null])),ai:ai?{providerConfigId:textOrNull(ai.ai_provider_config_id),modelOverrides:obj(ai.model_overrides),featureFlags:obj(ai.feature_flags)}:null,
   version:{sourceId:textOrNull(version?.id),config:obj(version?.config),voiceProvider:textOrNull(version?.voice_provider),voiceModel:textOrNull(version?.voice_model),voiceId:textOrNull(version?.voice_id)}},dependencies:{fingerprint:'0'.repeat(64),revocationGeneration}};
 const snapshot=captureAgentConfigurationSnapshot(rawSnapshot);
 snapshot.dependencies.fingerprint=await agentConfigurationDependencyFingerprint(client,scope,snapshot,revocationGeneration);
 // The raw variant is only for writing CURRENT protected values back to their
 // existing active storage in the apply transaction. Never history or HTTP.
 return includeCurrentProtectedValues?{...rawSnapshot,dependencies:snapshot.dependencies} as AgentConfigurationSnapshotV1:snapshot;
}

export async function insertAgentConfigurationRevision(client:PoolClient,scope:AgentConfigurationScope,snapshot:AgentConfigurationSnapshotV1,options:{kind:AgentConfigurationRevision['kind'];baseRevisionId:string|null;parentDraftId?:string;restoredFromId?:string;legacySourceVersionId?:string;coverage?:AgentConfigurationRevision['coverage']}):Promise<AgentConfigurationRevision>{
 const result=await client.query<Row>(`INSERT INTO agent_configuration_revisions(organization_id,agent_id,revision_number,kind,base_revision_id,restored_from_id,legacy_source_version_id,coverage,snapshot,created_by,parent_draft_id)
  SELECT $1,$2,COALESCE(MAX(revision_number),0)+1,$3,$4,$5,$6,$7,$8::jsonb,$9,$10 FROM agent_configuration_revisions WHERE organization_id=$1 AND agent_id=$2 RETURNING *`,[scope.organizationId,scope.agentId,options.kind,options.baseRevisionId,options.restoredFromId??null,options.legacySourceVersionId??null,options.coverage??'complete',JSON.stringify(snapshot),scope.userId,options.parentDraftId??null]);
 if(!result.rows[0])throw Error('Configuration revision was not saved');return revision(result.rows[0]);
}
const insertRevision=insertAgentConfigurationRevision;

/** Internal complete state. HTTP/history adapters must use field-filtered
 * views and the existing per-section authority, never serialize this directly. */
export async function activeAgentConfigurationInTransaction(client:PoolClient,scope:AgentConfigurationScope,agent:Row):Promise<AgentConfigurationRevision>{
 const existing=await client.query<Row>('SELECT r.* FROM agent_configuration_heads h JOIN agent_configuration_revisions r ON r.id=h.active_revision_id AND r.organization_id=h.organization_id AND r.agent_id=h.agent_id WHERE h.organization_id=$1 AND h.agent_id=$2',[scope.organizationId,scope.agentId]);
 if(existing.rows[0])return revision(existing.rows[0]);
 const snapshot=await captureAgentConfigurationProjection(client,scope,agent);
 const baseline=await insertRevision(client,scope,snapshot,{kind:'baseline',baseRevisionId:null});
 await client.query('INSERT INTO agent_configuration_heads(organization_id,agent_id,active_revision_id) VALUES($1,$2,$3)',[scope.organizationId,scope.agentId,baseline.id]);return baseline;
}
export async function getActiveAgentConfiguration(scope:AgentConfigurationScope):Promise<AgentConfigurationRevision|null>{return withTransaction(async client=>{const agent=await lockAgentConfiguration(client,scope);return agent?activeAgentConfigurationInTransaction(client,scope,agent):null;});}

export async function draftAgentConfigurationInTransaction(client:PoolClient,scope:AgentConfigurationScope,active:AgentConfigurationRevision,input:unknown,expectedActiveRevision:string,options:{kind?:AgentConfigurationRevision['kind'];parentDraftId?:string;restoredFromId?:string;legacySourceVersionId?:string;coverage?:AgentConfigurationRevision['coverage']}={}):Promise<AgentConfigurationRevision>{
 if(active.id!==expectedActiveRevision)throw new AgentConfigurationConflictError();

 const currentAgent=await lockAgentConfiguration(client,scope);if(!currentAgent)throw Error('Agent not found');
 const current=await captureAgentConfigurationProjection(client,scope,currentAgent,0,true);
 // Review must describe the exact protected values that apply retains, including
 // credentials introduced after the historical revision was captured.
 const snapshot=captureAgentConfigurationEdit(input,current);
 const diff=diffAgentConfiguration(active.snapshot,snapshot);const actors=await lockConfigurationActors(client,scope,[scope.userId]);assertConfigurationChangeAuthority(actors.get(scope.userId!)!,diff);
 if(!diff.length)return active;
 const head=await readAgentConfigurationHead(client,scope);
 snapshot.dependencies={fingerprint:await agentConfigurationDependencyFingerprint(client,scope,snapshot,head.revocationGeneration),revocationGeneration:head.revocationGeneration};
 return insertRevision(client,scope,snapshot,{...options,kind:options.kind??'draft',baseRevisionId:active.id});
}
const draftInTransaction=draftAgentConfigurationInTransaction;
export async function createAgentConfigurationDraft(scope:AgentConfigurationScope,snapshot:unknown,expectedActiveRevision:string):Promise<AgentConfigurationRevision>{
 validateAgentConfigurationSnapshot(snapshot);
 return withTransaction(async client=>{const agent=await lockAgentConfiguration(client,scope);if(!agent)throw Error('Agent not found');const active=await activeAgentConfigurationInTransaction(client,scope,agent);return draftInTransaction(client,scope,active,snapshot,expectedActiveRevision);});
}

export async function getAgentConfigurationHistory(scope:AgentConfigurationScope,access:ConfigurationHistoryAccess={},limit=50,beforeRevisionNumber?:number):Promise<ConfigurationHistoryView[]>{
 return withTransaction(async client=>{
  const agent=await lockAgentConfiguration(client,scope);if(!agent)return [];
  await activeAgentConfigurationInTransaction(client,scope,agent);
  const result=await client.query<Row>(`SELECT r.*,CASE WHEN r.id=h.active_revision_id THEN 'active' WHEN application.id IS NOT NULL OR r.kind IN ('baseline','revocation') THEN 'superseded' ELSE 'draft' END AS state
   FROM agent_configuration_revisions r JOIN agent_configuration_heads h ON h.organization_id=r.organization_id AND h.agent_id=r.agent_id
   LEFT JOIN agent_configuration_applications application ON application.organization_id=r.organization_id AND application.agent_id=r.agent_id AND application.revision_id=r.id
   WHERE r.organization_id=$1 AND r.agent_id=$2 AND ($4::integer IS NULL OR r.revision_number<$4) ORDER BY r.revision_number DESC LIMIT $3`,[scope.organizationId,scope.agentId,Math.min(100,Math.max(1,Math.trunc(limit))),beforeRevisionNumber??null]);
  return result.rows.map(row=>{const full=revision(row);const {policy,ai,legacy,...visible}=full.snapshot;return {...full,snapshot:{...visible,...(access.policy?{policy}:{}),...(access.ai?{ai}:{}),...(access.legacy?{legacy}:{})},state:row.state as ConfigurationHistoryView['state']};});
 });
}

export async function reviewAgentConfigurationRevision(scope:AgentConfigurationScope,id:string,options:ConfigurationReviewOptions={}):Promise<AgentConfigurationReview>{
 return withTransaction(async client=>{
  const agent=await lockAgentConfiguration(client,scope);if(!agent)throw Error('Agent not found');
  const active=await activeAgentConfigurationInTransaction(client,scope,agent);
  const found=await client.query<Row>('SELECT * FROM agent_configuration_revisions WHERE organization_id=$1 AND agent_id=$2 AND id=$3',[scope.organizationId,scope.agentId,id]);
  if(!found.rows[0])throw Error('Revision not found');const candidate=revision(found.rows[0]);
  if(candidate.baseRevisionId!==active.id)throw new AgentConfigurationConflictError();
  const head=await readAgentConfigurationHead(client,scope);
  const fingerprint=await agentConfigurationDependencyFingerprint(client,scope,candidate.snapshot,head.revocationGeneration);
  const diff=diffAgentConfiguration(active.snapshot,candidate.snapshot);const digest=agentConfigurationDigest(candidate.snapshot);
  const actors=await lockConfigurationActors(client,scope,[scope.userId,candidate.createdBy]);
  assertConfigurationChangeAuthority(actors.get(scope.userId!)!,diff);assertConfigurationChangeAuthority(actors.get(candidate.createdBy!)!,diff);
  if(options.expectedDependencyFingerprint&&options.expectedDependencyFingerprint!==fingerprint)throw new AgentConfigurationConflictError();
  const validation=assertConfigurationReviewValidation(active.snapshot,candidate.snapshot,head.barrier,options);
  await assertConfigurationResources(client,scope,candidate.snapshot);
  const result=await client.query<Row>(`INSERT INTO agent_configuration_reviews(organization_id,agent_id,revision_id,base_revision_id,dependency_fingerprint,snapshot_digest,diff,created_by,validation)
   VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb) RETURNING *`,[scope.organizationId,scope.agentId,candidate.id,active.id,fingerprint,digest,JSON.stringify(diff),scope.userId,JSON.stringify(validation)]);
  const row=result.rows[0];if(!row)throw Error('Review was not saved');
  return {id:String(row.id),revisionId:candidate.id,baseRevisionId:active.id,dependencyFingerprint:fingerprint,snapshotDigest:digest,diff,validation,createdBy:scope.userId,createdAt:new Date(String(row.created_at)).toISOString(),expiresAt:new Date(String(row.expires_at)).toISOString()};
 });
}

export async function restoreAgentConfigurationRevision(scope:AgentConfigurationScope,id:string,expectedActiveRevision:string):Promise<AgentConfigurationRevision>{
 return withTransaction(async client=>{
  const agent=await lockAgentConfiguration(client,scope);if(!agent)throw Error('Agent not found');const active=await activeAgentConfigurationInTransaction(client,scope,agent);
  if(active.id!==expectedActiveRevision)throw new AgentConfigurationConflictError();
  const current=await client.query<{draft_revision_id:string}>('SELECT draft_revision_id FROM agent_configuration_draft_heads WHERE organization_id=$1 AND agent_id=$2 AND created_by=$3',[scope.organizationId,scope.agentId,scope.userId]);
  if(current.rows[0] && current.rows[0].draft_revision_id!==active.id)throw new AgentConfigurationConflictError();
  async function selectRestoredDraft(restored:AgentConfigurationRevision){
   if(restored.id!==active.id)await client.query(`INSERT INTO agent_configuration_draft_heads(organization_id,agent_id,created_by,draft_revision_id)
    VALUES($1,$2,$3,$4) ON CONFLICT (organization_id,agent_id,created_by) DO UPDATE SET draft_revision_id=EXCLUDED.draft_revision_id`,[scope.organizationId,scope.agentId,scope.userId,restored.id]);
   return restored;
  }
  const found=await client.query<Row>('SELECT * FROM agent_configuration_revisions WHERE organization_id=$1 AND agent_id=$2 AND id=$3',[scope.organizationId,scope.agentId,id]);
  if(found.rows[0])return selectRestoredDraft(await draftInTransaction(client,scope,active,revision(found.rows[0]).snapshot,expectedActiveRevision,{kind:'restore',restoredFromId:id}));
  const legacy=await client.query<Row>('SELECT v.* FROM agent_versions v JOIN agents a ON a.id=v.agent_id WHERE a.organization_id=$1 AND a.id=$2 AND v.id=$3',[scope.organizationId,scope.agentId,id]);
  const source=legacy.rows[0];if(!source)throw Error('Revision not found');
  const snapshot=captureAgentConfigurationSnapshot({...active.snapshot,legacy:{...active.snapshot.legacy,version:{sourceId:id,config:obj(source.config),voiceProvider:textOrNull(source.voice_provider),voiceModel:textOrNull(source.voice_model),voiceId:textOrNull(source.voice_id)}}});
  return selectRestoredDraft(await draftInTransaction(client,scope,active,snapshot,expectedActiveRevision,{kind:'legacy_restore',legacySourceVersionId:id,coverage:'legacy_partial'}));
 });
}
