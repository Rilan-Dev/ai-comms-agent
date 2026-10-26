import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
const m=vi.hoisted(()=>({configuration:vi.fn(),current:vi.fn(),report:vi.fn(),prepare:vi.fn(),loop:vi.fn(),model:vi.fn()}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'user'},membership:{role:'owner'},permissions:new Set(['organization.read','email.read'])}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({loadActiveAgentConfiguration:m.configuration,assertCurrentAgentToolAuthorization:m.current,PostgresAgentRepository:class{async get(){return {id:'agent'};}},getVoiceSessionForOrganization:async()=>({user_id:'user',agent_id:'agent',status:'active',conversation_id:null}),incrementVoiceSessionTurnForOrganization:async()=>true,appendConversationMessage:vi.fn(),getChatConversation:vi.fn(),query:async()=>({rows:[]})}));
vi.mock('@ai-comms-agent/email-agent-runtime',()=>({prepareAgentConfigurationTurn:m.prepare,runEmailAgentTurn:m.loop,createEmailToolRuntime:async()=>({registry:{listForAgent:()=>[{name:'email.search',required_permission:'email.read'}]}})}));
vi.mock('@ai-comms-agent/clara-core',()=>({claraRuntime:{createChatTurn:m.model}}));
vi.mock('@/lib/mail/report-evidence',()=>({getMailReportEvidence:m.report,MailReportScopeError:class extends Error{}}));
import {POST} from '../src/app/api/voice/turn/route';
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('DATABASE_URL','test-only');vi.stubEnv('AGENT_CONFIGURATION_REVISIONS_ENABLED','true');m.configuration.mockResolvedValue({organizationId:'org',agentId:'agent',revisionId:'frozen',revocationGeneration:2,snapshot:{lifecycle:{status:'active'},policy:{allowedTools:['email.search']},channels:{email:[{accountId:'mail',role:'read_only'}],whatsappAccountId:null}}});m.report.mockResolvedValue({rows:[],lastSyncAt:null,matchedCount:0,includedCount:0,hasMore:false,mailboxCounts:[]});});afterEach(()=>vi.unstubAllEnvs());
describe('voice report under a frozen configuration',()=>{
 it('keeps rolling report scope frozen without requiring any model/provider operation',async()=>{
  const response=await POST(new Request('https://qa.local/api/voice/turn',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({organizationId:'org',agentId:'agent',sessionId:'session',transcript:'Summarize my unread emails from the last 24 hours'})}));
  expect(response.status).toBe(200);expect(m.report).toHaveBeenCalledWith(expect.objectContaining({readableAccountIds:['mail']}));expect(m.current).toHaveBeenCalledTimes(2);expect(m.prepare).not.toHaveBeenCalled();expect(m.model).not.toHaveBeenCalled();expect(m.loop).not.toHaveBeenCalled();
 });
});
