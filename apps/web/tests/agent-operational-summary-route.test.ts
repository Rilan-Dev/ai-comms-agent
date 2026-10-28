import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({authorize:vi.fn(),agent:vi.fn(),query:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{get=m.agent;},query:m.query}));
vi.mock('@/lib/identity/repository',()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:m.authorize,authorizationErrorToResponse:()=>Response.json({error:'forbidden'},{status:403})}));
import {GET} from '../src/app/api/agents/[id]/operational-summary/route';
const context={params:Promise.resolve({id:'agent'})};
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('DATABASE_URL','test-only');m.authorize.mockResolvedValue({permissions:new Set(['organization.read'])});m.agent.mockResolvedValue({id:'agent'});});
afterEach(()=>vi.unstubAllEnvs());
describe('agent operational summary route',()=>{
 it('authorizes organization access and omits protected sources without permission',async()=>{
  const response=await GET(new Request('https://qa.local/api/agents/agent/operational-summary?organizationId=org'),context);
  expect(response.status).toBe(200);expect(await response.json()).toEqual({emailApprovals:null,whatsappApprovals:null});expect(m.query).not.toHaveBeenCalled();expect(response.headers.get('cache-control')).toContain('no-store');
 });
 it('denies before reading the agent or approval data when authorization fails',async()=>{
  m.authorize.mockRejectedValueOnce(Error('denied'));
  const response=await GET(new Request('https://qa.local/api/agents/agent/operational-summary?organizationId=org'),context);
  expect(response.status).toBe(403);expect(m.agent).not.toHaveBeenCalled();expect(m.query).not.toHaveBeenCalled();
 });
 it('does not expose approval data for an agent outside the organization',async()=>{
  m.agent.mockResolvedValueOnce(null);
  const response=await GET(new Request('https://qa.local/api/agents/agent/operational-summary?organizationId=other'),context);
  expect(response.status).toBe(404);expect(m.query).not.toHaveBeenCalled();
 });
});
