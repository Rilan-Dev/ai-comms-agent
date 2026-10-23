import {describe,it,expect,vi,beforeEach,afterEach} from 'vitest';
const mocks=vi.hoisted(()=>({query:vi.fn(),audit:vi.fn(),sent:vi.fn(),failed:vi.fn(),event:vi.fn(),authorization:vi.fn(),credentials:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({
 query:mocks.query,recordAuditEvent:mocks.audit,markWhatsAppOutboundSent:mocks.sent,markWhatsAppOutboundFailed:mocks.failed,
 recoverStaleWhatsAppOutbound:async()=>[],claimQueuedWhatsAppOutbound:async()=>[{id:'message',organization_id:'org',whatsapp_account_id:'account',correlation_id:'correlation',phone_number:'+12025550123',message_type:'text',body:'Harmless QA test'}],
 getWhatsAppAccountForOrganization:async()=>({id:'account',organization_id:'org',status:'connected',phone_number_id:'phone'}),
 loadWhatsAppCredential:mocks.credentials,assertCurrentWhatsAppActionAuthorization:mocks.authorization,parseCredentialsMasterKey:()=>new Uint8Array(32),
 listPendingWhatsAppAccounts:async()=>[],updateWhatsAppAccountStatus:vi.fn(),
}));
vi.mock('../../worker/src/events/provider-events',()=>({emitProviderEvent:mocks.event}));
import {processQueuedWhatsAppMessages} from '../../worker/src/messaging/whatsapp-worker';
beforeEach(()=>{
 vi.clearAllMocks();vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('CREDENTIALS_MASTER_KEY','test-only');mocks.authorization.mockResolvedValue(undefined);mocks.credentials.mockResolvedValue({access_token:'test-token'});
 mocks.audit.mockResolvedValue(undefined);mocks.event.mockResolvedValue(undefined);mocks.sent.mockResolvedValue(true);
 mocks.query.mockImplementation(async(sql:string)=>({rows:sql.includes('SELECT id,agent_id')?[{id:'action',agent_id:'agent',agent_binding_required:true,status:'queued',requested_by:'requester',approved_by:'approver'}]:[{id:'bound-or-recent-inbound'}]}));
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({messages:[{id:'provider-message'}]})));
});
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs();});
describe('WhatsApp provider outcome integrity',()=>{
 it('records provider acceptance once without claiming recipient delivery',async()=>{
  await processQueuedWhatsAppMessages();expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.sent).toHaveBeenCalledWith('message','provider-message');
  expect(mocks.event).toHaveBeenCalledWith(expect.objectContaining({type:'whatsapp.message.sent'}));expect(mocks.failed).not.toHaveBeenCalled();
 });
 it('does not label an accepted message failed when activity logging fails',async()=>{
  mocks.audit.mockRejectedValueOnce(new Error('audit offline'));await processQueuedWhatsAppMessages();
  expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.failed).not.toHaveBeenCalled();
  expect(mocks.event).not.toHaveBeenCalledWith(expect.objectContaining({type:'whatsapp.message.failed'}));
 });
 it('preserves an unknown outcome after a provider timeout instead of marking it safe to retry',async()=>{
  vi.mocked(fetch).mockRejectedValueOnce(new Error('network timeout after dispatch'));await processQueuedWhatsAppMessages();
  expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.failed).not.toHaveBeenCalled();expect(mocks.sent).not.toHaveBeenCalled();
 });
 it('blocks authorization denial before loading credentials or contacting the provider',async()=>{
  mocks.authorization.mockRejectedValueOnce(new Error('Action authorization is no longer valid'));await processQueuedWhatsAppMessages();expect(mocks.authorization).toHaveBeenCalledWith(expect.objectContaining({organizationId:'org',accountId:'account',agentId:'agent',requestedBy:'requester',approvedBy:'approver',bindingRequired:true}));expect(mocks.credentials).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();expect(mocks.failed).toHaveBeenCalled();
 });
 it('keeps an ambiguous server error pending reconciliation without a replay',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({error:{message:'upstream unavailable'}},{status:503}));
  await processQueuedWhatsAppMessages();expect(fetch).toHaveBeenCalledTimes(1);expect(mocks.failed).not.toHaveBeenCalled();
 });
 it('retains the accepted provider ID when the database write fails',async()=>{
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  try {
   mocks.sent.mockRejectedValueOnce(new Error('database offline'));await processQueuedWhatsAppMessages();
   expect(mocks.failed).not.toHaveBeenCalled();
   expect(log).toHaveBeenCalledWith(expect.any(String),expect.objectContaining({providerMessageId:'provider-message',providerAccepted:true}));
  } finally {log.mockRestore();}
 });
 it('records a definite provider rejection as failed',async()=>{
  vi.mocked(fetch).mockResolvedValueOnce(Response.json({error:{message:'recipient rejected'}},{status:400}));
  await processQueuedWhatsAppMessages();expect(mocks.failed).toHaveBeenCalledWith('message','recipient rejected');
 });
});
