import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({append:vi.fn(),create:vi.fn(),replace:vi.fn(),model:vi.fn(),readiness:vi.fn()}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'user'},membership:{role:'owner'},permissions:new Set(['organization.read','whatsapp.send'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{async get(){return {id:'agent',status:'active'};}},appendConversationMessage:m.append,getChatConversation:async()=>({id:'conversation'}),getOrCreateChatConversation:async()=>({id:'conversation'}),listChatMessages:async()=>[],query:async()=>({rows:[]})}));
vi.mock('@ai-comms-agent/agent-core',()=>({agentRuntime:{completeWithTools:m.model}}));
vi.mock('@/lib/chat/whatsapp-workflow-store',()=>({createWhatsAppWorkflow:m.create,reconcileWorkflow:async(_s:unknown,w:unknown)=>w,replaceWorkflow:m.replace}));
vi.mock('../src/app/api/whatsapp/readiness/route',()=>({GET:m.readiness}));
import {POST} from '../src/app/api/chat/stream/route';
beforeEach(()=>{
 vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','false');vi.resetAllMocks();
 m.model.mockResolvedValue({text:'Your phone needs connecting. Use the setup controls below.',toolCalls:[]});
 m.readiness.mockResolvedValue(Response.json({state:'disconnected',connected:false,canRequestSend:false,windowOpen:null,message:'No phone is assigned.'}));
 m.create.mockImplementation(async(_scope,_content,_ref,_turn,text)=>({messageId:'saved-message',content:text,widget:{revision:0,status:'draft',recipient:''}}));
 m.replace.mockImplementation(async(_s,_id,_prev,next)=>({...next,revision:1}));
});
const run=()=>POST(new Request('https://qa.local/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message:'Check my WhatsApp setup. Do not send a message or change any settings.'})}));
it('checks actual readiness, explains it with no mutation tools, and persists a widget in the same reply',async()=>{
 const response=await run();expect(response.status).toBe(200);const stream=await response.text();
 expect(m.readiness).toHaveBeenCalledOnce();
 expect(m.model).toHaveBeenCalledWith(expect.objectContaining({skipGrounding:true}),expect.any(Array),[],expect.any(AbortSignal));
 expect(stream).toContain('Your phone needs connecting.');expect(stream).toContain('saved-message');expect(stream).toContain('disconnected');
 expect(stream).not.toContain('No saved draft');expect(m.append).toHaveBeenCalledTimes(1);
});
it('still supplies the saved factual controls when the model is unavailable',async()=>{
 m.model.mockRejectedValue(Error('private-provider-token'));const stream=await (await run()).text();
 expect(stream).toContain('No phone is assigned.');expect(stream).toContain('saved-message');expect(stream).not.toContain('private-provider-token');
});
