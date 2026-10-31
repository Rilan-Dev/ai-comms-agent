import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {ForbiddenError} from '@ai-comms-agent/shared';
const m=vi.hoisted(()=>({authorize:vi.fn(),list:vi.fn(),mailboxes:vi.fn(),query:vi.fn()}));
vi.mock('@/lib/identity/repository',()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',async original=>({...await original<object>(),authorize:m.authorize}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{list=m.list;},listGrantedBriefingMailboxes:m.mailboxes,query:m.query}));
const org='10000000-0000-4000-8000-000000000001';const context={params:Promise.resolve({orgId:org})};
const route='../src/app/api/organizations/[orgId]/briefing-agents/route';
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('BRIEFINGS_ENABLED','true');m.authorize.mockResolvedValue({user:{id:'owner'},permissions:new Set(['email.read'])});m.list.mockResolvedValue([{id:'agent',name:'Assistant',status:'active'}]);m.mailboxes.mockResolvedValue([{id:'mailbox',emailAddress:'owner@example.test'}]);});
afterEach(()=>vi.unstubAllEnvs());
it('a disabled rollout does not inspect identity or mail',async()=>{
  vi.stubEnv('BRIEFINGS_ENABLED','');const {GET}=await import(route);
  expect((await GET(new Request('http://localhost'),context)).status).toBe(404);expect(m.authorize).not.toHaveBeenCalled();
});
it('uses authenticated owner and URL organization, selecting only a unique eligible agent',async()=>{
  const {GET}=await import(route);const data=await (await GET(new Request('http://localhost?userId=forged'),context)).json();
  expect(m.mailboxes).toHaveBeenCalledWith({organizationId:org,userId:'owner',agentId:'agent'});
  expect(data.defaultAgentId).toBe('agent');expect(m.query).not.toHaveBeenCalled();
  m.list.mockResolvedValue([{id:'agent',name:'One',status:'active'},{id:'second',name:'Two',status:'active'}]);
  expect((await (await GET(new Request('http://localhost'),context)).json()).defaultAgentId).toBeNull();
});
it('no personal grant does not create access or assume organization-wide inbox authority',async()=>{
  m.mailboxes.mockResolvedValue([]);const {GET}=await import(route);const data=await (await GET(new Request('http://localhost'),context)).json();
  expect(data.defaultAgentId).toBeNull();expect(data.agents).toEqual([]);expect(m.query).not.toHaveBeenCalled();
});
it('only a current access administrator receives an explicit first-use setup choice',async()=>{
  m.authorize.mockResolvedValue({user:{id:'owner'},permissions:new Set(['email.read','briefing.access.manage'])});
  m.mailboxes.mockResolvedValue([]);m.query.mockResolvedValue({rows:[{id:'assigned',emailAddress:'assigned@example.test'}]});
  const {GET}=await import(route);const data=await (await GET(new Request('http://localhost'),context)).json();
  expect(data.agents).toEqual([]);expect(data.setup).toEqual([{agentId:'agent',name:'Assistant',mailboxes:[{id:'assigned',emailAddress:'assigned@example.test'}]}]);
  expect(m.query.mock.calls[0]?.[1]).toEqual([org,'agent']);
});
it('denied email access does not list agents, grant choices or mailbox metadata',async()=>{
  m.authorize.mockRejectedValue(new ForbiddenError('missing_permission'));
  const {GET}=await import(route);expect((await GET(new Request('http://localhost'),context)).status).toBe(403);
  expect(m.list).not.toHaveBeenCalled();expect(m.mailboxes).not.toHaveBeenCalled();expect(m.query).not.toHaveBeenCalled();
});
