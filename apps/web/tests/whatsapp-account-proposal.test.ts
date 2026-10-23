import {describe,it,expect,vi,beforeEach} from 'vitest';
const db=vi.hoisted(()=>({query:vi.fn(),audit:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({query:db.query,recordAuditEvent:db.audit,PostgresAgentRepository:class{async policy(){return {allowedTools:['whatsapp.send']};}}}));
import {createWhatsAppSendApprovalTool,createWhatsAppToolRuntime,invokeWhatsAppTool} from '../../worker/src/agent/whatsapp-tool-runtime';
import type {ToolContext} from '@ai-comms-agent/shared';
const account='20000000-0000-4000-8000-000000000001',action='20000000-0000-4000-8000-000000000002';
const context:ToolContext={organization_id:'org',agent_id:'agent',user_id:'user',conversation_id:'conversation',turn_id:'turn',correlation_id:'correlation',channel:'chat',auth_subject:{user_id:'user',role:'owner',permissions:['whatsapp.send']}};
beforeEach(()=>{vi.clearAllMocks();db.audit.mockResolvedValue(undefined);});
describe('WhatsApp account selection and persisted proposal',()=>{
 it('resolves the sole connected agent-bound account without asking for its internal ID',async()=>{
  db.query.mockResolvedValueOnce({rows:[{id:account,display_name:'Test phone'}]}).mockResolvedValueOnce({rows:[{id:action,status:'pending'}]});
  const tool=createWhatsAppSendApprovalTool();
  const result=await tool.execute({to:'+12025550123',payload_type:'text',body:'Harmless QA test'},context);
  expect(result).toMatchObject({ok:true,output:{action_id:action,status:'pending'}});
  expect(db.query.mock.calls[1]?.[1]).toContain(account);
  expect(tool.input_schema.required).not.toContain('account_id');
 });
 it('denies zero or ambiguous connected bindings before inserting a proposal',async()=>{
  for(const accounts of [[],[{id:account},{id:'other'}]]){
   db.query.mockReset();db.query.mockResolvedValueOnce({rows:accounts});
   const result=await createWhatsAppSendApprovalTool().execute({to:'+12025550123',payload_type:'text',body:'QA'},context);
   expect(result.ok).toBe(false);expect(db.query).toHaveBeenCalledTimes(1);
  }
 });
 it('preserves a committed proposal receipt when the secondary audit is unavailable',async()=>{
  db.query.mockResolvedValueOnce({rows:[{id:account}]}).mockResolvedValueOnce({rows:[{id:action,status:'pending'}]});db.audit.mockRejectedValueOnce(new Error('audit offline'));
  const result=await createWhatsAppSendApprovalTool().execute({to:'+12025550123',payload_type:'text',body:'QA'},context);
  expect(result).toMatchObject({ok:true,output:{action_id:action,status:'pending'}});
 });
 it('uses the same resolution through the real authorizer and schema validation',async()=>{
  db.query.mockResolvedValueOnce({rows:[{id:account}]}).mockResolvedValueOnce({rows:[{id:account}]}).mockResolvedValueOnce({rows:[{id:action,status:'pending'}]});
  const runtime=await createWhatsAppToolRuntime('org','agent');
  const result=await invokeWhatsAppTool(runtime,'whatsapp.send',{to:'+12025550123',payload_type:'text',body:'QA'},context);
  expect(result).toMatchObject({ok:true,output:{action_id:action}});
 });
});
