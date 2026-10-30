import {afterEach,beforeEach,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({kb:'private-mail-knowledge',normal:vi.fn(),customer:vi.fn(),actions:vi.fn(),prepare:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({query:async()=>({rows:m.kb?[{knowledge_base_id:m.kb}]:[]})}));
vi.mock('@ai-comms-agent/agent-core',()=>({agentRuntime:{createChatTurn:m.normal,createCustomerReplyTurn:m.customer}}));
vi.mock('@ai-comms-agent/email-agent-runtime',()=>({prepareAgentConfigurationTurn:m.prepare}));
vi.mock('../../worker/src/agent/product-action-executor',()=>({executeProductActions:m.actions}));
import {dispatchAgentExecution} from '../../worker/src/agent/execution-dispatcher';
const request={executionId:'internal-execution',organizationId:'org',agentId:'agent',source:'whatsapp' as const,intent:'whatsapp.inbound_command',requestedAt:'2026-10-25T00:00:00Z',params:{message:'Hi',messageId:'internal-message-id',accountId:'internal-account-id',actions:[{type:'send_whatsapp',to:'+12025550123',body:'{{output}}'}]}};
beforeEach(()=>{
 vi.clearAllMocks();m.kb='private-mail-knowledge';
 const result=()=>({providerName:'test',model:'test',stream:(async function*(){yield 'Hi! How can I help?';})()});
 m.normal.mockImplementation(result);m.customer.mockImplementation(result);
 m.actions.mockResolvedValue([{type:'send_whatsapp',status:'pending_approval',actionId:'review'}]);
});
afterEach(()=>vi.unstubAllEnvs());
it('shares the prepared configuration with customer generation and the pending-only action boundary',async()=>{
 vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','true');const prepared={orgId:'org',agentId:'agent',kbId:m.kb,skipGrounding:true},configuration={revisionId:'frozen'};m.prepare.mockResolvedValue({agentContext:prepared,configuration});
 await dispatchAgentExecution(request);expect(m.customer.mock.calls[0]?.[0]).toBe(prepared);expect(m.actions).toHaveBeenCalledWith(expect.objectContaining({configuration}),request.params);expect(m.normal).not.toHaveBeenCalled();
});
it('drafts a customer reply from only the inbound text, without ambient mailbox retrieval or task metadata',async()=>{
 const result=await dispatchAgentExecution(request);
 expect(m.customer).toHaveBeenCalledWith(expect.objectContaining({orgId:'org',agentId:'agent'}),'Hi');
 expect(m.normal).not.toHaveBeenCalled();expect(result.actions?.[0]?.status).toBe('pending_approval');
 expect(m.actions).toHaveBeenCalledWith(expect.objectContaining({output:'Hi! How can I help?'}),request.params);
});
it('does not require a mailbox knowledge base to draft an inbound greeting',async()=>{
 m.kb='';const result=await dispatchAgentExecution(request);expect(result.status).toBe('completed');expect(m.customer).toHaveBeenCalledTimes(1);
});
it('preserves the existing knowledge-backed task path for other authorized executions',async()=>{
 await dispatchAgentExecution({...request,source:'schedule',intent:'scheduled.summary'});
 expect(m.normal).toHaveBeenCalledTimes(1);expect(m.customer).not.toHaveBeenCalled();
});
it('does not claim a completed automation when a product action is denied',async()=>{
 m.actions.mockResolvedValueOnce([{type:'send_whatsapp',status:'configuration_required',reason:'Recipient grant revoked'}]);
 const result=await dispatchAgentExecution(request);
 expect(result.status).toBe('configuration_required');expect(result.reason).toBe('Recipient grant revoked');
 expect(result.actions?.[0]?.status).toBe('configuration_required');
});
