import {beforeEach,describe,expect,it,vi} from 'vitest';
const db=vi.hoisted(()=>({query:vi.fn()}));
vi.mock('@ai-comms-agent/db',()=>({query:db.query}));
import {loadWorkflow,replaceWorkflow,createWhatsAppWorkflow,reconcileWorkflow} from '../src/lib/chat/whatsapp-workflow-store';
const scope={organizationId:'org',agentId:'agent',conversationId:'conversation',userId:'owner'};
const widget={version:1 as const,kind:'whatsapp_workflow' as const,revision:0,ownerId:'owner',turnId:'turn',reference:'ref',recipient:'',body:'',status:'draft' as const,accountId:null,accountLabel:null,readiness:null,actionId:null,expiresAt:'2099-01-01T00:00:00Z',notice:''};
beforeEach(()=>vi.resetAllMocks());
describe('durable WhatsApp workflow ownership and revision',()=>{
 it('denies a different creator even inside the same conversation',async()=>{
  db.query.mockResolvedValue({rows:[{content_json:{ui:{...widget,ownerId:'other'}}}]});
  expect(await loadWorkflow(scope,'message')).toBeNull();
 });
 it('scopes lookup to organization, agent, conversation and assistant messages',async()=>{
  db.query.mockResolvedValue({rows:[{content_json:{ui:widget}}]});
  expect(await loadWorkflow(scope,'message')).toEqual(widget);
  const [sql,params]=db.query.mock.calls[0]!;
  expect(params).toEqual(['org','agent','conversation','message']);
  expect(sql).toContain('c.organization_id=$1');expect(sql).toContain('c.agent_id=$2');expect(sql).toContain("m.role='assistant'");
 });
 it('returns conflict when another action already changed the saved revision',async()=>{
  db.query.mockResolvedValue({rows:[]});
  expect(await replaceWorkflow(scope,'message',widget,{...widget,status:'review'})).toBeNull();
  expect(db.query.mock.calls[0]![0]).toContain("content_json->'ui'->>'revision'");
 });
 it('does not extract an email question as literal WhatsApp message content',async()=>{
  db.query.mockResolvedValue({rows:[{id:'saved'}]});
  const result=await createWhatsAppWorkflow(scope,'Try to send How many unread emails do I have? Message from whatsapp to +919629534701','ref','turn');
  expect(result.widget.recipient).toBe('+919629534701');expect(result.widget.body).toBe('');
 });
 it('reconciles a persisted approval and never invokes another send',async()=>{
  db.query.mockResolvedValue({rows:[{id:'action',status:'pending',expires_at:'2099-01-01',recipient_phone:'+919629534701',message_body:'Hi',whatsapp_account_id:'phone'}]});
  const current=await reconcileWorkflow(scope,{...widget,status:'unknown'});
  expect(current.status).toBe('pending');expect(current.actionId).toBe('action');expect(current.body).toBe('Hi');
 });
 it('keeps an interrupted creation uncertain when no saved action is found',async()=>{
  db.query.mockResolvedValue({rows:[]});
  expect((await reconcileWorkflow(scope,{...widget,status:'requesting'})).status).toBe('unknown');
 });
});
