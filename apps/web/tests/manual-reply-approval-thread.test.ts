import {it,expect,vi,afterEach} from 'vitest';
const m=vi.hoisted(()=>({create:vi.fn(),basic:vi.fn(),draft:vi.fn(),audit:vi.fn(async()=>{})}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:'owner'}}),authorizationErrorToResponse:()=>Response.json({error:'failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',()=>({createEmailAction:m.create,getMailMessageForOrganization:m.basic,getLocalDraftForOrganization:m.draft,recordAuditEvent:m.audit,query:vi.fn(),decideEmailAction:vi.fn(),getEmailActionForOrganization:vi.fn(),assertCurrentEmailActionAuthorization:vi.fn(),ActionAuthorizationRevokedError:class extends Error{},EmailActionIdempotencyConflictError:class extends Error{}}));
import {POST} from '../src/app/api/mail/actions/route';
afterEach(()=>{vi.unstubAllEnvs();vi.clearAllMocks();});
it('requests review with original provider threading metadata instead of a conflicting generic-message snapshot',async()=>{
 vi.stubEnv('DATABASE_URL','test-only');
 const draft={id:'draft',organization_id:'10000000-0000-4000-8000-000000000001',email_account_id:'account',is_draft:true,to_recipients:['qa@example.test'],cc_recipients:[],bcc_recipients:[],subject:'Re: QA',text_body:'Test reply',in_reply_to:'<source@example.test>',references_header:'<source@example.test>'};
 m.basic.mockResolvedValue(draft);m.draft.mockResolvedValue({...draft,reply_provider_thread_id:'provider-thread'});
 m.create.mockImplementation(async(input:{recipientSnapshot:Record<string,unknown>})=>{
  if(input.recipientSnapshot.providerThreadId!=='provider-thread')throw Error('Snapshot does not match locked reply draft');
  return {id:'action',status:'pending_approval'};
 });
 const response=await POST(new Request('https://example.test/api/mail/actions',{method:'POST',headers:{origin:'https://example.test','content-type':'application/json'},body:JSON.stringify({organizationId:draft.organization_id,emailAccountId:'account',actionType:'send_email',draftId:'draft',expectedSnapshot:{to:draft.to_recipients,cc:[],bcc:[],subject:draft.subject,bodyText:draft.text_body}})}));
 expect(response.status).toBe(201);expect((await response.json()).status).toBe('pending_approval');
 expect(m.create.mock.calls[0]?.[0].recipientSnapshot).toMatchObject({providerThreadId:'provider-thread',inReplyTo:'<source@example.test>',bodyText:'Test reply'});
});
