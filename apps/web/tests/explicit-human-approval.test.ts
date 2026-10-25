import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Tool,ToolContext} from '@ai-comms-agent/shared';
import {registerEmailWriteTools} from '../../../packages/email-agent-runtime/src/email-write-tools';
import {createWhatsAppSendApprovalTool} from '../../worker/src/agent/whatsapp-tool-runtime';
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
