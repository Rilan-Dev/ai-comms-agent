import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {ToolContext} from '@ai-comms-agent/shared';
const m=vi.hoisted(()=>({query:vi.fn(async():Promise<{rows:Record<string,unknown>[]} >=>({rows:[]})),save:vi.fn(async()=> 'checkpoint'),reconcile:vi.fn(),read:vi.fn(),mailTool:vi.fn(),send:vi.fn(),authorize:vi.fn(async()=>({allowed:true}))}));
vi.mock('@ai-comms-agent/db',()=>({query:m.query,saveMailTaskCheckpoint:m.save,reconcileMailTaskCheckpoint:m.reconcile}));
vi.mock('../src/lib/mail/report-evidence',()=>({getMailReportEvidence:m.read}));
vi.mock('../../worker/src/agent/email-tool-runtime',()=>({createEmailToolRuntime:async()=>({registry:{listForAgent:()=>[{name:'email.search',required_permission:'email.read'},{name:'email.messages.list',required_permission:'email.read'}]},authorize:m.authorize}),invokeEmailReadTool:m.mailTool}));
vi.mock('../../worker/src/agent/whatsapp-tool-runtime',()=>({createWhatsAppToolRuntime:async()=>({registry:{listForAgent:()=>[{name:'whatsapp.send',required_permission:'whatsapp.send'}]},authorize:m.authorize}),invokeWhatsAppTool:m.send}));
import {continueMailWhatsAppReview,startMailWhatsAppReview} from '../src/lib/chat/mail-whatsapp-review';
const context:ToolContext={organization_id:'org',agent_id:'agent',conversation_id:'conversation',user_id:'user',turn_id:'fresh-turn',correlation_id:'fresh-correlation',channel:'chat',auth_subject:{user_id:'user',role:'owner',permissions:['email.read','whatsapp.send']}};
const prepared={count:3,recipient:'+919629534701',account:'10000000-0000-4000-8000-000000000001',requireHumanApproval:true as const,body:'Exact saved summary',asOf:'2026-10-26T08:00:00Z',sources:[{messageId:'source',mailbox:'owner@example.test'}]};
const checkpoint={prepared,turnId:'original-turn',correlationId:'original-correlation'};
beforeEach(()=>{vi.clearAllMocks();m.query.mockResolvedValue({rows:[]});m.authorize.mockResolvedValue({allowed:true});m.reconcile.mockImplementation(async(_scope,_ref,authorize,execute)=>await authorize(checkpoint)?execute(checkpoint):null);m.send.mockResolvedValue({ok:true,output:{action_id:'20000000-0000-4000-8000-000000000001',status:'pending',approval_required:true}});});
describe('registered executor adapter for exact WhatsApp summary continuation',()=>{
 it('keeps the frozen reader and account ceiling when live permissions add another read tool',async()=>{
  m.query.mockResolvedValue({rows:[{id:prepared.account}]});m.read.mockResolvedValue({rows:[{id:'source',account_email:'owner@example.test',subject:'Meeting',snippet:'Tomorrow',total_count:1}],matchedCount:1,lastSyncAt:null});m.mailTool.mockResolvedValue({ok:true,output:{messages:[{id:'source'}]}});
  const frozen={...context,agent_configuration:{organizationId:'org',agentId:'agent',revisionId:'revision',snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['email.messages.list','whatsapp.send']},channels:{email:[{accountId:'40000000-0000-4000-8000-000000000001',role:'read_only'}],whatsappAccountId:prepared.account}} as never}};
  await startMailWhatsAppReview(frozen,{count:3,recipient:prepared.recipient,account:'Meta Test Phone',requireHumanApproval:true});
  expect(m.mailTool.mock.calls[0]![1]).toBe('email.messages.list');expect(m.read).toHaveBeenCalledWith(expect.objectContaining({readableAccountIds:['40000000-0000-4000-8000-000000000001']}));
 });
 it('uses the registered reader on each selected mailbox before saving the review',async()=>{
  m.query.mockResolvedValue({rows:[{id:prepared.account}]});
  m.read.mockResolvedValue({rows:[{id:'source',account_email:'owner@example.test',subject:'Meeting',snippet:'Tomorrow at ten',total_count:1}],matchedCount:1,lastSyncAt:null});
  m.mailTool.mockResolvedValue({ok:true,output:{messages:[{id:'source'}]}});
  await startMailWhatsAppReview(context,{count:3,recipient:prepared.recipient,account:'Meta Test Phone',requireHumanApproval:true});
  expect(m.mailTool).toHaveBeenCalledOnce();expect(m.mailTool.mock.calls[0]![1]).toBe('email.search');
  expect(m.mailTool.mock.calls[0]![2]).toMatchObject({account_id:'owner@example.test',unread_only:true,limit:3,date_to:expect.any(String)});
  expect(m.save).toHaveBeenCalledWith(expect.objectContaining({prepared:expect.objectContaining({account:prepared.account,body:expect.stringContaining('Meeting')})}));
 });
 it('uses original identity, server body, pinned phone and forced human review',async()=>{expect(await continueMailWhatsAppReview(context,'checkpoint')).toMatchObject({state:'pending_approval'});expect(m.send).toHaveBeenCalledOnce();expect(m.send.mock.calls[0]![2]).toEqual({account_id:prepared.account,to:prepared.recipient,payload_type:'text',body:prepared.body});expect(m.send.mock.calls[0]![3]).toMatchObject({turn_id:'original-turn',correlation_id:'original-correlation',require_human_approval:true});});
 it('fails closed before invoking after current actor read permission is removed',async()=>{await expect(continueMailWhatsAppReview({...context,auth_subject:{...context.auth_subject,permissions:['whatsapp.send']}},'checkpoint')).rejects.toThrow('access');expect(m.send).not.toHaveBeenCalled();});
 it('fails closed after current saved tool authorization is removed',async()=>{m.authorize.mockResolvedValue({allowed:false});expect(await continueMailWhatsAppReview(context,'checkpoint')).toBeNull();expect(m.send).not.toHaveBeenCalled();});
 it.each(['pending','rejected','queued','sent','failed'])('reconciles an existing %s action without executing again',async status=>{m.query.mockResolvedValue({rows:[{id:'20000000-0000-4000-8000-000000000001',status,expires_at:'2099-01-01T00:00:00Z',whatsapp_account_id:prepared.account,recipient_phone:prepared.recipient,message_body:prepared.body,payload_type:'text',requested_by:'user',agent_id:'agent'}]});const result=await continueMailWhatsAppReview(context,'checkpoint');expect(result?.resourceId).toBe('20000000-0000-4000-8000-000000000001');expect(m.send).not.toHaveBeenCalled();});
 it('rejects a mismatched persisted payload rather than reusing or sending it',async()=>{m.query.mockResolvedValue({rows:[{id:'action',message_body:'Changed summary'}]});expect(await continueMailWhatsAppReview(context,'checkpoint')).toMatchObject({state:'failed',errorCode:'idempotency_conflict'});expect(m.send).not.toHaveBeenCalled();});
 it('does not read mail or save a review without current authority',async()=>{await expect(startMailWhatsAppReview({...context,auth_subject:{...context.auth_subject,permissions:['email.read']}},{count:3,recipient:prepared.recipient,account:'Meta Test Phone',requireHumanApproval:true})).rejects.toThrow('access');expect(m.read).not.toHaveBeenCalled();expect(m.save).not.toHaveBeenCalled();});
});
