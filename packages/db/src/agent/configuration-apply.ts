import {AGENT_AI_CONFIGURATION_COLUMNS,AGENT_AI_CONFIGURATION_FIELDS,LEGACY_AGENT_CONFIGURATION_FIELDS,diffAgentConfiguration,restoreProtectedConfigurationValues,validateAgentConfigurationSnapshot,type AgentConfigurationSnapshotV1,type ConfigurationDiff} from '@ai-comms-agent/shared';
import type {PoolClient} from 'pg';
import {withTransaction} from '../client';
import {activeAgentConfigurationInTransaction,agentConfigurationDependencyFingerprint,agentConfigurationDigest,AgentConfigurationConflictError,captureAgentConfigurationProjection,insertAgentConfigurationRevision,lockAgentConfiguration,mapAgentConfigurationRevision,readAgentConfigurationHead,type AgentConfigurationScope} from './configuration-revisions';
import {assertConfigurationChangeAuthority,assertConfigurationOwner,lockConfigurationActors} from './configuration-authority';
import {acknowledgeConfigurationGrants,configurationRevocations,emailRoleAccess,mergeConfigurationDenials,requestedRevokedAccess,type ConfigurationDenials} from './configuration-denials';
import {assertConfigurationResources} from './configuration-resources';
import {assertConfigurationReviewValidation,type ConfigurationReviewValidation} from './configuration-review-validation';

type Row=Record<string,unknown>;
export type AppliedAgentConfiguration={id:string;revisionId:string;reviewId:string;environment:'production'|'preview';createdBy:string|null;createdAt:string;legacyVersionId:string|null;legacyDeploymentId:string|null;revocationGeneration:number;alreadyApplied:boolean};
export type ActiveAgentConfiguration={organizationId:string;agentId:string;revisionId:string;snapshot:AgentConfigurationSnapshotV1;revocationGeneration:number;barrier:ConfigurationDenials};
export type AgentAccessRevocation={removeTools?:string[];email?:Array<{accountId:string;access:'all'|'read'|'send'}>;whatsappAccountId?:string;pause?:true;autonomousSend?:false};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function receipt(row:Row,alreadyApplied=false):AppliedAgentConfiguration{return {id:String(row.id),revisionId:String(row.revision_id),reviewId:String(row.review_id),environment:row.environment as AppliedAgentConfiguration['environment'],createdBy:row.created_by?String(row.created_by):null,createdAt:new Date(String(row.created_at)).toISOString(),legacyVersionId:row.legacy_version_id?String(row.legacy_version_id):null,legacyDeploymentId:row.legacy_deployment_id?String(row.legacy_deployment_id):null,revocationGeneration:Number(row.revocation_generation??0),alreadyApplied};}
function freeze<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value);}return value;}

/** One immutable revision plus its independent CURRENT denial barrier. A host
 * turn shares this object across runtimes; later applies cannot mutate it. */
export async function loadActiveAgentConfiguration(scope:Pick<AgentConfigurationScope,'organizationId'|'agentId'>):Promise<ActiveAgentConfiguration>{
 return withTransaction(async client=>{const internal={...scope,userId:null};const agent=await lockAgentConfiguration(client,internal);if(!agent)throw Error('Agent not found');const active=await activeAgentConfigurationInTransaction(client,internal,agent);const head=await readAgentConfigurationHead(client,internal);return freeze({organizationId:scope.organizationId,agentId:scope.agentId,revisionId:active.id,snapshot:active.snapshot,revocationGeneration:head.revocationGeneration,barrier:head.barrier});});
}

function legacyRuntimeValue(snapshot:AgentConfigurationSnapshotV1){const {sourceId:_sourceId,...runtime}=snapshot.legacy.version;void _sourceId;return runtime;}
function containsProtectedValue(value:unknown):boolean{return !!value&&typeof value==='object'&&(Array.isArray(value)?value.some(containsProtectedValue):(value as Row).kind==='protectedCurrentValue'||Object.values(value).some(containsProtectedValue));}

/** Parameterized active projection writes only. No network, credentials
 * refresh, outbound queue, scheduler, inbox read-state or indexing action. */
