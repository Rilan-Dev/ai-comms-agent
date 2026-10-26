import {beforeEach,describe,expect,it,vi} from 'vitest';
const mock=vi.hoisted(()=>({query:vi.fn(),user:vi.fn(),membership:vi.fn(),permissions:vi.fn()}));
vi.mock('../../../packages/db/src/client',()=>({query:mock.query}));
vi.mock('../../../packages/db/src/identity/supabase',()=>({PostgresIdentityRepository:class{getUserById=mock.user;getMembership=mock.membership;getPermissionsForRole=mock.permissions;}}));
import {assertCurrentEmailActionAuthorization,assertCurrentWhatsAppActionAuthorization,assertCurrentAgentToolAuthorization} from '../../../packages/db/src/actions/current-authorization';
const email={organizationId:'org',emailAccountId:'mail',agentId:'agent',actionType:'send_email',requestedBy:'requester',approvedBy:'approver'};
const whatsapp={organizationId:'org',accountId:'phone',agentId:'agent',bindingRequired:true,requestedBy:'requester',approvedBy:'approver'};
beforeEach(()=>{vi.clearAllMocks();mock.user.mockResolvedValue({status:'active'});mock.membership.mockResolvedValue({status:'active',role:'owner'});mock.permissions.mockResolvedValue(['email.write','organization.update','whatsapp.send']);mock.query.mockImplementation(async(sql:string)=>sql.includes('agent_policies')?{rows:[{allowed_tools:['email.send.request','whatsapp.send'],security_policy:{autonomous_send:true}}]}:sql.includes('agent_email_accounts')||sql.includes('agent_whatsapp_accounts')?{rows:[{role:'primary',agent_status:'active'}]}:{rows:[{id:'mail'}]});});
describe('current dispatch after governed configuration changes',()=>{
 it('permits a tool only under the current actor grant and matching revocation generation',async()=>{
  mock.permissions.mockResolvedValue(['email.read']);mock.query.mockResolvedValue({rows:[{status:'active',revocation_generation:2}]});
  await expect(assertCurrentAgentToolAuthorization({organizationId:'org',agentId:'agent',userId:'requester',revocationGeneration:2},'email.read')).resolves.toBeUndefined();
  await expect(assertCurrentAgentToolAuthorization({organizationId:'org',agentId:'agent',userId:'requester',revocationGeneration:1},'email.read')).rejects.toThrow('authorization');
 });
 it('does not let a long-running read retain a revoked membership permission',async()=>{
  mock.permissions.mockResolvedValue([]);mock.query.mockResolvedValue({rows:[{status:'active',revocation_generation:0}]});
  await expect(assertCurrentAgentToolAuthorization({organizationId:'org',agentId:'agent',userId:'requester',revocationGeneration:0},'email.read')).rejects.toThrow('authorization');
 });
 it('requires an active agent and a real actor for configuration-bound tools',async()=>{
  mock.permissions.mockResolvedValue(['email.read']);mock.query.mockResolvedValue({rows:[{status:'paused',revocation_generation:0}]});
  await expect(assertCurrentAgentToolAuthorization({organizationId:'org',agentId:'agent',userId:'requester',revocationGeneration:0},'email.read')).rejects.toThrow('authorization');
  await expect(assertCurrentAgentToolAuthorization({organizationId:'org',agentId:'agent',userId:null,revocationGeneration:0},'email.read')).rejects.toThrow('authorization');
 });
 it('allows an active authorized human-approved action and keeps manual agent-free sends available',async()=>{await expect(assertCurrentEmailActionAuthorization(email)).resolves.toBeUndefined();await expect(assertCurrentEmailActionAuthorization({...email,agentId:null})).resolves.toBeUndefined();});
 it.each(['suspended','disabled','deleted'])('rejects requester account status %s before provider dispatch',async status=>{mock.user.mockResolvedValue({status});await expect(assertCurrentEmailActionAuthorization(email)).rejects.toThrow('authorization');await expect(assertCurrentWhatsAppActionAuthorization(whatsapp)).rejects.toThrow('authorization');});
 it('rejects a missing current requester even with an old active membership',async()=>{mock.user.mockResolvedValue(null);await expect(assertCurrentEmailActionAuthorization(email)).rejects.toThrow('authorization');});
 it('rechecks the human approver current account as well as membership',async()=>{mock.user.mockImplementation(async id=>id==='approver'?{status:'suspended'}:{status:'active'});await expect(assertCurrentEmailActionAuthorization(email)).rejects.toThrow('authorization');});
 it.each(['paused','draft','archived'])('blocks queued agent sends after lifecycle changes to %s',async status=>{mock.query.mockImplementation(async(sql:string)=>sql.includes('agent_policies')?{rows:[{allowed_tools:['email.send.request','whatsapp.send'],security_policy:{autonomous_send:true}}]}:sql.includes('agent_email_accounts')||sql.includes('agent_whatsapp_accounts')?{rows:[{role:'primary',agent_status:status}]}:{rows:[{id:'mail'}]});await expect(assertCurrentEmailActionAuthorization(email)).rejects.toThrow('authorization');await expect(assertCurrentWhatsAppActionAuthorization(whatsapp)).rejects.toThrow('authorization');});
});
