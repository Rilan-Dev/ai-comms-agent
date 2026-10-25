import {beforeEach,afterEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({query:vi.fn(async()=>({rows:[]}))}));
vi.mock('@ai-comms-agent/db',()=>({query:m.query,decryptCredential:vi.fn(),parseCredentialsMasterKey:vi.fn()}));
import {claraRuntime} from '../../../packages/clara-core/src/runtime';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('DATABASE_URL','test-only-configured-database');vi.stubEnv('AI_PROVIDER','openai');vi.stubEnv('OPENAI_API_KEY','isolated-test-key');vi.stubEnv('OPENAI_BASE_URL','https://provider.example.invalid');vi.stubEnv('QDRANT_URL','https://must-not-retrieve.example.invalid');});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
it('sends only bounded customer conversation text to generation and never calls a retrieval endpoint',async()=>{
 const fetchMock=vi.fn(async(url:string,init?:RequestInit)=>{
  expect(url).toBe('https://provider.example.invalid/v1/chat/completions');
  const body=JSON.parse(String(init?.body));expect(body.messages.at(-1)).toEqual({role:'user',content:'Hi'});
  expect(JSON.stringify(body)).not.toMatch(/private-mail-knowledge|tenant-bound agent task|Parameters:|internal-message-id/);
  expect(body.messages[0].content).toContain('customer-facing reply');
  return new Response('data: {"choices":[{"delta":{"content":"Hi! How can I help?"}}]}\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
 });vi.stubGlobal('fetch',fetchMock);
 const turn=await claraRuntime.createCustomerReplyTurn({orgId:'org',agentId:'agent',kbId:'private-mail-knowledge'},'Hi');
 let text='';for await(const token of turn.stream)text+=token;
 expect(text).toBe('Hi! How can I help?');expect(fetchMock).toHaveBeenCalledTimes(1);
 expect(m.query).toHaveBeenCalled();expect(JSON.stringify(m.query.mock.calls)).not.toMatch(/knowledge_chunks|email_messages/);
});
it('skips ambient retrieval for host-scoped WhatsApp-only tool planning while preserving provider resolution',async()=>{
 const fetchMock=vi.fn(async(url:string)=>{
  expect(url).toBe('https://provider.example.invalid/v1/chat/completions');
  return Response.json({choices:[{finish_reason:'stop',message:{content:'Ready',tool_calls:[]}}]});
 });vi.stubGlobal('fetch',fetchMock);
 await claraRuntime.completeWithTools({orgId:'org',agentId:'agent',kbId:'private-mail-knowledge',skipGrounding:true},[{role:'user',content:'Create a WhatsApp approval request for a harmless test.'}],[{name:'whatsapp.send',description:'Request a send',parameters:{type:'object',properties:{}}}]);
 expect(m.query).toHaveBeenCalled();expect(JSON.stringify(m.query.mock.calls)).not.toMatch(/knowledge_chunks|email_messages/);expect(fetchMock).toHaveBeenCalledTimes(1);
});