async function projectConfiguration(client:PoolClient,scope:AgentConfigurationScope,agent:Row,before:AgentConfigurationSnapshotV1,snapshot:AgentConfigurationSnapshotV1,environment:'production'|'preview',deploy:boolean):Promise<{versionId:string|null;deploymentId:string|null}>{
 const raw=await captureAgentConfigurationProjection(client,scope,agent,0,true);
 const current=restoreProtectedConfigurationValues(snapshot,raw);
 const changes=diffAgentConfiguration(before,snapshot);const changed=(section:string,field?:string)=>changes.some(row=>row.path[0]===section&&(field===undefined||row.path[1]===field));
 const assignments=['name=$3','slug=$4','description=$5','status=$6',...LEGACY_AGENT_CONFIGURATION_FIELDS.map((field,index)=>`${field}=$${index+7}`),'updated_at=now()'];
 if(changed('identity')||changed('lifecycle')||changed('legacy','agent'))await client.query(`UPDATE agents SET ${assignments.join(',')} WHERE organization_id=$1 AND id=$2`,[scope.organizationId,scope.agentId,current.identity.name,current.identity.slug,current.identity.description,current.lifecycle.status,...LEGACY_AGENT_CONFIGURATION_FIELDS.map(field=>current.legacy.agent[field]??null)]);
 if(changed('policy')&&current.policy){const policy=current.policy;await client.query(`INSERT INTO agent_policies(agent_id,security_policy,allowed_tools,allowed_senders,blocked_senders,rate_limits,updated_at)
  VALUES($1,$2::jsonb,$3::text[],$4::text[],$5::text[],$6::jsonb,now()) ON CONFLICT(agent_id) DO UPDATE SET security_policy=EXCLUDED.security_policy,allowed_tools=EXCLUDED.allowed_tools,allowed_senders=EXCLUDED.allowed_senders,blocked_senders=EXCLUDED.blocked_senders,rate_limits=EXCLUDED.rate_limits,updated_at=now()`,[scope.agentId,JSON.stringify(policy.securityPolicy),policy.allowedTools,policy.allowedSenders,policy.blockedSenders,JSON.stringify(policy.rateLimits)]);}
 else if(changed('policy'))await client.query('DELETE FROM agent_policies WHERE agent_id=$1',[scope.agentId]);
 if(changed('channels','email')){
  await client.query('DELETE FROM agent_email_accounts WHERE agent_id=$1 AND NOT(email_account_id=ANY($2::uuid[]))',[scope.agentId,current.channels.email.map(row=>row.accountId)]);
  for(const binding of current.channels.email)await client.query(`INSERT INTO agent_email_accounts(agent_id,email_account_id,role) VALUES($1,$2,$3) ON CONFLICT(agent_id,email_account_id) DO UPDATE SET role=EXCLUDED.role`,[scope.agentId,binding.accountId,binding.role]);
 }
 if(changed('channels','whatsappAccountId')){
  if(current.channels.whatsappAccountId)await client.query(`INSERT INTO agent_whatsapp_accounts(agent_id,whatsapp_account_id) VALUES($1,$2) ON CONFLICT(agent_id) DO UPDATE SET whatsapp_account_id=EXCLUDED.whatsapp_account_id`,[scope.agentId,current.channels.whatsappAccountId]);
  else await client.query('DELETE FROM agent_whatsapp_accounts WHERE agent_id=$1',[scope.agentId]);
 }
 if((changed('ai')||changed('legacy','ai'))&&(current.ai||current.legacy.ai)){
  const columns=['organization_id','agent_id','ai_provider_config_id','model_overrides','feature_flags',...AGENT_AI_CONFIGURATION_FIELDS.map(field=>AGENT_AI_CONFIGURATION_COLUMNS[field])];
  const values:unknown[]=[scope.organizationId,scope.agentId,current.legacy.ai?.providerConfigId??null,JSON.stringify(current.legacy.ai?.modelOverrides??{}),JSON.stringify(current.legacy.ai?.featureFlags??{}),...AGENT_AI_CONFIGURATION_FIELDS.map(field=>current.ai?.[field]??null)];
  await client.query(`INSERT INTO agent_ai_settings(${columns.join(',')},updated_at) VALUES(${columns.map((_,index)=>`$${index+1}${index===3||index===4?'::jsonb':''}`).join(',')},now()) ON CONFLICT(agent_id) DO UPDATE SET ${columns.filter(column=>column!=='agent_id').map(column=>`${column}=EXCLUDED.${column}`).join(',')},updated_at=now()`,values);
 }else if(changed('ai')||changed('legacy','ai'))await client.query('DELETE FROM agent_ai_settings WHERE organization_id=$1 AND agent_id=$2',[scope.organizationId,scope.agentId]);
 const oldVersion=await client.query<{id:string}>('SELECT id FROM agent_versions WHERE agent_id=$1 AND id=$2',[scope.agentId,agent.current_version_id??null]);
 let versionId:string|null=oldVersion.rows[0]?.id??null;
 if(deploy&&(!versionId||agentConfigurationDigest(legacyRuntimeValue(before))!==agentConfigurationDigest(legacyRuntimeValue(snapshot)))){
  if(containsProtectedValue(snapshot.legacy.version.config))throw Error('Protected version values must stay in their secure configuration before creating a new legacy version.');
  const legacy=snapshot.legacy.version;
  const inserted=await client.query<{id:string}>(`INSERT INTO agent_versions(agent_id,version_number,config,created_by,voice_provider,voice_model,voice_id)
   SELECT $1,COALESCE(MAX(version_number),0)+1,$2::jsonb,$3,$4,$5,$6 FROM agent_versions WHERE agent_id=$1 RETURNING id`,[scope.agentId,JSON.stringify(legacy.config),scope.userId,legacy.voiceProvider,legacy.voiceModel,legacy.voiceId]);
  versionId=inserted.rows[0]?.id??null;if(!versionId)throw Error('Legacy version was not saved');
 }
 let deploymentId=agent.current_deployment_id?String(agent.current_deployment_id):null;
 if(deploy&&snapshot.lifecycle.status==='active'){
  if(!versionId)throw Error('A deployment requires an owned configuration version');
  await client.query('UPDATE agent_deployments SET retired_at=now() WHERE agent_id=$1 AND environment=$2 AND retired_at IS NULL',[scope.agentId,environment]);
  const deployment=await client.query<{id:string}>('INSERT INTO agent_deployments(agent_id,version_id,environment,deployed_by) VALUES($1,$2,$3,$4) RETURNING id',[scope.agentId,versionId,environment,scope.userId]);
  deploymentId=deployment.rows[0]?.id??null;if(!deploymentId)throw Error('Deployment was not recorded');
 }
 if(deploy)await client.query('UPDATE agents SET current_version_id=$3,current_deployment_id=$4,updated_at=now() WHERE organization_id=$1 AND id=$2',[scope.organizationId,scope.agentId,versionId,deploymentId]);
 return {versionId,deploymentId};
}

