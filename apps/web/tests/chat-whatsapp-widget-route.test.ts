import {beforeEach,describe,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({authorize:vi.fn(),load:vi.fn(),replace:vi.fn(),reconcile:vi.fn(),readiness:vi.fn(),invoke:vi.fn(),runtime:vi.fn(),decision:vi.fn(),get:vi.fn()}));
vi.mock('@/lib/identity/authorization',()=>({authorize:mocks.authorize,authorizationErrorToResponse:()=>Response.json({error:'denied'},{status:403})}));
vi.mock('@/lib/identity/repository',()=>({getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:(req:Request)=>{if(req.headers.get('origin')!=='https://app.test')throw Error('origin');}}));
vi.mock('@/lib/chat/whatsapp-workflow-store',()=>({loadWorkflow:mocks.load,replaceWorkflow:mocks.replace,reconcileWorkflow:mocks.reconcile}));
vi.mock('../src/app/api/whatsapp/readiness/route',()=>({GET:mocks.readiness}));
vi.mock('../src/app/api/whatsapp/send-actions/decision/route',()=>({POST:mocks.decision}));
vi.mock('../../worker/src/agent/whatsapp-tool-runtime',()=>({createWhatsAppToolRuntime:mocks.runtime,invokeWhatsAppTool:mocks.invoke}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{get=mocks.get},loadActiveAgentConfiguration:vi.fn()}));
import {POST} from '../src/app/api/chat/widgets/[messageId]/route';
const widget={version:1,kind:'whatsapp_workflow',revision:3,ownerId:'owner',turnId:'turn',reference:'ref',recipient:'+919629534701',body:'Hi',status:'review',accountId:'phone',accountLabel:'Business phone',readiness:null,actionId:null,expiresAt:'2099-01-01',notice:''};
const request=(command:unknown,origin='https://app.test')=>new Request('https://app.test/api/chat/widgets/11111111-1111-1111-1111-111111111111?organizationId=org&agentId=agent&conversationId=conversation',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(command)});
const params={params:Promise.resolve({messageId:'11111111-1111-1111-1111-111111111111'})};
beforeEach(()=>{vi.resetAllMocks();mocks.authorize.mockResolvedValue({user:{id:'owner'},membership:{role:'owner'},permissions:new Set(['organization.read','whatsapp.send'])});mocks.load.mockResolvedValue({...widget});mocks.get.mockResolvedValue({status:'active'});mocks.reconcile.mockImplementation(async(_s,w)=>w);mocks.replace.mockImplementation(async(_s,_id,prev,next)=>({...next,revision:prev.revision+1}));mocks.readiness.mockResolvedValue(Response.json({state:'ready',canRequestSend:true,accountId:'phone',windowOpen:true}));mocks.runtime.mockResolvedValue({});mocks.invoke.mockResolvedValue({ok:true});});
describe('interactive WhatsApp action boundary',()=>{
 it('rejects cross-origin requests before loading a workflow',async()=>{expect((await POST(request({action:'inspect',revision:3},'https://evil.test'),params)).status).toBe(403);expect(mocks.load).not.toHaveBeenCalled();});
 it('does not invoke a tool for a missing or differently owned widget',async()=>{mocks.load.mockResolvedValue(null);expect((await POST(request({action:'request',revision:3}),params)).status).toBe(404);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('returns current state on a stale tab without creating another request',async()=>{expect((await POST(request({action:'request',revision:2}),params)).status).toBe(409);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('requires review and an open service window for free-form requests',async()=>{mocks.load.mockResolvedValue({...widget,status:'draft'});expect((await POST(request({action:'request',revision:3}),params)).status).toBe(409);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('blocks removed permissions even when the previous widget said ready',async()=>{mocks.authorize.mockResolvedValue({user:{id:'owner'},membership:{role:'member'},permissions:new Set(['organization.read'])});expect((await POST(request({action:'request',revision:3}),params)).status).toBe(403);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('requires the same reviewed account after a binding change',async()=>{mocks.readiness.mockResolvedValue(Response.json({state:'ready',canRequestSend:true,accountId:'different',windowOpen:true}));expect((await POST(request({action:'request',revision:3}),params)).status).toBe(409);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('a losing compare-and-swap never invokes the tool',async()=>{mocks.replace.mockResolvedValue(null);expect((await POST(request({action:'request',revision:3}),params)).status).toBe(409);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('uses the existing registered tool with stored content and explicit review',async()=>{await POST(request({action:'request',revision:3}),params);expect(mocks.invoke).toHaveBeenCalledWith({},'whatsapp.send',{account_id:'phone',to:'+919629534701',payload_type:'text',body:'Hi'},expect.objectContaining({agent_id:'agent',user_id:'owner',turn_id:'turn',require_human_approval:true}));});
 it('refreshing an uncertain outcome does not replay the tool',async()=>{mocks.load.mockResolvedValue({...widget,status:'unknown'});await POST(request({action:'refresh',revision:3}),params);expect(mocks.invoke).not.toHaveBeenCalled();});
 it('renews an expired request as an editable review with a fresh operation identity, without invoking sending',async()=>{
  mocks.load.mockResolvedValue({...widget,status:'expired',actionId:'old'});
  const response=await POST(request({action:'renew',revision:3}),params);expect(response.status).toBe(200);
  const next=(await response.json()).widget;expect(next.status).toBe('draft');expect(next.turnId).not.toBe('turn');expect(next.actionId).toBeNull();expect(next.body).toBe('Hi');expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it.each(['unknown','pending','queued','sent','failed'])('does not renew an outcome that may still send: %s',async status=>{
  mocks.load.mockResolvedValue({...widget,status});expect((await POST(request({action:'renew',revision:3}),params)).status).toBe(409);expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('proxies only the stored approval ID through the existing decision boundary',async()=>{
  mocks.load.mockResolvedValue({...widget,status:'pending',actionId:'stored-action'});mocks.decision.mockResolvedValue(Response.json({status:'queued'}));
  await POST(request({action:'approve',revision:3}),params);
  expect(mocks.decision).toHaveBeenCalledOnce();expect(await mocks.decision.mock.calls[0]![0].json()).toEqual({organizationId:'org',actionId:'stored-action',decision:'approve'});expect(mocks.invoke).not.toHaveBeenCalled();
 });
 it('resumes queueing the same already-approved action without making a second request',async()=>{
  mocks.load.mockResolvedValue({...widget,status:'approved',actionId:'stored-action'});mocks.decision.mockResolvedValue(Response.json({status:'queued'}));
  const response=await POST(request({action:'approve',revision:3}),params);expect(response.status).toBe(200);expect(mocks.decision).toHaveBeenCalledOnce();expect(mocks.invoke).not.toHaveBeenCalled();
 });
});
