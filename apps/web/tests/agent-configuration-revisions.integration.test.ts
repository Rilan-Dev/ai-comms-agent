import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {getActiveAgentConfiguration,createAgentConfigurationDraft,getAgentConfigurationHistory,reviewAgentConfigurationRevision,restoreAgentConfigurationRevision} from '../../../packages/db/src/agent/configuration-revisions';
import {AGENT_AI_CONFIGURATION_COLUMNS} from '../../../packages/shared/src/agent/configuration-revision';
import {closePostgresPool} from '../../../packages/db/src/client';
import {saveAgentConfigurationPatch,getAgentConfigurationEditor,discardAgentConfigurationDraft} from '../../../packages/db/src/agent/configuration-drafts';
const url=process.env.ACA_TEST_DATABASE_URL;const parsed=url?new URL(url):null;
if(!parsed||!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/aca_repair_test')throw Error('Dedicated loopback aca_repair_test database required');
process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';
const pg=createRequire(new URL('../../../packages/db/package.json',import.meta.url))('pg');const db=new pg.Client({connectionString:url});
const org='10000000-0000-4000-8000-000000000001',other='10000000-0000-4000-8000-000000000002',agent='20000000-0000-4000-8000-000000000001',user='30000000-0000-4000-8000-000000000001',mail='40000000-0000-4000-8000-000000000001',legacy='50000000-0000-4000-8000-000000000001';
const scope={organizationId:org,agentId:agent,userId:user};
beforeAll(async()=>{await db.connect();const columns=Object.values(AGENT_AI_CONFIGURATION_COLUMNS).map(column=>`${column} ${['embedding_dimension','temperature_override','max_tokens_override'].includes(column)?'numeric':'text'}`).join(',');await db.query(`
 DROP SCHEMA IF EXISTS aca CASCADE;CREATE SCHEMA aca;SET search_path=aca,public;
 CREATE TABLE organizations(id uuid PRIMARY KEY);CREATE TABLE users(id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'active',deleted_at timestamptz);CREATE TABLE organization_memberships(organization_id uuid,user_id uuid,role text,status text,PRIMARY KEY(organization_id,user_id));
 CREATE TABLE agents(id uuid PRIMARY KEY,organization_id uuid REFERENCES organizations(id),name text,slug text,description text,status text,current_version_id uuid,current_deployment_id uuid,created_by uuid,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),voice_provider text,voice_model text,voice_id text,${columns});
 CREATE TABLE agent_versions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),agent_id uuid,version_number int,config jsonb,created_by uuid,created_at timestamptz DEFAULT now(),voice_provider text,voice_model text,voice_id text);
 CREATE TABLE agent_policies(agent_id uuid PRIMARY KEY,security_policy jsonb,allowed_tools text[],allowed_senders text[],blocked_senders text[],rate_limits jsonb,updated_at timestamptz DEFAULT now());
 CREATE TABLE email_accounts(id uuid PRIMARY KEY,organization_id uuid,status text,capabilities jsonb,deleted_at timestamptz);
 CREATE TABLE agent_email_accounts(agent_id uuid,email_account_id uuid,role text,UNIQUE(agent_id,email_account_id));
 CREATE TABLE whatsapp_accounts(id uuid PRIMARY KEY,organization_id uuid,status text,deleted_at timestamptz);
 CREATE TABLE agent_whatsapp_accounts(agent_id uuid PRIMARY KEY,whatsapp_account_id uuid);
 CREATE TABLE agent_ai_settings(agent_id uuid PRIMARY KEY,organization_id uuid,ai_provider_config_id uuid,model_overrides jsonb DEFAULT '{}',feature_flags jsonb DEFAULT '{}',updated_at timestamptz DEFAULT now(),${columns});
 CREATE TABLE organization_ai_runtime_settings(organization_id uuid PRIMARY KEY,default_provider text,temperature numeric,updated_at timestamptz DEFAULT now());
 CREATE TABLE ai_provider_configs(id uuid PRIMARY KEY,organization_id uuid,provider text,purpose text,model text,enabled boolean,updated_at timestamptz DEFAULT now());
 CREATE FUNCTION can_manage_organization(uuid) RETURNS boolean LANGUAGE sql AS 'SELECT false';
 `);await db.query(readFileSync(new URL('../../../supabase/migrations/0056_agent_configuration_revisions.sql',import.meta.url),'utf8'));await db.query(readFileSync(new URL('../../../supabase/migrations/0057_agent_configuration_review_context.sql',import.meta.url),'utf8'));});
beforeEach(async()=>{await db.query('TRUNCATE aca.organization_memberships,aca.agent_configuration_draft_heads,aca.organizations,aca.users,aca.agents,aca.agent_versions,aca.agent_policies,aca.email_accounts,aca.agent_email_accounts,aca.whatsapp_accounts,aca.agent_whatsapp_accounts,aca.agent_ai_settings,aca.organization_ai_runtime_settings,aca.ai_provider_configs,aca.agent_configuration_revisions,aca.agent_configuration_heads,aca.agent_configuration_reviews,aca.agent_configuration_applications CASCADE');await db.query('INSERT INTO aca.organizations VALUES($1),($2)',[org,other]);await db.query('INSERT INTO aca.users(id) VALUES($1)',[user]);await db.query(`INSERT INTO aca.organization_memberships VALUES($1,$2,'owner','active')`,[org,user]);await db.query(`INSERT INTO aca.agents(id,organization_id,name,slug,status,current_version_id,voice_id) VALUES($1,$2,'Assistant','assistant','active',$3,'legacy-voice')`,[agent,org,legacy]);await db.query(`INSERT INTO aca.agent_versions(id,agent_id,version_number,config,voice_model) VALUES($1,$2,1,'{"business":"preserved"}','legacy-model')`,[legacy,agent]);await db.query(`INSERT INTO aca.agent_policies VALUES($1,'{"autonomous_send":true,"custom":{"retained":42},"api_key":"must-never-appear-in-history"}',ARRAY['email.search','custom.tool'],ARRAY['literal, entry'],ARRAY[]::text[],'{"customLimit":7}',now())`,[agent]);await db.query(`INSERT INTO aca.email_accounts VALUES($1,$2,'connected','{"read":true}',NULL)`,[mail,org]);await db.query(`INSERT INTO aca.agent_email_accounts VALUES($1,$2,'primary')`,[agent,mail]);await db.query(`INSERT INTO aca.agent_ai_settings(agent_id,organization_id,chat_model,model_overrides,feature_flags) VALUES($1,$2,'saved-custom-model','{"legacy":"retained"}','{"legacyFlag":true}')`,[agent,org]);await db.query(`INSERT INTO aca.organization_ai_runtime_settings(organization_id,default_provider,temperature) VALUES($1,'openai',0.7)`,[org]);});
afterAll(async()=>{await closePostgresPool();await db.query('DROP SCHEMA IF EXISTS aca CASCADE');await db.end();});
describe('immutable complete configuration candidates on the real database',()=>{
 it('does not create another history entry when an existing draft is saved unchanged',async()=>{
  const initial=await getAgentConfigurationEditor(scope);
  const first=await saveAgentConfigurationPatch(scope,{identity:{name:'Business helper'}},{activeRevisionId:initial.active.id,draftRevisionId:null});
  const repeated=await saveAgentConfigurationPatch(scope,{identity:{name:'Business helper'}},{activeRevisionId:initial.active.id,draftRevisionId:first.id});
  expect(repeated.id).toBe(first.id);expect((await db.query('SELECT count(*)::int n FROM aca.agent_configuration_revisions')).rows[0].n).toBe(2);
 });
 it('provides exact revoked grants that need confirmation without returning the full denial barrier',async()=>{
  const initial=await getAgentConfigurationEditor(scope);
  // The editor fixture isolates the recorded denial from its apply/audit suite.
  await db.query(`UPDATE aca.agent_configuration_heads SET revocation_barrier='{"tools":["email.search"]}'::jsonb WHERE agent_id=$1`,[agent]);
  const draft=await saveAgentConfigurationPatch(scope,{identity:{name:'Review required'}},{activeRevisionId:initial.active.id,draftRevisionId:null});
  const editor=await getAgentConfigurationEditor(scope,draft.id);
  expect(editor).toMatchObject({requiredRevocations:['tool:email.search']});expect(editor).not.toHaveProperty('barrier');
 });
 it('recovers the current editor draft and discards only its pointer while retaining immutable history',async()=>{
  const initial=await getAgentConfigurationEditor(scope);expect(initial.draft).toBeNull();
  const saved=await saveAgentConfigurationPatch(scope,{identity:{name:'Recover me'}},{activeRevisionId:initial.active.id,draftRevisionId:null});
  const resumed=await getAgentConfigurationEditor(scope);expect(resumed.draft?.id).toBe(saved.id);
  expect(resumed.dependencyFingerprint).toMatch(/^[0-9a-f]{64}$/);
  await expect(discardAgentConfigurationDraft(scope,{activeRevisionId:initial.active.id,draftRevisionId:null})).rejects.toThrow('changed');
  await discardAgentConfigurationDraft(scope,{activeRevisionId:initial.active.id,draftRevisionId:saved.id});
  expect((await getAgentConfigurationEditor(scope)).draft).toBeNull();
  expect((await getAgentConfigurationHistory(scope)).some(row=>row.id===saved.id)).toBe(true);
 });
 it('does not expose editor context or another tenant candidate to members',async()=>{
  const initial=await getAgentConfigurationEditor(scope);
  await expect(getAgentConfigurationEditor({...scope,organizationId:other},initial.active.id)).rejects.toThrow();
  await db.query(`UPDATE aca.organization_memberships SET role='member' WHERE organization_id=$1 AND user_id=$2`,[org,user]);
  await expect(getAgentConfigurationEditor(scope)).rejects.toThrow();
 });
 it('combines identity and partial AI edits in one recoverable working draft without clearing unrelated values',async()=>{
  const active=(await getActiveAgentConfiguration(scope))!;
  const first=await saveAgentConfigurationPatch(scope,{identity:{name:'Business helper'}},{activeRevisionId:active.id,draftRevisionId:null});
  const second=await saveAgentConfigurationPatch(scope,{ai:{temperatureOverride:0.4}},{activeRevisionId:active.id,draftRevisionId:first.id});
  expect(second.parentDraftId).toBe(first.id);expect(second.snapshot.identity.name).toBe('Business helper');
  expect(second.snapshot.ai?.chatModel).toBe('saved-custom-model');expect(second.snapshot.ai?.temperatureOverride).toBe(0.4);
  expect((await getActiveAgentConfiguration(scope))?.id).toBe(active.id);
  expect((await db.query('SELECT draft_revision_id FROM aca.agent_configuration_draft_heads')).rows[0].draft_revision_id).toBe(second.id);
 });
 it('rejects a second tab saving against an out-of-date working draft',async()=>{
  const active=(await getActiveAgentConfiguration(scope))!;
  const first=await saveAgentConfigurationPatch(scope,{identity:{name:'First'}},{activeRevisionId:active.id,draftRevisionId:null});
  await expect(saveAgentConfigurationPatch(scope,{identity:{name:'Lost edit'}},{activeRevisionId:active.id,draftRevisionId:null})).rejects.toThrow('changed');
  expect((await db.query('SELECT draft_revision_id FROM aca.agent_configuration_draft_heads')).rows[0].draft_revision_id).toBe(first.id);
 });
 it('rejects unknown patch keys instead of silently discarding configuration intent',async()=>{
  const active=(await getActiveAgentConfiguration(scope))!;
  await expect(saveAgentConfigurationPatch(scope,{surprise:true} as never,{activeRevisionId:active.id,draftRevisionId:null})).rejects.toThrow();
  expect((await db.query('SELECT count(*)::int n FROM aca.agent_configuration_revisions')).rows[0].n).toBe(1);
 });
 it('restoring an older candidate retains later protected fields in the exact review snapshot',async()=>{
  const active=(await getActiveAgentConfiguration(scope))!;
  const earlier=structuredClone(active.snapshot);earlier.identity.name='Earlier name';
  const saved=await createAgentConfigurationDraft(scope,earlier,active.id);
  await db.query(`UPDATE aca.agent_policies SET security_policy=security_policy || '{"refresh_token":"later-private-value"}'::jsonb WHERE agent_id=$1`,[agent]);
  const restored=await restoreAgentConfigurationRevision(scope,saved.id,active.id);
  expect(restored.snapshot.policy!.securityPolicy).toHaveProperty('refresh_token');
  expect(JSON.stringify(restored)).not.toContain('later-private-value');
  expect(restored.snapshot.identity.name).toBe('Earlier name');
 });
 it('serializes simultaneous first loads into one baseline and gives drafts distinct immutable ordinals',async()=>{const [first,second]=await Promise.all([getActiveAgentConfiguration(scope),getActiveAgentConfiguration(scope)]);expect(first?.id).toBe(second?.id);const a=structuredClone(first!.snapshot),b=structuredClone(first!.snapshot);a.identity.name='First edit';b.identity.name='Second edit';const drafts=await Promise.all([createAgentConfigurationDraft(scope,a,first!.id),createAgentConfigurationDraft(scope,b,first!.id)]);expect(new Set(drafts.map(draft=>draft.revisionNumber)).size).toBe(2);expect((await getActiveAgentConfiguration(scope))?.id).toBe(first!.id);});
 it('preserves current secret storage while capture and history contain only references',async()=>{await getActiveAgentConfiguration(scope);expect((await db.query('SELECT security_policy FROM aca.agent_policies')).rows[0].security_policy.api_key).toBe('must-never-appear-in-history');expect(JSON.stringify(await getAgentConfigurationHistory(scope,{policy:true,ai:true,legacy:true}))).not.toContain('must-never-appear');});
 it('permits existing parent deletion and FK author cleanup without allowing direct history edits',async()=>{const active=(await getActiveAgentConfiguration(scope))!;await expect(db.query('UPDATE aca.agent_configuration_revisions SET created_by=NULL WHERE id=$1',[active.id])).rejects.toThrow();await db.query('DELETE FROM aca.users WHERE id=$1',[user]);expect((await db.query('SELECT created_by FROM aca.agent_configuration_revisions WHERE id=$1',[active.id])).rows[0].created_by).toBeNull();await db.query('DELETE FROM aca.agents WHERE id=$1',[agent]);expect((await db.query('SELECT count(*)::int n FROM aca.agent_configuration_revisions')).rows[0].n).toBe(0);});
 it('captures lifecycle state without activating or pausing the agent',async()=>{expect((await getActiveAgentConfiguration(scope))?.snapshot).toMatchObject({lifecycle:{status:'active'}});});
 it('detects provider configuration revision metadata changes without storing credentials',async()=>{await db.query(`INSERT INTO aca.ai_provider_configs VALUES('60000000-0000-4000-8000-000000000001',$1,'openai','chat','custom-model',true,'2026-10-26T00:00:00Z')`,[org]);const active=(await getActiveAgentConfiguration(scope))!;const snapshot=structuredClone(active.snapshot);snapshot.identity.name='Edited';const draft=await createAgentConfigurationDraft(scope,snapshot,active.id);const first=await reviewAgentConfigurationRevision(scope,draft.id);await db.query(`UPDATE aca.ai_provider_configs SET updated_at='2026-10-26T01:00:00Z'`);const second=await reviewAgentConfigurationRevision(scope,draft.id);expect(second.dependencyFingerprint).not.toBe(first.dependencyFingerprint);});
 it('captures one actual baseline without changing active configuration or legacy history',async()=>{const before=(await db.query('SELECT to_jsonb(a) row FROM aca.agents a')).rows;const first=await getActiveAgentConfiguration(scope);const second=await getActiveAgentConfiguration(scope);expect(first?.id).toBe(second?.id);expect(first?.kind).toBe('baseline');expect(first?.snapshot.ai?.chatModel).toBe('saved-custom-model');expect(first?.snapshot.legacy.agent.voice_id).toBe('legacy-voice');expect(first?.snapshot.legacy.ai?.modelOverrides).toEqual({legacy:'retained'});expect(first?.snapshot.legacy.version.config).toEqual({business:'preserved'});expect((await db.query('SELECT to_jsonb(a) row FROM aca.agents a')).rows).toEqual(before);expect((await db.query('SELECT count(*)::int n FROM aca.agent_versions')).rows[0].n).toBe(1);expect(JSON.stringify(first)).not.toContain('must-never-appear');});
 it('saves a complete immutable draft while the baseline stays active',async()=>{const active=(await getActiveAgentConfiguration(scope))!;const snapshot=structuredClone(active.snapshot);snapshot.identity.name='Edited';snapshot.policy!.securityPolicy.unknownNew={value:17};const draft=await createAgentConfigurationDraft(scope,snapshot,active.id);expect(draft.kind).toBe('draft');expect(draft.snapshot.policy?.securityPolicy.unknownNew).toEqual({value:17});expect((await getActiveAgentConfiguration(scope))?.id).toBe(active.id);expect((await db.query('SELECT name FROM aca.agents')).rows[0].name).toBe('Assistant');await expect(db.query('UPDATE aca.agent_configuration_revisions SET snapshot=$1 WHERE id=$2',['{}',draft.id])).rejects.toThrow();await expect(db.query('DELETE FROM aca.agent_configuration_revisions WHERE id=$1',[draft.id])).rejects.toThrow();});
 it('does not insert a no-op draft or a partially invalid candidate',async()=>{const active=(await getActiveAgentConfiguration(scope))!;expect((await createAgentConfigurationDraft(scope,active.snapshot,active.id)).id).toBe(active.id);const snapshot=structuredClone(active.snapshot);snapshot.identity.slug='Invalid Slug';await expect(createAgentConfigurationDraft(scope,snapshot,active.id)).rejects.toThrow();expect((await db.query('SELECT count(*)::int n FROM aca.agent_configuration_revisions')).rows[0].n).toBe(1);});
 it('rejects a stale base before writing a candidate',async()=>{const active=(await getActiveAgentConfiguration(scope))!;const snapshot=structuredClone(active.snapshot);snapshot.identity.name='Edited';await expect(createAgentConfigurationDraft(scope,snapshot,'99999999-0000-4000-8000-000000000001')).rejects.toThrow('changed');});
 it('does not expose another organization or unrequested protected sections in history',async()=>{await getActiveAgentConfiguration(scope);expect(await getActiveAgentConfiguration({...scope,organizationId:other})).toBeNull();expect(await getAgentConfigurationHistory({...scope,organizationId:other})).toEqual([]);const limited=(await getAgentConfigurationHistory(scope))[0]!;expect(limited.snapshot).not.toHaveProperty('policy');expect(limited.snapshot).not.toHaveProperty('ai');expect(limited.snapshot).not.toHaveProperty('legacy');const full=(await getAgentConfigurationHistory(scope,{policy:true,ai:true,legacy:true}))[0]!;expect(full.snapshot.policy).toBeDefined();expect(JSON.stringify(full)).not.toContain('must-never-appear');});
 it('reviews exact changes against current dependencies without deploying',async()=>{const active=(await getActiveAgentConfiguration(scope))!;const snapshot=structuredClone(active.snapshot);snapshot.identity.name='Edited';const draft=await createAgentConfigurationDraft(scope,snapshot,active.id);const review=await reviewAgentConfigurationRevision(scope,draft.id);expect(review.revisionId).toBe(draft.id);expect(review.diff).toEqual(expect.arrayContaining([expect.objectContaining({path:['identity','name'],before:'Assistant',after:'Edited'})]));expect((await getActiveAgentConfiguration(scope))?.id).toBe(active.id);});
 it('fresh review captures changed inherited defaults while retaining null inheritance',async()=>{const active=(await getActiveAgentConfiguration(scope))!;const snapshot=structuredClone(active.snapshot);snapshot.identity.name='Edited';const draft=await createAgentConfigurationDraft(scope,snapshot,active.id);const first=await reviewAgentConfigurationRevision(scope,draft.id);await db.query('UPDATE aca.organization_ai_runtime_settings SET temperature=0.9 WHERE organization_id=$1',[org]);const second=await reviewAgentConfigurationRevision(scope,draft.id);expect(second.dependencyFingerprint).not.toBe(first.dependencyFingerprint);expect(draft.snapshot.ai?.temperatureOverride).toBeNull();});
 it('restores into a new candidate and leaves both history and active settings untouched',async()=>{const active=(await getActiveAgentConfiguration(scope))!;const snapshot=structuredClone(active.snapshot);snapshot.identity.name='Earlier edit';const draft=await createAgentConfigurationDraft(scope,snapshot,active.id);const restored=await restoreAgentConfigurationRevision(scope,draft.id,active.id);expect(restored.id).not.toBe(draft.id);expect(restored.restoredFromId).toBe(draft.id);expect(restored.snapshot.identity.name).toBe('Earlier edit');expect((await getActiveAgentConfiguration(scope))?.id).toBe(active.id);});
 it('labels legacy JSON as partial and retains settings that old versions never captured',async()=>{const active=(await getActiveAgentConfiguration(scope))!;await db.query(`UPDATE aca.agent_versions SET config='{"older":"version-only"}' WHERE id=$1`,[legacy]);const restored=await restoreAgentConfigurationRevision(scope,legacy,active.id);expect(restored.kind).toBe('legacy_restore');expect(restored.coverage).toBe('legacy_partial');expect(restored.snapshot.policy).toEqual(active.snapshot.policy);expect(restored.snapshot.ai).toEqual(active.snapshot.ai);expect(restored.snapshot.legacy.version.config).toEqual({older:'version-only'});});
});
