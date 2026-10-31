import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({query:vi.fn(),settings:{default_provider:'openai',temperature:0.7,max_tokens:1500,system_prompt:'Current system prompt'},agent:{chat_provider:null as string|null,chat_model:null as string|null},models:{openai:'openai-default',sarvam:'sarvam-default'},keyEnabled:true}));
vi.mock('@ai-comms-agent/db',()=>({query:mock.query,decryptCredential:()=>Buffer.from('test-private-key'),parseCredentialsMasterKey:()=>new Uint8Array(32)}));
import {agentRuntime} from '../../../packages/agent-core/src/runtime';
const context={orgId:'org',agentId:'agent',kbId:''};
beforeEach(()=>{vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('CREDENTIALS_MASTER_KEY','test-only');vi.stubEnv('OPENAI_API_KEY','test-env-key');mock.agent={chat_provider:null,chat_model:null};mock.settings={default_provider:'openai',temperature:0.7,max_tokens:1500,system_prompt:'Current system prompt'};mock.keyEnabled=true;mock.query.mockReset();mock.query.mockImplementation(async(sql:string,params:unknown[])=>{
 if(sql.includes('organization_ai_runtime_settings'))return {rows:[structuredClone(mock.settings)]};
 if(sql.includes('agent_ai_settings'))return {rows:[structuredClone(mock.agent)]};
 if(sql.includes('ai_provider_configs'))return {rows:[{model:mock.models[params[1] as keyof typeof mock.models],encrypted_api_key:mock.keyEnabled?Buffer.from('encrypted-test-value'):null,config:{},enabled:mock.keyEnabled}]};
 throw Error('Unexpected query');
});});afterEach(()=>vi.unstubAllEnvs());
describe('one agent configuration per host turn',()=>{
 it('does not reuse a prepared context for a different organization',async()=>{
  const prepared=await agentRuntime.prepareTurn({...context,orgId:'other'}),fetch=vi.fn(async()=>{throw Error('unnecessary provider request');});vi.stubGlobal('fetch',fetch);
  try{await expect(agentRuntime.createChatTurn({...context,messages:[{role:'user',content:'Hello'}]},prepared)).rejects.toThrow('scope');expect(fetch).not.toHaveBeenCalled();}finally{vi.unstubAllGlobals();}
 });
 it('reuses prepared settings for the final text answer as well as tool completions',async()=>{
  const prepared=await agentRuntime.prepareTurn(context);mock.settings.temperature=0.1;
  vi.stubGlobal('fetch',vi.fn(async()=>new Response('data: {"choices":[{"delta":{"content":"Hello"}}]}\n\ndata: [DONE]\n\n',{status:200})));
  try{const turn=await agentRuntime.createChatTurn({...context,messages:[{role:'user',content:'Hello'}]},prepared);expect(turn.config.temperature).toBe(0.7);let result='';for await(const part of turn.stream)result+=part;expect(result).toBe('Hello');}finally{vi.unstubAllGlobals();}
 });
 it('does not expose mutable nested resolved settings that could alter later rounds',async()=>{
  const turn=await agentRuntime.prepareTurn(context);const first=await agentRuntime.resolveProvider(turn);
  expect(()=>{first.assistantConfig.systemPrompt='Tampered prompt';}).toThrow();
  expect((await agentRuntime.resolveProvider(turn)).assistantConfig.systemPrompt).toBe('Current system prompt');
 });
 it('resolves an inherited model from the effective provider rather than the unrelated default-provider row',async()=>{mock.agent.chat_provider='sarvam';const result=await agentRuntime.resolveProvider(context);expect(result.provider).toBe('sarvam');expect(result.model).toBe('sarvam-default');});
 it('honors a saved explicit model when the runtime uses existing environment credentials',async()=>{mock.keyEnabled=false;mock.agent.chat_model='saved-custom';expect((await agentRuntime.resolveProvider(context)).model).toBe('saved-custom');});
 it('keeps defaults stable across rounds, resolves the next turn freshly, and exposes no credentials in its context',async()=>{
  const turn=await agentRuntime.prepareTurn(context);const calls=mock.query.mock.calls.length;
  mock.settings.temperature=0.2;mock.settings.system_prompt='New prompt';
  const first=await agentRuntime.resolveProvider(turn),second=await agentRuntime.resolveProvider(turn);
  expect(first.temperature).toBe(0.7);expect(second.assistantConfig.systemPrompt).toBe('Current system prompt');expect(mock.query.mock.calls).toHaveLength(calls);
  const next=await agentRuntime.resolveProvider(await agentRuntime.prepareTurn(context));expect(next.temperature).toBe(0.2);
  expect(Object.isFrozen(turn)).toBe(true);expect(JSON.stringify(turn)).not.toContain('test-private-key');expect(JSON.stringify(turn)).not.toContain('test-env-key');
 });
 it('uses the host frozen agent overrides and retains null inheritance without rereading another revision',async()=>{
  mock.agent.chat_model='wrong-newer-revision';
  const turn=await agentRuntime.prepareTurn(context,{chatProvider:'sarvam',chatModel:null});
  const resolved=await agentRuntime.resolveProvider(turn);expect(resolved.provider).toBe('sarvam');expect(resolved.model).toBe('sarvam-default');
  expect(mock.query.mock.calls.some(([sql])=>sql.includes('FROM agent_ai_settings'))).toBe(false);
 });
});
