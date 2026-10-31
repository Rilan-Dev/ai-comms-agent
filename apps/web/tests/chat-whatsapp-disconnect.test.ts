import {beforeEach,expect,it,vi} from 'vitest';

const m=vi.hoisted(()=>({append:vi.fn(),create:vi.fn(),replace:vi.fn(),model:vi.fn(),invoke:vi.fn(),load:vi.fn(),saved:null as any,action:false,events:[] as string[]}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'user',name:'QA',email:'qa@example.test'},membership:{role:'owner'},permissions:new Set(['organization.read','whatsapp.send'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({expandAuthorizedMentions:async ({text}:{text:string})=>text,PostgresAgentRepository:class{async get(){return {id:'agent',status:'active'};}},appendConversationMessage:m.append,getChatConversation:async()=>({id:'conversation'}),getOrCreateChatConversation:async()=>({id:'conversation'}),listChatMessages:async()=>[],query:async()=>({rows:[]})}));
vi.mock('@ai-comms-agent/agent-core',()=>({agentRuntime:{completeWithTools:m.model}}));
vi.mock('../../worker/src/agent/email-tool-runtime',()=>({createEmailToolRuntime:async()=>({registry:{listForAgent:()=>[]}})}));
vi.mock('../../worker/src/agent/schedules-tool-runtime',()=>({createSchedulesToolRuntime:async()=>({registry:{listForAgent:()=>[]}})}));
vi.mock('../../worker/src/agent/whatsapp-tool-runtime',()=>({createWhatsAppToolRuntime:async()=>({registry:{listForAgent:()=>[{name:'whatsapp.send',required_permission:'whatsapp.send',sensitivity:'sensitive',description:'Send',input_schema:{}}]}}),invokeWhatsAppTool:m.invoke}));
vi.mock('@/lib/chat/whatsapp-workflow-store',()=>({createWhatsAppWorkflow:m.create,loadWorkflow:m.load,replaceWorkflow:m.replace,reconcileWorkflow:async(_s:unknown,w:any)=>m.action?{...w,status:'pending',actionId:'action'}:w}));
import {POST} from '../src/app/api/chat/stream/route';
beforeEach(()=>{
 vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','false');vi.resetAllMocks();m.action=false;m.events=[];
 m.create.mockImplementation(async(_s,_request,_ref,turnId,content,status)=>{m.events.push('persist');m.saved={revision:0,ownerId:'user',turnId,content,status:status??'draft'};return {messageId:'saved',widget:m.saved};});
 m.load.mockImplementation(async()=>m.saved);
 m.replace.mockImplementation(async(_s,_id,_prev,next)=>{m.events.push('update');m.saved={...next,revision:next.revision+1};return m.saved;});
 m.model.mockResolvedValueOnce({text:'',toolCalls:[{id:'call',name:'whatsapp.send',arguments:{to:'+919629534701',body:'Hi',payload_type:'text'}}]}).mockResolvedValue({text:'',toolCalls:[]});
});
it('persists before mutation and reconciles after a disconnect, so reload can find the existing approval',async()=>{
 const controller=new AbortController();m.invoke.mockImplementation(async()=>{m.events.push('invoke');m.action=true;controller.abort();return {ok:true,output:{approval_required:true,action_id:'action',status:'pending'},audit:{}};});
 const response=await POST(new Request('https://qa.local/api/chat/stream',{method:'POST',signal:controller.signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message:'Send Hi using WhatsApp to +919629534701'})}));
 await response.text();expect(m.events.indexOf('persist')).toBeGreaterThanOrEqual(0);expect(m.events.indexOf('persist')).toBeLessThan(m.events.indexOf('invoke'));expect(m.create).toHaveBeenCalledOnce();expect(m.saved.status).toBe('pending');expect(m.saved.actionId).toBe('action');
});

