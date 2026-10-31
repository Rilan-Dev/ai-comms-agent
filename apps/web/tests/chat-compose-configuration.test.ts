import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({configuration:vi.fn(),current:vi.fn(),query:vi.fn(),invoke:vi.fn()}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'user'},membership:{role:'owner'},permissions:new Set(['organization.read','email.read','email.write'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({loadActiveAgentConfiguration:m.configuration,assertCurrentAgentToolAuthorization:m.current,PostgresAgentRepository:class{async get(){return {id:'agent'};}},query:m.query}));
vi.mock('../../worker/src/agent/email-tool-runtime',()=>({createEmailToolRuntime:async()=>({registry:{listForAgent:()=>[{name:'email.draft.create'},{name:'email.send.request'}]}}),invokeEmailReadTool:m.invoke}));
import {GET,POST} from '../src/app/api/chat/mail-compose/route';
const request=(data:Record<string,unknown>)=>new Request('https://qa.local/api/chat/mail-compose',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',accountId:'old',...data})});
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','true');m.configuration.mockResolvedValue({organizationId:'org',agentId:'agent',revisionId:'frozen',revocationGeneration:0,snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['email.draft.create','email.send.request']},channels:{email:[{accountId:'old',role:'primary'}],whatsappAccountId:null}}});m.query.mockImplementation(async(_sql:string,params:unknown[])=>({rows:[{id:'old',email_address:'old@example.test',capabilities:{drafts:true,send:true}},{id:'new',email_address:'new@example.test',capabilities:{drafts:true,send:true}}].filter(row=>!Array.isArray(params[2])||params[2].includes(row.id))}));m.invoke.mockImplementation(async(_runtime,name,_input,context)=>({ok:true,output:{status:name==='email.draft.create'?'draft_created':context.require_human_approval?'pending_approval':'auto_approved',action_id:'action',draft_id:'draft'}}));});afterEach(()=>vi.unstubAllEnvs());
describe('Chat compose request and frozen settings',()=>{
 it('always treats the request-approval button as human review, including under automatic sending',async()=>{
  vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','false');const response=await POST(request({action:'request_approval',draftId:'draft'}));
  expect(response.status).toBe(200);expect(m.invoke.mock.calls[0]?.[3]).toMatchObject({require_human_approval:true});
 });
 it('lists only primary mailboxes from the frozen configuration',async()=>{
  const response=await GET(new Request('https://qa.local/api/chat/mail-compose?organizationId=org&agentId=agent'));expect(response.status).toBe(200);
  const result=await response.json();expect(result.mailboxes.map((mailbox:{id:string})=>mailbox.id)).toEqual(['old']);expect(m.current).toHaveBeenCalled();
 });
 it('rejects a new mailbox outside the frozen draft scope before persistence',async()=>{
  const response=await POST(request({action:'draft',accountId:'new',to:'qa@example.test',subject:'Test',bodyText:'Test body'}));
  expect(response.status).toBe(403);expect(m.invoke).not.toHaveBeenCalled();
 });
});
