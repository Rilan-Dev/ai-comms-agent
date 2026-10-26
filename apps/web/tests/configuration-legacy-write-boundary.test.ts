import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({write:vi.fn(),authorize:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{async get(){return {id:'agent'};} async update(...args:unknown[]){return m.write(...args);} async retire(...args:unknown[]){return m.write(...args);} async updatePolicy(...args:unknown[]){return m.write(...args);} async createVersion(...args:unknown[]){return m.write(...args);} async deploy(...args:unknown[]){return m.write(...args);} async bindEmail(...args:unknown[]){return m.write(...args);} async unbindEmail(...args:unknown[]){return m.write(...args);} async bindWhatsApp(...args:unknown[]){return m.write(...args);} async unbindWhatsApp(...args:unknown[]){return m.write(...args);} async emailBindings(){return [];} async whatsappBinding(){return null;} async whatsappAccounts(){return [];}},PostgresEmailAccountRepository:class{},recordAuditEvent:vi.fn(),getAgentAiSettings:vi.fn(),upsertAgentAiSettings:m.write}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:m.authorize,authorizationErrorToResponse:()=>Response.json({error:'forbidden'},{status:403})}));
import {PATCH as identity,DELETE as pause} from '../src/app/api/agents/[id]/route';
import {PATCH as policy} from '../src/app/api/agents/[id]/policy/route';
import {PATCH as channels} from '../src/app/api/agents/[id]/channels/route';
import {PUT as ai} from '../src/app/api/agents/[id]/ai-settings/route';
import {POST as version} from '../src/app/api/agents/[id]/versions/route';
import {POST as deploy} from '../src/app/api/agents/[id]/deploy/route';
const context={params:Promise.resolve({id:'agent'})};
const cases=[['identity',identity,{name:'Assistant',slug:'assistant'}],['pause',pause,{}],['policy',policy,{}],['mailbox assignment',channels,{emailAccountId:'mail'}],['mailbox removal',channels,{action:'unbind_email',emailAccountId:'mail'}],['phone removal',channels,{action:'unbind_whatsapp'}],['AI',ai,{chatModel:'model'}],['version',version,{config:{}}],['deploy',deploy,{versionId:'version',environment:'production'}]] as const;
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','true');m.authorize.mockResolvedValue({user:{id:'owner'}});m.write.mockResolvedValue({id:'changed'});});afterEach(()=>vi.unstubAllEnvs());
describe('legacy mutations cannot bypass a governed configuration',()=>{
 it.each(cases)('requires the governed workflow for %s before any direct mutation',async(_label,handler,body)=>{
  const response=await handler(new Request('https://qa.local/api/agents/agent',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:'org',...body})}),context);
  expect(response.status).toBe(409);expect(await response.json()).toMatchObject({error:'configuration_workflow_required'});expect(m.authorize).toHaveBeenCalled();expect(m.write).not.toHaveBeenCalled();
 });
 it('retains authentication checks before giving workflow guidance',async()=>{
  m.authorize.mockRejectedValueOnce(Error('denied'));
  const response=await identity(new Request('https://qa.local/api/agents/agent',{method:'PATCH',body:JSON.stringify({organizationId:'org',name:'Assistant',slug:'assistant'})}),context);
  expect(response.status).toBe(403);expect(m.write).not.toHaveBeenCalled();
 });
 it('retains existing writes while the rollout is disabled',async()=>{
  vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','false');
  const response=await identity(new Request('https://qa.local/api/agents/agent',{method:'PATCH',body:JSON.stringify({organizationId:'org',name:'Assistant',slug:'assistant'})}),context);
  expect(response.status).toBe(200);expect(m.write).toHaveBeenCalledOnce();
 });
});
