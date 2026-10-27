import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({round:0,mode:'normal',append:vi.fn(),ok:true,approval:false}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'user',name:'QA User',email:'user@example.com'},membership:{role:'owner'},permissions:new Set(['organization.read','email.read'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{async get(){return {id:'agent'};}},appendConversationMessage:m.append,getChatConversation:async()=>({id:'conversation'}),getOrCreateChatConversation:async()=>({id:'conversation'}),listChatMessages:async()=>[],query:async()=>({rows:[]})}));
vi.mock('../../worker/src/agent/email-tool-runtime',()=>({
 createEmailToolRuntime:async()=>({registry:{listForAgent:()=>[{name:'email.messages.list',required_permission:'email.read',sensitivity:'safe',description:'List mail',input_schema:{type:'object'}}]}}),
 invokeEmailReadTool:async()=>({ok:m.ok,output:m.ok?{status:m.approval?'pending_approval':undefined,messages:[{id:'message',subject:'Test subject',from_address:'sender@example.com',account_email:'mailbox@example.com',received_at:'2026-10-24T00:00:00Z',snippet:'A harmless excerpt'}],matched_count:41,included_count:1,has_more:true,coverage:'Locally synchronized data.'}:undefined,error:m.ok?undefined:{code:'permission_denied',message:'Denied'},audit:{tool_name:'email.messages.list',duration_ms:1}}),
}));
vi.mock('../../worker/src/agent/whatsapp-tool-runtime',()=>({createWhatsAppToolRuntime:async()=>({registry:{listForAgent:()=>[]}}),invokeWhatsAppTool:vi.fn()}));
vi.mock('../../worker/src/agent/schedules-tool-runtime',()=>({createSchedulesToolRuntime:async()=>({registry:{listForAgent:()=>[]}}),invokeSchedulesTool:vi.fn()}));
vi.mock('@ai-comms-agent/agent-core',()=>({agentRuntime:{
 completeWithTools:async()=>{
  if(m.round++===0)return {text:'',toolCalls:[{id:'call',name:'email.messages.list',arguments:{account_id:'mailbox@example.com',unread_only:true,limit:1}}]};
  if(m.mode==='provider_failure')throw new Error('Provider final generation failed');
  return {text:m.mode==='planning'?'<think>private planning</think>':'',toolCalls:[]};
 },streamAuthorizedReadOnlyToolAnswer:async()=>{if(m.mode==='stream_failure')throw new Error('Provider stream failed');return(async function*(){if(m.mode==='empty')return;yield 'Matched 41. Included 1. More results exist.';})();},
}}));
import {POST} from '../src/app/api/chat/stream/route';
function deltas(stream:string){return stream.split('\n\n').filter(frame=>frame.startsWith('event: delta\n')).map(frame=>{const data=frame.split('\ndata: ')[1];if(!data)throw new Error('Missing data');return JSON.parse(data).text;}).join('');}
beforeEach(()=>{vi.stubEnv('DATABASE_URL','test-only');vi.clearAllMocks();m.round=0;m.mode='normal';m.ok=true;m.approval=false;});
async function run(){const r=await POST(new Request('https://qa.local/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message:'Show the latest unread messages in mailbox@example.com.'})}));expect(r.status).toBe(200);return r.text();}
it('emits the validated read-only final answer exactly once',async()=>{
 expect(deltas(await run())).toBe('Matched 41. Included 1. More results exist.');
});
it.each(['provider_failure','stream_failure','planning','empty'])('retains verified read evidence after %s without rerunning a tool or inventing a send',async mode=>{
 m.mode=mode;const stream=await run();const answer=deltas(stream);
 expect(answer).toContain('41');expect(answer).toContain('Test subject');expect(answer).toContain('mailbox@example.com');expect(answer).not.toMatch(/private planning|sent successfully|next_cursor/);expect(stream).toContain('event: done');
 expect(m.round).toBe(2);expect(m.append).toHaveBeenCalledWith(expect.objectContaining({role:'assistant',content:answer}));
});
it('never recovers mailbox data from a denied read',async()=>{
 m.ok=false;m.mode='provider_failure';const stream=await run();expect(deltas(stream)).not.toContain('41');expect(deltas(stream)).not.toContain('Test subject');
});

it('a read-shaped approval payload cannot become recovered evidence or a human approval',async()=>{m.approval=true;m.mode='provider_failure';const stream=await run();expect(deltas(stream)).not.toContain('41');expect(stream).not.toContain('pending human review');});
