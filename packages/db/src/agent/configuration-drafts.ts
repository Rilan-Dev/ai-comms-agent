import {AGENT_AI_CONFIGURATION_FIELDS,type AgentConfigurationSnapshotV1} from '@ai-comms-agent/shared';
import {withTransaction} from '../client';
import {lockConfigurationActors,assertConfigurationChangeAuthority} from './configuration-authority';
import {AgentConfigurationConflictError,activeAgentConfigurationInTransaction,draftAgentConfigurationInTransaction,lockAgentConfiguration,mapAgentConfigurationRevision,type AgentConfigurationRevision,type AgentConfigurationScope} from './configuration-revisions';

export type AgentConfigurationPatch={
 identity?:Partial<AgentConfigurationSnapshotV1['identity']>;
 lifecycle?:AgentConfigurationSnapshotV1['lifecycle'];
 policy?:AgentConfigurationSnapshotV1['policy'];
 channels?:AgentConfigurationSnapshotV1['channels'];
 ai?:Partial<NonNullable<AgentConfigurationSnapshotV1['ai']>>;
 legacyVersion?:AgentConfigurationSnapshotV1['legacy']['version'];
};
export type AgentConfigurationDraftContext={activeRevisionId:string;draftRevisionId:string|null};
const fields=['identity','lifecycle','policy','channels','ai','legacyVersion'];
function isObject(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&(Object.getPrototypeOf(value)===Object.prototype||Object.getPrototypeOf(value)===null);}
function checkPatch(input:unknown):asserts input is AgentConfigurationPatch{
 if(!isObject(input)||!Object.keys(input).length||Object.keys(input).some(key=>!fields.includes(key)))throw Error('Invalid configuration patch');
 for(const key of ['identity','ai'] as const){
  if(!Object.hasOwn(input,key))continue;
  const value=input[key],allowed:readonly string[]=key==='identity'?['name','slug','description']:AGENT_AI_CONFIGURATION_FIELDS;
  if(!isObject(value)||!Object.keys(value).length||Object.keys(value).some(field=>!allowed.includes(field)))throw Error('Invalid partial configuration settings');
 }
}

/** One immutable descendant for each save; the per-editor pointer only selects
 * the recoverable candidate. Tabs must name the pointer they actually edited.
 * No projection, deployment, message or provider state changes here. */
export async function saveAgentConfigurationPatch(scope:AgentConfigurationScope,input:unknown,context:AgentConfigurationDraftContext):Promise<AgentConfigurationRevision>{
 checkPatch(input);
 return withTransaction(async client=>{
  const agent=await lockAgentConfiguration(client,scope);if(!agent)throw Error('Agent not found');
  const actors=await lockConfigurationActors(client,scope,[scope.userId]);
  assertConfigurationChangeAuthority(actors.get(scope.userId!)!,[]);
  const active=await activeAgentConfigurationInTransaction(client,scope,agent);
  if(active.id!==context.activeRevisionId)throw new AgentConfigurationConflictError();
  const result=await client.query(`SELECT r.* FROM agent_configuration_draft_heads h JOIN agent_configuration_revisions r
   ON r.organization_id=h.organization_id AND r.agent_id=h.agent_id AND r.id=h.draft_revision_id
   WHERE h.organization_id=$1 AND h.agent_id=$2 AND h.created_by=$3`,[scope.organizationId,scope.agentId,scope.userId]);
  const pointed=result.rows[0]?mapAgentConfigurationRevision(result.rows[0]):null;
  // An applied own candidate is no longer a pending draft.
  const pending=pointed?.id===active.id?null:pointed;
  if((pending?.id??null)!==context.draftRevisionId||(pending&&pending.baseRevisionId!==active.id))throw new AgentConfigurationConflictError();
  const source=pending??active;
  const snapshot=structuredClone(source.snapshot);
  if(input.identity)snapshot.identity={...snapshot.identity,...input.identity};
  if(Object.hasOwn(input,'policy'))snapshot.policy=input.policy!;
  if(Object.hasOwn(input,'channels'))snapshot.channels=input.channels!;
  if(Object.hasOwn(input,'lifecycle'))snapshot.lifecycle=input.lifecycle!;
  if(input.ai){
   const initial=snapshot.ai??Object.fromEntries(AGENT_AI_CONFIGURATION_FIELDS.map(key=>[key,null])) as NonNullable<AgentConfigurationSnapshotV1['ai']>;
   snapshot.ai={...initial,...input.ai};
  }
  if(Object.hasOwn(input,'legacyVersion'))snapshot.legacy.version=input.legacyVersion!;
  const candidate=await draftAgentConfigurationInTransaction(client,scope,active,snapshot,active.id,{...(pending?{parentDraftId:pending.id}:{})});
  if(candidate.id===active.id){
   await client.query('DELETE FROM agent_configuration_draft_heads WHERE organization_id=$1 AND agent_id=$2 AND created_by=$3',[scope.organizationId,scope.agentId,scope.userId]);
  }else{
   await client.query(`INSERT INTO agent_configuration_draft_heads(organization_id,agent_id,created_by,draft_revision_id) VALUES($1,$2,$3,$4)
    ON CONFLICT(organization_id,agent_id,created_by) DO UPDATE SET draft_revision_id=EXCLUDED.draft_revision_id,updated_at=now()`,[scope.organizationId,scope.agentId,scope.userId,candidate.id]);
  }
  return candidate;
 });
}
