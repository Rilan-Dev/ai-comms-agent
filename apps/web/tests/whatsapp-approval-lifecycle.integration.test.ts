import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {beforeAll,afterAll,beforeEach,describe,it,expect,vi} from 'vitest';
import {query,closePostgresPool} from '../../../packages/db/src/client';
import {createWhatsAppSendApprovalTool} from '../../worker/src/agent/whatsapp-tool-runtime';
import {POST as decide} from '../src/app/api/whatsapp/send-actions/decision/route';
import type {ToolContext} from '@ai-comms-agent/shared';

const controls=vi.hoisted(()=>({audit:vi.fn(),components:[{type:'BODY',text:'Hello {{1}}'}] as unknown[],metaStatus:'APPROVED'}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:APPROVER}}),authorizationErrorToResponse:()=>Response.json({error:'request_failed'},{status:500})}));
vi.mock('@ai-comms-agent/db',async()=>({
 ...await vi.importActual('../../../packages/db/src/actions/current-authorization'),
 ...await vi.importActual('../../../packages/db/src/client'),
 ...await vi.importActual('../../../packages/db/src/messaging/whatsapp-repository'),
 recordAuditEvent:controls.audit,parseCredentialsMasterKey:()=>new Uint8Array(32),loadWhatsAppCredential:async()=>({access_token:'stub-token'}),
 PostgresAgentRepository:class{async policy(){return {allowedTools:['whatsapp.send']};}},
}));
const url=process.env.ACA_TEST_DATABASE_URL,parsed=url?new URL(url):null;
if(!parsed||!['localhost','127.0.0.1'].includes(parsed.hostname)||parsed.pathname!=='/aca_repair_test')throw new Error('Dedicated loopback aca_repair_test database required');
process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';process.env.CREDENTIALS_MASTER_KEY='test-only';
const pg=createRequire(new URL('../../../packages/db/package.json',import.meta.url))('pg');
const db=new pg.Client({connectionString:url});
const ORG=randomUUID(),USER=randomUUID(),APPROVER=randomUUID(),AGENT=randomUUID(),ACCOUNT=randomUUID();
const context:ToolContext={organization_id:ORG,agent_id:AGENT,user_id:USER,conversation_id:randomUUID(),turn_id:randomUUID(),correlation_id:randomUUID(),channel:'chat',auth_subject:{user_id:USER,role:'owner',permissions:['whatsapp.send']}};
beforeAll(async()=>{
 await db.connect();await db.query(`DROP SCHEMA IF EXISTS aca CASCADE;CREATE SCHEMA aca;SET search_path=aca,public;
 CREATE TABLE agents(id uuid,organization_id uuid,status text NOT NULL DEFAULT 'active');
 CREATE TABLE users(id uuid PRIMARY KEY,status text NOT NULL DEFAULT 'active',deleted_at timestamptz);
 CREATE TABLE agent_policies(agent_id uuid,allowed_tools text[]);
 CREATE TABLE organization_memberships(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,status text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
 CREATE TABLE whatsapp_accounts(id uuid PRIMARY KEY,organization_id uuid,phone_number_id text,business_account_id text,display_name text,phone_number text,status text,deleted_at timestamptz);
 CREATE TABLE agent_whatsapp_accounts(agent_id uuid,whatsapp_account_id uuid);
 CREATE TABLE whatsapp_templates(organization_id uuid,whatsapp_account_id uuid,name text,language text,status text,components jsonb,provider_template_id text,last_synced_at timestamptz,updated_at timestamptz);
 CREATE TABLE whatsapp_send_actions(id uuid DEFAULT gen_random_uuid() PRIMARY KEY,organization_id uuid,whatsapp_account_id uuid,agent_id uuid,agent_binding_required boolean,requested_by uuid,recipient_phone text,message_body text,payload_type text,template_name text,template_language text,template_parameters jsonb,status text,idempotency_key text,correlation_id uuid,expires_at timestamptz DEFAULT now()+interval '30 minutes',approved_by uuid,approved_at timestamptz,queued_message_id uuid,updated_at timestamptz DEFAULT now());
 CREATE UNIQUE INDEX whatsapp_actions_idempotency ON whatsapp_send_actions(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
 CREATE TABLE whatsapp_contacts(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,whatsapp_account_id uuid,phone_number text,display_name text,provider_contact_id text,last_interaction_at timestamptz,UNIQUE(whatsapp_account_id,phone_number));
 CREATE TABLE whatsapp_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid,whatsapp_account_id uuid,contact_id uuid,direction text,message_type text,body text,media jsonb,status text,idempotency_key text,correlation_id uuid,provider_timestamp timestamptz,created_at timestamptz DEFAULT now());
 CREATE UNIQUE INDEX whatsapp_messages_idempotency ON whatsapp_messages(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;`);
 await db.query('INSERT INTO aca.agents(id,organization_id) VALUES($1,$2)',[AGENT,ORG]);
 await db.query('INSERT INTO aca.users(id) VALUES($1),($2)',[USER,APPROVER]);
 await db.query("INSERT INTO aca.organization_memberships(organization_id,user_id,role,status) VALUES($1,$2,'owner','active'),($1,$3,'owner','active')",[ORG,USER,APPROVER]);
 await db.query("INSERT INTO aca.whatsapp_accounts VALUES($1,$2,'phone','business','QA Phone','+15555555555','connected',NULL)",[ACCOUNT,ORG]);
});
afterAll(async()=>{await closePostgresPool();await db.end();vi.unstubAllGlobals();});
beforeEach(async()=>{
 vi.clearAllMocks();controls.audit.mockResolvedValue(undefined);controls.metaStatus='APPROVED';controls.components=[{type:'BODY',text:'Hello {{1}}'}];
 await db.query("UPDATE aca.organization_memberships SET status='active'");
 await db.query('TRUNCATE aca.agent_policies');await db.query("INSERT INTO aca.agent_policies VALUES($1,ARRAY['whatsapp.send'])",[AGENT]);
 await db.query('TRUNCATE aca.whatsapp_send_actions,aca.whatsapp_messages,aca.whatsapp_contacts,aca.whatsapp_templates,aca.agent_whatsapp_accounts');
 await db.query('INSERT INTO aca.agent_whatsapp_accounts VALUES($1,$2)',[AGENT,ACCOUNT]);
 await db.query("INSERT INTO aca.whatsapp_templates(organization_id,whatsapp_account_id,name,language,status,components) VALUES($1,$2,'qa','en_US','approved',$3)",[ORG,ACCOUNT,JSON.stringify(controls.components)]);
 vi.stubGlobal('fetch',vi.fn(async()=>Response.json({data:[{id:'meta-template',name:'qa',language:'en_US',status:controls.metaStatus,components:controls.components}]})));
});
async function propose(body='QA body',key?:string,template=false){
 const result=await createWhatsAppSendApprovalTool().execute({to:'+12025550123',payload_type:template?'template':'text',body,template_name:template?'qa':undefined,template_language:template?'en_US':undefined,template_parameters:template?['QA']:undefined,},{...context,turn_id:key??randomUUID()});
 if(!result.ok||!result.output)throw new Error(result.error?.code);return result.output.action_id;
}
function decision(id:string,value='approve'){return decide(new Request('https://qa.local/api/whatsapp/send-actions/decision',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({organizationId:ORG,actionId:id,decision:value})}));}
async function outboundCount(){return Number((await query<{count:string}>("SELECT count(*) FROM whatsapp_messages WHERE direction='outbound'")).rows[0]?.count);}
async function inbound(offset:string){
 const contact=await query<{id:string}>("INSERT INTO whatsapp_contacts(organization_id,whatsapp_account_id,phone_number) VALUES($1,$2,'+12025550123') RETURNING id",[ORG,ACCOUNT]);
 await query("INSERT INTO whatsapp_messages(organization_id,whatsapp_account_id,contact_id,direction,provider_timestamp) VALUES($1,$2,$3,'inbound',now()+$4::interval)",[ORG,ACCOUNT,contact.rows[0]!.id,offset]);
}
describe('PostgreSQL WhatsApp approval lifecycle',()=>{
 it('persists exact AI proposals, distinct turns, and no queued send before approval',async()=>{
  const first=await propose('First QA body'),second=await propose('Second QA body');expect(first).not.toBe(second);
  expect((await query('SELECT message_body FROM whatsapp_send_actions ORDER BY message_body')).rows).toEqual([{message_body:'First QA body'},{message_body:'Second QA body'}]);expect(await outboundCount()).toBe(0);
 });
 it('reconciles identical retries and refuses changed content under the same key',async()=>{
  const first=await propose('Exact QA',context.turn_id);expect(await propose('Exact QA',context.turn_id)).toBe(first);await expect(propose('Changed QA',context.turn_id)).rejects.toThrow('idempotency_conflict');
 });
 it('rejects without queueing or contacting Meta',async()=>{
  const response=await decision(await propose(),'reject');expect(response.status).toBe(200);expect(await outboundCount()).toBe(0);expect(fetch).not.toHaveBeenCalled();
 });
 it.each(['-24 hours -1 second','1 minute'])('blocks a free-form request with inbound timestamp %s',async offset=>{
  await inbound(offset);const response=await decision(await propose());expect(response.status).toBe(409);expect((await response.json()).error).toBe('template_required');expect(await outboundCount()).toBe(0);
 });
 it('blocks no-inbound sends and permits a current inbound window exactly once',async()=>{
  expect((await decision(await propose())).status).toBe(409);await inbound('-23 hours 59 minutes');const id=await propose('Allowed test');
  expect((await decision(id)).status).toBe(202);expect((await decision(id)).status).toBe(200);expect(await outboundCount()).toBe(1);expect(fetch).not.toHaveBeenCalled();
 });
 it('rechecks a revoked binding before approval',async()=>{
  const id=await propose();await query('DELETE FROM agent_whatsapp_accounts');expect((await decision(id)).status).toBe(409);expect(await outboundCount()).toBe(0);
 });
 it.each(['requester','tool'])('revoked %s authorization blocks WhatsApp approval before Meta access',async(change)=>{
  const id=await propose('Template QA',undefined,true);
  if(change==='requester')await db.query("UPDATE aca.organization_memberships SET status='suspended' WHERE user_id=$1",[USER]);
  if(change==='tool')await db.query("UPDATE aca.agent_policies SET allowed_tools='{}'");
  const response=await decision(id);expect(response.status).toBe(409);expect(await outboundCount()).toBe(0);expect(fetch).not.toHaveBeenCalled();
 });
 it('queues a currently approved template once without claiming recipient delivery',async()=>{
  const id=await propose('Template QA',undefined,true);const response=await decision(id);expect(response.status).toBe(202);expect((await response.json()).status).toBe('queued');
  expect((await decision(id)).status).toBe(200);expect(await outboundCount()).toBe(1);expect(fetch).toHaveBeenCalledTimes(1);
 });
 it('rechecks current Meta template approval',async()=>{
  const id=await propose('Template QA',undefined,true);controls.metaStatus='PENDING';const response=await decision(id);expect((await response.json()).error).toBe('template_not_approved');expect(await outboundCount()).toBe(0);
 });
 it('blocks parameters that no longer match the current template',async()=>{
  const id=await propose('Template QA',undefined,true);controls.components=[{type:'BODY',text:'Hello {{1}} {{2}}'}];const response=await decision(id);expect((await response.json()).error).toBe('template_parameter_mismatch');expect(await outboundCount()).toBe(0);
 });
 it('retains queued acceptance when secondary audit storage fails',async()=>{
  const id=await propose('Template QA',undefined,true);controls.audit.mockRejectedValueOnce(new Error('audit offline'));
  const response=await decision(id);expect(response.status).toBe(202);expect(await outboundCount()).toBe(1);
 });
});
