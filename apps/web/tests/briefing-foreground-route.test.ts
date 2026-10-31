import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const m=vi.hoisted(()=>({authorize:vi.fn(),origin:vi.fn(),record:vi.fn()}));
vi.mock('@/lib/identity/repository',()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',async original=>({...await original<object>(),authorize:m.authorize}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:m.origin}));
vi.mock('@ai-comms-agent/db',()=>({recordForegroundActivity:m.record}));
const org='10000000-0000-4000-8000-000000000001',agent='10000000-0000-4000-8000-000000000002';
const context={params:Promise.resolve({orgId:org})};const request=(body:unknown={agentId:agent})=>new Request('http://localhost',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();vi.stubEnv('BRIEFINGS_ENABLED','true');m.authorize.mockResolvedValue({user:{id:'owner'}});});afterEach(()=>vi.unstubAllEnvs());
it('records only the authenticated principal using the server clock',async()=>{
  const {POST}=await import('../src/app/api/organizations/[orgId]/briefings/foreground/route');
  expect((await POST(request(),context)).status).toBe(204);expect(m.record).toHaveBeenCalledWith({organizationId:org,userId:'owner',agentId:agent});
  expect((await POST(request({agentId:agent,userId:'forged',timestamp:'yesterday'}),context)).status).toBe(422);
  expect(m.record).toHaveBeenCalledTimes(1);
});
it('disabled rollout and foreign-origin requests never write activity',async()=>{
  const {POST}=await import('../src/app/api/organizations/[orgId]/briefings/foreground/route');
  vi.stubEnv('BRIEFINGS_ENABLED','');expect((await POST(request(),context)).status).toBe(404);
  vi.stubEnv('BRIEFINGS_ENABLED','true');m.origin.mockImplementation(()=>{throw Error('foreign origin');});expect((await POST(request(),context)).status).toBe(403);
  expect(m.record).not.toHaveBeenCalled();
});
