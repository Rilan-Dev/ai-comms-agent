import {beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({append:vi.fn(),answer:'I sent your email successfully.'}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'user'},membership:{role:'owner'},permissions:new Set(['organization.read'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({
 PostgresAgentRepository:class{async get(){return {id:'agent'};}},
 appendConversationMessage:m.append,getChatConversation:async()=>({id:'conversation'}),
 getOrCreateChatConversation:async()=>({id:'conversation'}),listChatMessages:async()=>[],
 getVoiceSessionForOrganization:async()=>({user_id:'user',agent_id:'agent',status:'active',conversation_id:'conversation'}),
 incrementVoiceSessionTurnForOrganization:async()=>true,query:async()=>({rows:[]}),
}));
vi.mock('@ai-comms-agent/clara-core',()=>({claraRuntime:{createChatTurn:async()=>({stream:(async function*(){yield m.answer.slice(0,9);yield m.answer.slice(9);})()})}}));
vi.mock('@ai-comms-agent/email-agent-runtime',()=>({runEmailAgentTurn:vi.fn(),createEmailToolRuntime:vi.fn()}));
import {POST} from '../src/app/api/voice/turn/route';
import {POST as chat} from '../src/app/api/chat/stream/route';
function deltas(stream:string){return stream.split('\n\n').filter(frame=>frame.startsWith('event: delta\n')).map(frame=>{const data=frame.split('\ndata: ')[1];if(!data)throw new Error('Missing SSE data');return JSON.parse(data).text;}).join('');}
beforeEach(()=>{vi.stubEnv('DATABASE_URL','test-only');vi.clearAllMocks();});
it('ordinary JSON voice never returns or archives a forged operation claim',async()=>{
 m.answer='I sent your email successfully.';
 const response=await POST(new Request('https://qa.local/api/voice/turn',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',sessionId:'session',transcript:'Hello, how are you?'})}));
 const body=await response.json();expect(response.status).toBe(200);expect(body.text).not.toContain(m.answer);expect(body.text).toContain('No saved draft or send request was confirmed');
 expect(m.append).not.toHaveBeenCalledWith(expect.objectContaining({role:'assistant',content:m.answer}));
});
it('ordinary Chat never emits or archives a forged operation claim',async()=>{
 m.answer='I sent your email successfully.';
 const response=await chat(new Request('https://qa.local/api/chat/stream',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',message:'Hello, how are you?'})}));
 expect(response.status).toBe(200);const stream=await response.text();expect(deltas(stream)).not.toContain(m.answer);expect(stream).toContain('No saved draft or send request was confirmed');
 expect(m.append).not.toHaveBeenCalledWith(expect.objectContaining({role:'assistant',content:m.answer}));
});
it('ordinary voice SSE never emits or archives a forged operation claim',async()=>{
 m.answer='I sent your email successfully.';
 const response=await POST(new Request('https://qa.local/api/voice/turn',{method:'POST',headers:{accept:'text/event-stream','Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',sessionId:'session',transcript:'Hello, how are you?'})}));
 expect(response.status).toBe(200);const stream=await response.text();
 expect(deltas(stream)).not.toContain(m.answer);expect(stream).toContain('No saved draft or send request was confirmed');
 expect(m.append).not.toHaveBeenCalledWith(expect.objectContaining({role:'assistant',content:m.answer}));
});
it('ordinary voice SSE preserves a safe answer after full validation',async()=>{
 m.answer='Hello! How can I help?';
 const response=await POST(new Request('https://qa.local/api/voice/turn',{method:'POST',headers:{accept:'text/event-stream','Content-Type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',sessionId:'session',transcript:'Hello, how are you?'})}));
 expect(deltas(await response.text())).toBe(m.answer);expect(m.append).toHaveBeenCalledWith(expect.objectContaining({role:'assistant',content:m.answer}));
});
