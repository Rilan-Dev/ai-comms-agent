import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Tool,ToolContext} from '@ai-comms-agent/shared';
import {registerEmailWriteTools} from '../../../packages/email-agent-runtime/src/email-write-tools';
import {createWhatsAppSendApprovalTool} from '../../worker/src/agent/whatsapp-tool-runtime';
import {requiresHumanApproval} from '../../../packages/shared/src/operations/human-approval';
const mocks=vi.hoisted(()=>({auto:vi.fn(async()=>({id:'action'})),queue:vi.fn(async()=>'message'),policy:vi.fn(async()=>({securityPolicy:{autonomous_send:true}})),query:vi.fn(async(sql:string)=>({rows:sql.includes('agent_email_accounts')?[{role:'primary'}]:[{id:'11111111-1111-4111-8111-111111111111',status:sql.includes('INSERT INTO whatsapp_send_actions')?'pending':'queued'}]}))}));
vi.mock('@ai-comms-agent/db',()=>({
 PostgresAgentRepository:class{policy=mocks.policy;},PostgresEmailAccountRepository:class{async getForAgent(){return {id:'11111111-1111-4111-8111-111111111111',status:'connected',capabilities:{drafts:true,send:true}};}},
 query:mocks.query,autoApproveEmailAction:mocks.auto,queueWhatsAppOutboundMessage:mocks.queue,recordAuditEvent:async()=>{},
 createEmailAction:async()=>({id:'action',actionType:'send_email',correlationId:null}),EmailActionIdempotencyConflictError:class extends Error{},
 createLocalDraft:vi.fn(),getMailMessageForOrganization:vi.fn(),updateLocalDraftForOrganization:vi.fn(),
 getLocalDraftForOrganization:async()=>({email_account_id:'11111111-1111-4111-8111-111111111111',to_recipients:['customer@example.test'],subject:'QA',text_body:'Exact reply'}),
}));
const context:ToolContext={agent_id:'agent',organization_id:'org',user_id:'user',turn_id:'turn',correlation_id:'correlation',conversation_id:'conversation',channel:'chat',auth_subject:{user_id:'user',role:'owner',permissions:['email.write','whatsapp.send']}};
beforeEach(()=>vi.clearAllMocks());
describe('explicit human-review consent takes precedence over autonomous policy',()=>{
 it('does not gain automatic approval if the turn started in human-review mode',async()=>{
  const frozen={...context,agent_configuration:{organizationId:'org',agentId:'agent',revisionId:'revision',snapshot:{policy:{securityPolicy:{autonomous_send:false}},channels:{email:[{accountId:'11111111-1111-4111-8111-111111111111',role:'primary'}],whatsappAccountId:'11111111-1111-4111-8111-111111111111'}} as never}};
  const tools:Tool[]=[];registerEmailWriteTools(t=>tools.push(t));
  const email=await tools.find(t=>t.name==='email.send.request')!.execute({account_id:'11111111-1111-4111-8111-111111111111',draft_id:'draft'},frozen);
  expect(email.output).toMatchObject({status:'pending_approval'});expect(mocks.auto).not.toHaveBeenCalled();
  const whatsapp=await createWhatsAppSendApprovalTool().execute({to:'+15555550123',payload_type:'text',body:'Test'},frozen);
  expect(whatsapp.output).toMatchObject({approval_required:true});expect(mocks.queue).not.toHaveBeenCalled();
 });
 it('does not use a mailbox that was read-only at the start of the turn',async()=>{
  const tools:Tool[]=[];registerEmailWriteTools(t=>tools.push(t));
  const frozen={...context,agent_configuration:{organizationId:'org',agentId:'agent',revisionId:'revision',snapshot:{channels:{email:[{accountId:'11111111-1111-4111-8111-111111111111',role:'read_only'}]}} as never}};
  const result=await tools.find(t=>t.name==='email.send.request')!.execute({account_id:'11111111-1111-4111-8111-111111111111',draft_id:'draft'},frozen);
  expect(result.error?.code).toBe('account_not_available');expect(mocks.auto).not.toHaveBeenCalled();
 });
 it('does not substitute a newly assigned WhatsApp sender when the model omitted the account',async()=>{
  const frozen={...context,agent_configuration:{organizationId:'org',agentId:'agent',revisionId:'revision',snapshot:{channels:{whatsappAccountId:'22222222-2222-4222-8222-222222222222'}} as never}};
  const result=await createWhatsAppSendApprovalTool().execute({to:'+15555550123',payload_type:'text',body:'Test'},frozen);
  expect(result.ok).toBe(false);expect(result.error?.code).toBe('account_not_available');expect(mocks.query.mock.calls.some(([sql])=>sql.includes('INSERT INTO whatsapp_send_actions'))).toBe(false);expect(mocks.queue).not.toHaveBeenCalled();
 });
 it('keeps the exact mixed-task noun-form request pending under the actual host-derived flag',async()=>{
  const prompt='Create a WhatsApp approval request to +919629534701 from Meta Test Phone. Summarize my last 3 unread emails';
  const result=await createWhatsAppSendApprovalTool().execute({to:'+919629534701',payload_type:'text',body:'Three-message summary fixture'},{...context,require_human_approval:requiresHumanApproval(prompt)});
  expect(result.ok).toBe(true);expect(result.output).toMatchObject({approval_required:true});expect(mocks.queue).not.toHaveBeenCalled();
 });
 it.each([false,true])('email request retains policy behavior with require_human_approval=%s',async require_human_approval=>{
  const tools:Tool[]=[];registerEmailWriteTools(t=>tools.push(t));const tool=tools.find(t=>t.name==='email.send.request')!;
  const result=await tool.execute({account_id:'11111111-1111-4111-8111-111111111111',draft_id:'draft'},{...context,require_human_approval});
  expect(result.ok).toBe(true);expect(result.output).toMatchObject({status:require_human_approval?'pending_approval':'auto_approved'});expect(mocks.auto).toHaveBeenCalledTimes(require_human_approval?0:1);
 });
 it.each([false,true])('WhatsApp request retains policy behavior with require_human_approval=%s',async require_human_approval=>{
  const result=await createWhatsAppSendApprovalTool().execute({to:'+15555550123',payload_type:'text',body:'Harmless test'},{...context,require_human_approval});
  expect(result.ok).toBe(true);expect(result.output).toMatchObject({approval_required:require_human_approval});expect(mocks.queue).toHaveBeenCalledTimes(require_human_approval?0:1);
 });
});
