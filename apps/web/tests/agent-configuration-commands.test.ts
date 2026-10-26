import {beforeEach,describe,expect,it,vi} from 'vitest';
import {AGENT_AI_CONFIGURATION_FIELDS,LEGACY_AGENT_CONFIGURATION_FIELDS} from '@ai-comms-agent/shared';
const mock=vi.hoisted(()=>({authorize:vi.fn(),editor:vi.fn(),save:vi.fn(),review:vi.fn(),apply:vi.fn(),restore:vi.fn(),revoke:vi.fn(),discard:vi.fn(),history:vi.fn(),defaults:vi.fn(),provider:vi.fn(),catalog:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({getAgentConfigurationEditor:mock.editor,saveAgentConfigurationPatch:mock.save,reviewAgentConfigurationRevision:mock.review,applyAgentConfigurationRevision:mock.apply,restoreAgentConfigurationRevision:mock.restore,revokeAgentAccessNow:mock.revoke,discardAgentConfigurationDraft:mock.discard,getAgentConfigurationHistory:mock.history,getOrgAiRuntimeSettings:mock.defaults,getDecryptedProviderConfig:mock.provider}));
vi.mock('../src/lib/identity/authorization',()=>({authorize:mock.authorize}));
vi.mock('../src/lib/identity/repository',()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('../src/lib/ai/live-model-catalog',()=>({fetchLiveModelCatalog:mock.catalog,supportsLiveCatalog:()=>true,hasDocumentedRealtimeModels:()=>false,hasDocumentedSarvamVoiceModels:()=>false,documentedRealtimeModels:()=>[],documentedSarvamVoiceModels:()=>[]}));
import {getAgentConfigurationView,runAgentConfigurationCommand} from '../src/lib/agents/configuration-commands';

const target={organizationId:'org',agentId:'agent'},request=new Request('https://example.test/api/agents/agent/configuration');
function revision(id:string){return {id,baseRevisionId:id==='active'?null:'active',createdBy:'editor',snapshot:{schemaVersion:1,lifecycle:{status:'active'},identity:{name:'Assistant',slug:'assistant',description:null},policy:{allowedTools:[],allowedSenders:[],blockedSenders:[],securityPolicy:{custom:'keep'},rateLimits:{}},channels:{email:[],whatsappAccountId:null},ai:Object.fromEntries(AGENT_AI_CONFIGURATION_FIELDS.map(key=>[key,null])),legacy:{agent:Object.fromEntries(LEGACY_AGENT_CONFIGURATION_FIELDS.map(key=>[key,null])),ai:{providerConfigId:null,modelOverrides:{custom:'private-ai'},featureFlags:{}},version:{sourceId:null,config:{custom:'legacy-version'},voiceProvider:null,voiceModel:null,voiceId:null}},dependencies:{fingerprint:'a'.repeat(64),revocationGeneration:0}}};}
beforeEach(()=>{vi.clearAllMocks();mock.authorize.mockResolvedValue({user:{id:'editor'},membership:{role:'owner'},permissions:new Set(['organization.read','organization.update'])});mock.editor.mockResolvedValue({active:revision('active'),draft:revision('draft'),candidate:revision('draft'),dependencyFingerprint:'b'.repeat(64),revocationGeneration:0});mock.defaults.mockResolvedValue({defaultProvider:'openai'});mock.history.mockResolvedValue([]);mock.save.mockResolvedValue(revision('new-draft'));mock.review.mockResolvedValue({id:'review',revisionId:'draft'});mock.apply.mockResolvedValue({revisionId:'draft'});mock.provider.mockResolvedValue({enabled:true,apiKey:'test-only-not-returned',model:'valid-model'});mock.catalog.mockResolvedValue([{id:'valid-model',name:'Valid'}]);});
describe('manual governed configuration commands',()=>{
 it('exposes only candidate-specific revoked grants for explicit review',async()=>{
  const state=await mock.editor();state.requiredRevocations=['tool:email.search'];mock.editor.mockResolvedValue(state);
  expect(await getAgentConfigurationView(request,target)).toMatchObject({requiredRevocations:['tool:email.search']});
 });
 it('authorizes current administrator before reading the editor or history',async()=>{
  mock.authorize.mockRejectedValue(Error('denied'));await expect(getAgentConfigurationView(request,target)).rejects.toThrow('denied');expect(mock.editor).not.toHaveBeenCalled();expect(mock.history).not.toHaveBeenCalled();
 });
 it('filters AI sections for an administrator without organization-update permission',async()=>{
  mock.authorize.mockResolvedValue({user:{id:'editor'},membership:{role:'admin'},permissions:new Set(['organization.read'])});
  const view=await getAgentConfigurationView(request,target);expect(view.active.snapshot).not.toHaveProperty('ai');expect(view.active.snapshot.legacy).toHaveProperty('version');expect(view.active.snapshot.legacy).not.toHaveProperty('ai');
  expect(mock.history).toHaveBeenCalledWith(expect.objectContaining({userId:'editor'}),{policy:true,ai:false,legacy:false});
 });
 it('derives actor from authentication and preserves draft context on save',async()=>{
  await runAgentConfigurationCommand(request,target,{command:'save',patch:{identity:{name:'Updated'}},context:{activeRevisionId:'active',draftRevisionId:'draft'}});
  expect(mock.save).toHaveBeenCalledWith({...target,userId:'editor'},{identity:{name:'Updated'}},{activeRevisionId:'active',draftRevisionId:'draft'});expect(mock.apply).not.toHaveBeenCalled();
 });
 it('rejects untrusted verification and actor fields rather than forwarding them',async()=>{
  await expect(runAgentConfigurationCommand(request,target,{command:'review',revisionId:'draft',validation:{modelChecks:{}},userId:'someone-else'})).rejects.toThrow('input');expect(mock.review).not.toHaveBeenCalled();
 });
 it('binds a server-generated review to the current dependency fingerprint',async()=>{
  await runAgentConfigurationCommand(request,target,{command:'review',revisionId:'draft',acceptedCustomFields:[],acknowledgedRevocations:[]});
  expect(mock.review).toHaveBeenCalledWith({...target,userId:'editor'},'draft',{expectedDependencyFingerprint:'b'.repeat(64),validation:{schemaVersion:1,acknowledgedRevocations:[],modelChecks:{}}});
 });
 it('checks the live provider and changed model on the server before review',async()=>{
  const state=await mock.editor();state.candidate.snapshot.ai.chatProvider='openai';state.candidate.snapshot.ai.chatModel='valid-model';mock.editor.mockResolvedValue(state);
  await runAgentConfigurationCommand(request,target,{command:'review',revisionId:'draft'});
  expect(mock.provider).toHaveBeenCalledWith('org','openai','chat');expect(mock.review.mock.calls[0]?.[2].validation.modelChecks.chatModel).toEqual({value:'valid-model',status:'verified'});
 });
 it('requires organization-update authority for AI differences before looking up credentials',async()=>{
  const state=await mock.editor();state.candidate.snapshot.ai.chatModel='valid-model';mock.editor.mockResolvedValue(state);
  mock.authorize.mockResolvedValue({user:{id:'editor'},membership:{role:'admin'},permissions:new Set(['organization.read'])});
  await expect(runAgentConfigurationCommand(request,target,{command:'review',revisionId:'draft'})).rejects.toThrow();expect(mock.provider).not.toHaveBeenCalled();expect(mock.review).not.toHaveBeenCalled();
 });
 it('requires an owner and exact review reference for applying without any model-provided authority',async()=>{
  await runAgentConfigurationCommand(request,target,{command:'apply',revisionId:'draft',activeRevisionId:'active',reviewId:'review',environment:'production'});
  expect(mock.apply).toHaveBeenCalledWith({...target,userId:'editor'},'draft','active',{reviewId:'review',environment:'production'});
  mock.authorize.mockResolvedValue({user:{id:'editor'},membership:{role:'admin'},permissions:new Set(['organization.read'])});
  await expect(runAgentConfigurationCommand(request,target,{command:'apply',revisionId:'draft',activeRevisionId:'active',reviewId:'review'})).rejects.toThrow();expect(mock.apply).toHaveBeenCalledTimes(1);
 });
 it('keeps immediate removal separate from staged saves and never invokes apply',async()=>{
  mock.revoke.mockResolvedValue({revisionId:'revoked',revocationGeneration:1,changed:true});
  mock.authorize.mockResolvedValue({user:{id:'editor'},membership:{role:'admin'},permissions:new Set(['organization.read'])});
  expect(await runAgentConfigurationCommand(request,target,{command:'revoke',activeRevisionId:'active',changes:{removeTools:['email.search']}})).toEqual({revocation:{revisionId:'revoked',revocationGeneration:1,changed:true}});
  expect(mock.revoke).toHaveBeenCalledWith({...target,userId:'editor'},{removeTools:['email.search']},'active');expect(mock.apply).not.toHaveBeenCalled();expect(mock.save).not.toHaveBeenCalled();
 });
 it('restores only as a new candidate and discards only with an exact draft context',async()=>{
  await runAgentConfigurationCommand(request,target,{command:'restore',revisionId:'old',activeRevisionId:'active'});
  expect(mock.restore).toHaveBeenCalledWith({...target,userId:'editor'},'old','active');
  await runAgentConfigurationCommand(request,target,{command:'discard',context:{activeRevisionId:'active',draftRevisionId:'draft'}});
  expect(mock.discard).toHaveBeenCalledWith({...target,userId:'editor'},{activeRevisionId:'active',draftRevisionId:'draft'});expect(mock.apply).not.toHaveBeenCalled();
 });
});
