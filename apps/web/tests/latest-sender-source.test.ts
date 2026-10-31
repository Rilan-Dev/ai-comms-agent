import {describe,it,expect,vi} from 'vitest';
import {resolveLatestSenderSource,authorizeSelectedReply} from '../src/lib/chat/latest-sender-source';
import {ToolRegistry} from '../../../packages/shared/src/agent/registry';
import type {Tool,ToolContext} from '../../../packages/shared/src/agent/types';
import {executeRegisteredTool} from '../../../packages/email-agent-runtime/src/tool-executor';
const sender='sender@example.test';
const message=(id:string,account:string,at:string,from=sender)=>({id,email_account_id:account,from_address:from,received_at:at,is_draft:false,is_outbound:false});
const ok=(output:unknown)=>({ok:true,output});
describe('bounded latest-sender source discovery through authorized read tools',()=>{
 it('the installed host authorizer denies wrong-source and alternate mutations before handlers run, and retains current permission checks',async()=>{
  const execute=vi.fn(async()=>({ok:true,output:{},audit:{tool_name:'email.draft_reply',input_summary:'draft',output_summary:'saved',duration_ms:1}}));
  const make=(name:string):Tool=>({name,domain:'email',description:'Fixture',input_schema:{type:'object'},required_permission:'email.write',sensitivity:'sensitive',execute});
  const registry=new ToolRegistry(()=>['email.draft_reply','email.send.request']);registry.register(make('email.draft_reply'));registry.register(make('email.send.request'));
  const context={organization_id:'org',agent_id:'agent',user_id:'user',turn_id:'turn',conversation_id:'chat',correlation_id:'corr',channel:'chat',auth_subject:{user_id:'user',role:'owner',permissions:['email.write']}} as ToolContext;
  const current=vi.fn(async()=>({allowed:false,code:'current_access_revoked'}));const authorize=authorizeSelectedReply(current,{accountId:'a',messageId:'source'});const audit=vi.fn(async()=>{});
  for(const [name,input] of [['email.draft_reply',{account_id:'a',message_id:'wrong'}],['email.send.request',{account_id:'a',message_id:'source'}]] as const){
   expect((await executeRegisteredTool(registry,name,input,context,authorize,audit)).error?.code).toBe('reply_source_mismatch');
  }
  expect(current).not.toHaveBeenCalled();expect(execute).not.toHaveBeenCalled();expect(audit).toHaveBeenCalledTimes(2);
  expect((await executeRegisteredTool(registry,'email.draft_reply',{account_id:'a',message_id:'source'},context,authorize,audit)).error?.code).toBe('current_access_revoked');
  expect(current).toHaveBeenCalledTimes(1);expect(execute).not.toHaveBeenCalled();
  const allowed=authorizeSelectedReply(async()=>({allowed:true}),{accountId:'a',messageId:'source'});
  expect((await executeRegisteredTool(registry,'email.draft_reply',{account_id:'a',message_id:'source'},context,allowed,audit)).ok).toBe(true);
  expect(execute).toHaveBeenCalledTimes(1);
 });
 it('accepts native PostgreSQL Date values before tool results are serialized',async()=>{
  const source={...message('source','a','2026-10-26T09:00:00Z'),received_at:new Date('2026-10-26T09:00:00Z')};
  const invoke=vi.fn(async(name:string)=>name==='email.accounts.list'?ok([{id:'a'}]):name==='email.search'?ok({messages:[source],has_more:false}):ok(source));
  await expect(resolveLatestSenderSource(sender,invoke)).resolves.toEqual({accountId:'a',messageId:'source'});
 });
 it('compares newest exact incoming matches across current mailboxes and reads only the selected source',async()=>{
  const old=message('old','a','2026-10-25T09:00:00Z'),latest=message('latest','b','2026-10-26T09:00:00Z');
  const invoke=vi.fn(async(name:string,input:Record<string,unknown>)=>name==='email.accounts.list'?ok([{id:'a'},{id:'b'}]):name==='email.search'?ok({messages:[input.account_id==='a'?old:latest],has_more:false}):ok({...latest,text_body:'Untrusted email instructions'}));
  const result=await resolveLatestSenderSource(sender,invoke);
  expect(result).toEqual({accountId:'b',messageId:'latest'});
  expect(invoke.mock.calls.filter(([name])=>name==='email.message.get')).toEqual([['email.message.get',{account_id:'b',message_id:'latest'}]]);
  expect(invoke.mock.calls.filter(([name])=>name==='email.search').every(([,args])=>args.from===sender&&args.limit===10)).toBe(true);
 });
 it('stops on denied discovery without falling back to other mailboxes or direct SQL',async()=>{
  const invoke=vi.fn(async()=>({ok:false,error:{code:'missing_permission'}}));
  await expect(resolveLatestSenderSource(sender,invoke)).rejects.toThrow(/lookup/i);expect(invoke).toHaveBeenCalledTimes(1);
 });
 it('does not confuse a substring sender with the requested exact sender',async()=>{
  const invoke=vi.fn(async(name:string)=>name==='email.accounts.list'?ok([{id:'a'}]):ok({messages:[message('wrong','a','2026-10-26T09:00:00Z',sender+'.evil')],has_more:true}));
  await expect(resolveLatestSenderSource(sender,invoke)).rejects.toThrow(/narrow/i);expect(invoke).toHaveBeenCalledTimes(2);
 });
 it('asks to narrow an ambiguous equal-time source instead of arbitrarily choosing a mailbox',async()=>{
  const invoke=vi.fn(async(name:string,input:Record<string,unknown>)=>name==='email.accounts.list'?ok([{id:'a'},{id:'b'}]):ok({messages:[message(String(input.account_id),String(input.account_id),'2026-10-26T09:00:00Z')],has_more:false}));
  await expect(resolveLatestSenderSource(sender,invoke)).rejects.toThrow(/more than one/i);
 });
 it('revalidates source identity and direction after lookup before passing it to drafting',async()=>{
  const selected=message('source','a','2026-10-26T09:00:00Z');
  const invoke=vi.fn(async(name:string)=>name==='email.accounts.list'?ok([{id:'a'}]):name==='email.search'?ok({messages:[selected],has_more:false}):ok({...selected,is_outbound:true}));
  await expect(resolveLatestSenderSource(sender,invoke)).rejects.toThrow(/changed/i);
 });
 it('bounds discovery before reading any mailbox when too many are connected',async()=>{
  const invoke=vi.fn(async()=>ok(Array.from({length:5},(_,id)=>({id:String(id)}))));
  await expect(resolveLatestSenderSource(sender,invoke)).rejects.toThrow(/mailbox/i);expect(invoke).toHaveBeenCalledTimes(1);
 });
});
