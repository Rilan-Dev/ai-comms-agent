import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({round:0,excessive:false,invoke:vi.fn(),append:vi.fn(),prompt:vi.fn(),history:[] as Array<{role:string;content:string}>}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'owner',name:'Owner',email:'owner@example.test'},membership:{role:'owner'},permissions:new Set(['organization.read','email.read','email.write'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({PostgresAgentRepository:class{async get(){return {id:'agent'};}},appendConversationMessage:m.append,getChatConversation:async()=>({id:'conversation'}),getOrCreateChatConversation:async()=>({id:'conversation'}),listChatMessages:async()=>m.history,query:async()=>({rows:[]})}));
vi.mock('../../worker/src/agent/email-tool-runtime',()=>({createEmailToolRuntime:async()=>({registry:{listForAgent:()=>['email.accounts.list','email.search','email.message.get','email.draft_reply','email.send.request'].map(name=>({name,required_permission:name==='email.draft_reply'||name==='email.send.request'?'email.write':'email.read',sensitivity:name==='email.draft_reply'||name==='email.send.request'?'approval_required':'safe',description:name,input_schema:{type:'object'}}))}}),invokeEmailReadTool:m.invoke}));
vi.mock('../../worker/src/agent/whatsapp-tool-runtime',()=>({createWhatsAppToolRuntime:async()=>({registry:{listForAgent:()=>[]}}),invokeWhatsAppTool:vi.fn()}));
vi.mock('../../worker/src/agent/schedules-tool-runtime',()=>({createSchedulesToolRuntime:async()=>({registry:{listForAgent:()=>[]}}),invokeSchedulesTool:vi.fn()}));
const source='10000000-0000-4000-8000-000000000001',draft='20000000-0000-4000-8000-000000000001',action='30000000-0000-4000-8000-000000000001';
vi.mock('@ai-comms-agent/clara-core',()=>({claraRuntime:{completeWithTools:async(_context:unknown,messages:unknown[])=>{
 m.prompt(structuredClone(messages));
 const round=++m.round;
 if(m.excessive)return {text:'',toolCalls:Array.from({length:5},(_,index)=>({id:`excess-${round}-${index}`,name:'email.accounts.list',arguments:{}}))};
 const calls=round===1?[{name:'email.accounts.list',arguments:{}}]
  :round===2?[{name:'email.search',arguments:{account_id:'first',from:'sender@example.test',subject:'Old subject',limit:1}}]
  :round===3?['first','second'].map(account_id=>({name:'email.search',arguments:{account_id,from:'sender@example.test',limit:1}}))
  :round===4?[{name:'email.message.get',arguments:{account_id:'second',message_id:source}}]
  :round===5?[{name:'email.draft_reply',arguments:{account_id:'second',message_id:source,body_text:'Thank you for the test email. This is a reply in the same thread.'}}]
  :round===6?[{name:'email.send.request',arguments:{account_id:'second',draft_id:draft}}]:[];
 return {text:'',toolCalls:calls.map((call,index)=>({id:`call-${round}-${index}`,...call}))};
}}}));
import {POST} from '../src/app/api/chat/stream/route';
beforeEach(()=>{vi.clearAllMocks();m.round=0;m.excessive=false;vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','false');m.invoke.mockImplementation(async(_runtime,name)=>({ok:true,output:name==='email.draft_reply'?{status:'reply_draft_created',draft_id:draft,account_id:'second'}:name==='email.send.request'?{status:'pending_approval',action_id:action}:name==='email.accounts.list'?[{id:'first'},{id:'second'}]:{messages:[{id:source,email_account_id:'second',from_address:'sender@example.test',subject:'QA latest reply',received_at:'2026-10-26T09:51:48Z'}],matched_count:1,included_count:1,has_more:false}}));});afterEach(()=>vi.unstubAllEnvs());
it('finishes discovery across two mailboxes, reads the newest source, saves its reply and requests approval within one bounded turn',async()=>{
 const response=await POST(new Request('https://qa.local/api/chat/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message:'reply to mohammedrilan.ksa email for reply that he sended last email'})}));
 expect(response.status).toBe(200);const stream=await response.text();
 expect(m.invoke).toHaveBeenCalledWith(expect.anything(),'email.draft_reply',expect.objectContaining({account_id:'second',message_id:source}),expect.objectContaining({user_id:'owner'}));
 expect(m.invoke).toHaveBeenCalledWith(expect.anything(),'email.send.request',{account_id:'second',draft_id:draft},expect.anything());
 expect(stream).toContain('Email draft saved');expect(stream).toContain('pending human review');expect(stream).not.toContain('No saved draft');expect(m.round).toBe(6);expect(m.invoke).toHaveBeenCalledTimes(7);
});
it('replies after a very large persisted mail report without resending that report or truncating the current request',async()=>{
 const message='Reply to the last email from sender@example.test. Create a human approval request. Body: "  Héllo\n\nExact  "';
 m.history=[{role:'user',content:'Summarize all unread emails'},{role:'assistant',content:'Oversized report '.repeat(15000)}];
 try {
  const response=await POST(new Request('https://qa.local/api/chat/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message})}));
  expect(await response.text()).toContain('Email draft saved');
  const prompt=m.prompt.mock.calls[0]![0];
  expect(JSON.stringify(prompt).length).toBeLessThan(30000);
  expect(prompt).toContainEqual({role:'user',content:message});
  expect(m.history[1]!.content.length).toBeGreaterThan(200000);
 } finally {m.history=[];}
});
it('still stops at twelve tool invocations without running a thirteenth call or fabricating a reply',async()=>{
 m.excessive=true;
 const response=await POST(new Request('https://qa.local/api/chat/stream',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message:'Reply to the last email from sender@example.test'})}));const stream=await response.text();
 expect(m.invoke).toHaveBeenCalledTimes(12);expect(m.round).toBe(3);expect(stream).toContain('No saved draft');expect(stream).not.toContain('Email draft saved');
});
