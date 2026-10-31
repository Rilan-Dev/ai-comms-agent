import {it,expect,vi,afterEach} from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(async(_sql:string,_args:unknown[])=>({rows:[] as Array<{id:string;correlation_id:string}>})),audit:vi.fn(async(_event:unknown)=>{}),authorize:vi.fn(async(_request:unknown,_options:unknown,_adapter:unknown,_repository:unknown)=>({user:{id:'actor'}}))}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:m.authorize,authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({query:m.query,recordAuditEvent:m.audit}));
import {DELETE} from '../src/app/api/whatsapp/send-actions/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('clears only selected unqueued requests for the selected account and audits each cancellation',async()=>{
 vi.stubEnv('DATABASE_URL','test');m.query.mockResolvedValue({rows:[{id:'10000000-0000-4000-8000-000000000001',correlation_id:'ref'}]});m.audit.mockResolvedValue(undefined);
 const response=await DELETE(new Request('https://example.test/api/whatsapp/send-actions',{method:'DELETE',body:JSON.stringify({organizationId:'org',accountId:'account',actionIds:['10000000-0000-4000-8000-000000000001']})}));
 expect(response.status).toBe(200);expect(await response.json()).toMatchObject({cleared:1});expect(m.authorize.mock.calls[0]?.[1]).toMatchObject({permission:'whatsapp.send'});
 const [sql,args]=m.query.mock.calls[0]!;expect(sql).toContain("status IN ('pending','requires_template')");expect(sql).toContain('queued_message_id IS NULL');expect(args.slice(0,2)).toEqual(['org','account']);expect(m.audit).toHaveBeenCalledTimes(1);
});
it('clear all is scoped to one account and never selects queued messages',async()=>{
 vi.stubEnv('DATABASE_URL','test');m.query.mockResolvedValue({rows:[]});
 const response=await DELETE(new Request('https://example.test/api/whatsapp/send-actions',{method:'DELETE',body:JSON.stringify({organizationId:'org',accountId:'account',all:true})}));
 expect(response.status).toBe(200);expect((await response.json()).requested).toBeNull();const [sql,args]=m.query.mock.calls[0]!;expect(sql).toContain('whatsapp_account_id=$2');expect(sql).toContain('queued_message_id IS NULL');expect(args[4]).toBe(true);
});