async function configurationAudit(client:PoolClient,scope:AgentConfigurationScope,eventType:string,revisionId:string,diff:ConfigurationDiff,revocationGeneration:number):Promise<void>{
 await client.query(`INSERT INTO audit_events(organization_id,actor_user_id,agent_id,event_type,target_type,target_id,action,decision,metadata)
  VALUES($1,$2,$3,$4,'agent_configuration_revision',$5,$6,'allowed',$7::jsonb)`,[scope.organizationId,scope.userId,scope.agentId,eventType,revisionId,eventType==='agent.configuration_revoked'?'revoke_access':'apply_configuration',JSON.stringify({revisionId,changedPaths:diff.map(row=>row.path),revocationGeneration})]);
}

export async function applyAgentConfigurationRevision(scope:AgentConfigurationScope,revisionId:string,expectedActiveRevision:string,options:{reviewId:string;environment:'production'|'preview'}):Promise<AppliedAgentConfiguration>{
 if(!uuid.test(revisionId)||!uuid.test(options.reviewId)||!['production','preview'].includes(options.environment))throw Error('A saved review and deployment environment are required.');
 return withTransaction(async client=>{
  const agent=await lockAgentConfiguration(client,scope);if(!agent)throw Error('Agent not found');const active=await activeAgentConfigurationInTransaction(client,scope,agent);
  const found=await client.query<Row>('SELECT * FROM agent_configuration_revisions WHERE organization_id=$1 AND agent_id=$2 AND id=$3',[scope.organizationId,scope.agentId,revisionId]);
  if(!found.rows[0])throw Error('Revision not found');const candidate=mapAgentConfigurationRevision(found.rows[0]);
  const actors=await lockConfigurationActors(client,scope,[scope.userId,candidate.createdBy]);const actor=actors.get(scope.userId!)!;assertConfigurationOwner(actor);
  const applied=await client.query<Row>('SELECT * FROM agent_configuration_applications WHERE organization_id=$1 AND agent_id=$2 AND revision_id=$3',[scope.organizationId,scope.agentId,revisionId]);
  if(applied.rows[0]){if(applied.rows[0].review_id!==options.reviewId||applied.rows[0].created_by!==scope.userId)throw Error('This revision was already applied. Review its saved application receipt.');return receipt(applied.rows[0],true);}
  if(active.id!==expectedActiveRevision||candidate.baseRevisionId!==active.id)throw new AgentConfigurationConflictError();
  const diff=diffAgentConfiguration(active.snapshot,candidate.snapshot);assertConfigurationChangeAuthority(actor,diff);assertConfigurationChangeAuthority(actors.get(candidate.createdBy!)!,diff);
  const reviews=await client.query<Row>('SELECT * FROM agent_configuration_reviews WHERE organization_id=$1 AND agent_id=$2 AND revision_id=$3 AND id=$4',[scope.organizationId,scope.agentId,revisionId,options.reviewId]);
  const review=reviews.rows[0];
  if(!review||review.created_by!==scope.userId||review.base_revision_id!==active.id||new Date(String(review.expires_at)).getTime()<=Date.now()||review.snapshot_digest!==agentConfigurationDigest(candidate.snapshot))throw Error('This review is unavailable or expired. Review the exact changes again.');
  const head=await readAgentConfigurationHead(client,scope);const fingerprint=await agentConfigurationDependencyFingerprint(client,scope,candidate.snapshot,head.revocationGeneration);
  if(fingerprint!==review.dependency_fingerprint)throw new AgentConfigurationConflictError();
  const validation=assertConfigurationReviewValidation(active.snapshot,candidate.snapshot,head.barrier,{expectedDependencyFingerprint:fingerprint,validation:review.validation as ConfigurationReviewValidation});
  await assertConfigurationResources(client,scope,candidate.snapshot);
  const nextBarrier=acknowledgeConfigurationGrants(mergeConfigurationDenials(head.barrier,configurationRevocations(active.snapshot,candidate.snapshot)),requestedRevokedAccess(candidate.snapshot,head.barrier).filter(key=>validation.acknowledgedRevocations.includes(key)));
  const generation=head.revocationGeneration+(agentConfigurationDigest(nextBarrier)!==agentConfigurationDigest(head.barrier)?1:0);
  const projected=await projectConfiguration(client,scope,agent,active.snapshot,candidate.snapshot,options.environment,true);
  const saved=await client.query<Row>(`INSERT INTO agent_configuration_applications(organization_id,agent_id,revision_id,review_id,environment,legacy_version_id,legacy_deployment_id,created_by,revocation_generation)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[scope.organizationId,scope.agentId,revisionId,options.reviewId,options.environment,projected.versionId,projected.deploymentId,scope.userId,generation]);
  const updated=await client.query('UPDATE agent_configuration_heads SET active_revision_id=$3,revocation_generation=$4,revocation_barrier=$5::jsonb,updated_at=now() WHERE organization_id=$1 AND agent_id=$2 AND active_revision_id=$6',[scope.organizationId,scope.agentId,revisionId,generation,JSON.stringify(nextBarrier),active.id]);
  if(updated.rowCount!==1)throw new AgentConfigurationConflictError();
  await client.query('DELETE FROM agent_configuration_draft_heads WHERE organization_id=$1 AND agent_id=$2 AND draft_revision_id=$3',[scope.organizationId,scope.agentId,revisionId]);
  await configurationAudit(client,scope,'agent.configuration_applied',revisionId,diff,generation);
  if(!saved.rows[0])throw Error('Application receipt was not saved');return receipt(saved.rows[0]);
 });
}

function validateRevocation(input:AgentAccessRevocation):void{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(key=>!['removeTools','email','whatsappAccountId','pause','autonomousSend'].includes(key)))throw Error('Immediate revocation only accepts explicit access removal. Save broader changes as a draft.');
 if(input.removeTools!==undefined&&(!Array.isArray(input.removeTools)||input.removeTools.length>100||input.removeTools.some(tool=>typeof tool!=='string'||!tool.trim())))throw Error('Choose existing tool access to revoke.');
 if(input.email!==undefined&&(!Array.isArray(input.email)||input.email.length>100||input.email.some(row=>!row||typeof row!=='object'||!uuid.test(row.accountId)||!['all','read','send'].includes(row.access))))throw Error('Choose assigned mailbox access to revoke.');
 if(input.whatsappAccountId!==undefined&&(!uuid.test(input.whatsappAccountId)))throw Error('Choose the assigned phone to revoke.');
 if(input.pause!==undefined&&input.pause!==true)throw Error('Resuming an agent requires reviewed deployment.');
 if(input.autonomousSend!==undefined&&input.autonomousSend!==false)throw Error('Enabling automatic sending requires reviewed deployment.');
}

export async function revokeAgentAccessNow(scope:AgentConfigurationScope,changes:AgentAccessRevocation,expectedActiveRevision:string):Promise<{revisionId:string;revocationGeneration:number;changed:boolean}>{
 validateRevocation(changes);
 return withTransaction(async client=>{
  const agent=await lockAgentConfiguration(client,scope);if(!agent)throw Error('Agent not found');const active=await activeAgentConfigurationInTransaction(client,scope,agent);
  if(active.id!==expectedActiveRevision)throw new AgentConfigurationConflictError();
  const snapshot=structuredClone(active.snapshot);const head=await readAgentConfigurationHead(client,scope);
  if(changes.removeTools?.length&&snapshot.policy)snapshot.policy.allowedTools=snapshot.policy.allowedTools.filter(tool=>!changes.removeTools!.includes(tool));
  for(const removal of changes.email??[]){
   const binding=snapshot.channels.email.find(row=>row.accountId===removal.accountId);if(!binding)throw new AgentConfigurationConflictError();
   const access=emailRoleAccess(binding.role);const read=access.read&&removal.access!=='all'&&removal.access!=='read',send=access.send&&removal.access!=='all'&&removal.access!=='send';
   if(!read&&!send)snapshot.channels.email=snapshot.channels.email.filter(row=>row!==binding);else binding.role=read&&send?'primary':read?'read_only':'send_only';
  }
  if(changes.whatsappAccountId){if(changes.whatsappAccountId!==snapshot.channels.whatsappAccountId)throw new AgentConfigurationConflictError();snapshot.channels.whatsappAccountId=null;}
  if(changes.pause)snapshot.lifecycle.status='paused';
  if(changes.autonomousSend===false&&snapshot.policy){const {autonomous_send:_disabled,...remaining}=snapshot.policy.securityPolicy;void _disabled;snapshot.policy.securityPolicy=remaining;}
  const diff=diffAgentConfiguration(active.snapshot,snapshot);const actors=await lockConfigurationActors(client,scope,[scope.userId]);assertConfigurationChangeAuthority(actors.get(scope.userId!)!,diff);
  if(!diff.length)return {revisionId:active.id,revocationGeneration:head.revocationGeneration,changed:false};
  validateAgentConfigurationSnapshot(snapshot);
  const barrier=mergeConfigurationDenials(head.barrier,configurationRevocations(active.snapshot,snapshot));const generation=head.revocationGeneration+1;
  snapshot.dependencies={fingerprint:await agentConfigurationDependencyFingerprint(client,scope,snapshot,generation),revocationGeneration:generation};
  const revoked=await insertAgentConfigurationRevision(client,scope,snapshot,{kind:'revocation',baseRevisionId:active.id});
  await projectConfiguration(client,scope,agent,active.snapshot,snapshot,'production',false);
  await client.query('UPDATE agent_configuration_heads SET active_revision_id=$3,revocation_generation=$4,revocation_barrier=$5::jsonb,updated_at=now() WHERE organization_id=$1 AND agent_id=$2',[scope.organizationId,scope.agentId,revoked.id,generation,JSON.stringify(barrier)]);
  await configurationAudit(client,scope,'agent.configuration_revoked',revoked.id,diff,generation);
  return {revisionId:revoked.id,revocationGeneration:generation,changed:true};
 });
}
