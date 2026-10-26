import {beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({current:vi.fn(),account:vi.fn(),query:vi.fn(),email:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({loadActiveAgentConfiguration:m.current,getWhatsAppAccountForAgent:m.account,query:m.query,createEmailAction:m.email,recordAuditEvent:vi.fn(),PostgresEmailAccountRepository:class{async getForAgent(){return {id:'new-mail'};}}}));
import {executeProductActions} from '../../worker/src/agent/product-action-executor';
const snapshot=()=>({organizationId:'org',agentId:'agent',revisionId:'revision',revocationGeneration:0,snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['whatsapp.send','email.send.request']},channels:{email:[{accountId:'old-mail',role:'primary'}],whatsappAccountId:'old-phone'}}});
const context=()=>({organizationId:'org',agentId:'agent',executionId:'execution',output:'Public reply',configuration:snapshot() as never});
const whatsapp={type:'send_whatsapp',to:'+12025550123',body:'{{output}}'};
beforeEach(()=>{vi.clearAllMocks();m.current.mockResolvedValue(snapshot());m.account.mockResolvedValue({id:'old-phone',status:'connected'});m.query.mockResolvedValue({rows:[{id:'approval',status:'pending'}]});m.email.mockResolvedValue({id:'email-approval'});});
describe('configuration-bound legacy product proposals',()=>{
 it('keeps the existing pending-only WhatsApp proposal without inventing requester or dispatch authority',async()=>{
  expect(await executeProductActions(context(),{actions:[whatsapp]})).toEqual([expect.objectContaining({status:'pending_approval',actionId:'approval'})]);expect(m.query).toHaveBeenCalledWith(expect.stringContaining("'text','pending'"),expect.any(Array));
 });
 it('does not substitute a newly assigned phone while generating a customer reply',async()=>{
  m.account.mockResolvedValue({id:'new-phone',status:'connected'});expect((await executeProductActions(context(),{actions:[whatsapp]}))[0]?.status).toBe('configuration_required');expect(m.query).not.toHaveBeenCalled();
 });
 it('stops before proposing after revocation or current tool removal',async()=>{
  m.current.mockResolvedValue({...snapshot(),revocationGeneration:1});expect((await executeProductActions(context(),{actions:[whatsapp]}))[0]?.status).toBe('configuration_required');expect(m.query).not.toHaveBeenCalled();
  const current=snapshot();current.snapshot.policy.allowedTools=[];m.current.mockResolvedValue(current);expect((await executeProductActions(context(),{actions:[whatsapp]}))[0]?.status).toBe('configuration_required');expect(m.query).not.toHaveBeenCalled();
 });
 it('does not propose an email from a mailbox outside the captured scope',async()=>{
  expect((await executeProductActions(context(),{actions:[{type:'create_email_approval',emailAccountId:'new-mail',actionType:'send_email'}]}))[0]?.status).toBe('configuration_required');expect(m.email).not.toHaveBeenCalled();
 });
});
