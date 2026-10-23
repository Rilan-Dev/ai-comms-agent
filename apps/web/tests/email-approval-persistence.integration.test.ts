import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeAll, afterAll, beforeEach, describe, it, expect, vi } from 'vitest';
import { createEmailAction, listPendingEmailActionsForOrganization, decideEmailAction,
  claimApprovedEmailAction, completeEmailAction, EmailActionIdempotencyConflictError } from '../../../packages/db/src/email/actions';
import { closePostgresPool } from '../../../packages/db/src/client';
import { executeApprovedEmailAction } from '../../worker/src/email/action-executor';
import { POST as requestApproval } from '../src/app/api/mail/actions/route';

const transport = vi.hoisted(()=>({
 status:'connected', provider:'gmail',
 connect:vi.fn(async()=>{}),disconnect:vi.fn(async()=>{}),
 discoverCapabilities:vi.fn(async()=>({drafts:true,send:true})),
 createDraft:vi.fn(async()=>({draft_id:'provider-test-draft'})),
 sendDraft:vi.fn(async()=>({message_id:'test-message',provider_message_id:'test-provider-id'})),
}));
const audit=vi.hoisted(()=>vi.fn(async()=>{}));
vi.mock('@/lib/identity/local-auth',()=>({assertSameOrigin:()=>{}}));
vi.mock('@/lib/identity/repository',()=>({ensureDevSeed:async()=>{},getIdentityAdapter:()=>({}),getIdentityRepository:()=>({})}));
vi.mock('@/lib/identity/authorization',()=>({authorize:async()=>({user:{id:USER}}),authorizationErrorToResponse:()=>Response.json({error:'request_failed'},{status:500})}));
vi.mock('../../worker/src/email/registry',()=>({createEmailProviderRegistry:()=>({create:()=>transport})}));
vi.mock('@ai-comms-agent/db',async()=>({
 ...await vi.importActual('../../../packages/db/src/email/actions'),
 ...await vi.importActual('../../../packages/db/src/identity/supabase'),
 recordAuditEvent:audit,
 parseCredentialsMasterKey:()=>new Uint8Array(32),
 PostgresEmailAccountRepository:class {
  async getById(){return {id:ACCOUNT,organization_id:ORG,status:transport.status,provider:transport.provider};}
  async loadCredentials(){return {};}
  async getConnectionConfig(){return {};}
 },
 getMailMessageForOrganization:async(org:string,id:string)=>(await db.query('SELECT * FROM aca.email_messages WHERE organization_id=$1 AND id=$2',[org,id])).rows[0],
 markLocalDraftSentForOrganization:async()=>{},
}));

const url = process.env.ACA_TEST_DATABASE_URL;
const parsed = url ? new URL(url) : null;
if (!parsed || !['127.0.0.1','localhost'].includes(parsed.hostname) || parsed.pathname !== '/aca_repair_test') {
  throw new Error('Set ACA_TEST_DATABASE_URL to the dedicated local aca_repair_test database; production targets are refused.');
}
process.env.DATABASE_URL = url;
process.env.DATABASE_SSL = 'false';
process.env.CREDENTIALS_MASTER_KEY = 'test-only-key';
const pg = createRequire(new URL('../../../packages/db/package.json', import.meta.url))('pg');
const db = new pg.Client({ connectionString: url });
const ORG=randomUUID(), OTHER=randomUUID(), USER=randomUUID(), ACCOUNT=randomUUID(), AGENT=randomUUID();
const migration=resolve(__dirname,'../../../supabase/migrations/0055_email_approval_runtime_reconciliation.sql');

// Reproduce the deployed legacy columns, including constraints that current
// manual/AI inserts cannot satisfy. The test exercises real PostgreSQL locks,
// enums and persistence, not a mock of the failing boundary.
const fixture=`CREATE SCHEMA aca; SET search_path=aca,public;
CREATE TABLE organizations(id uuid PRIMARY KEY); CREATE TABLE users(id uuid PRIMARY KEY);
CREATE TABLE agents(id uuid PRIMARY KEY); CREATE TABLE email_accounts(id uuid PRIMARY KEY);
CREATE TABLE organization_memberships(id uuid DEFAULT gen_random_uuid(),organization_id uuid,user_id uuid,role text,status text,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE email_messages(id uuid PRIMARY KEY,organization_id uuid,email_account_id uuid,is_draft boolean,
to_recipients jsonb,cc_recipients jsonb,bcc_recipients jsonb,subject text,text_body text);
CREATE TYPE action_status AS ENUM('pending_approval','approved','rejected','completed','failed','expired','executing');
CREATE TYPE approval_decision AS ENUM('approved','rejected');
CREATE TABLE email_actions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),organization_id uuid NOT NULL REFERENCES organizations,
agent_id uuid NOT NULL REFERENCES agents,action_type text NOT NULL,target jsonb NOT NULL,
status action_status NOT NULL DEFAULT 'pending_approval',requested_by uuid REFERENCES users,requested_at timestamptz NOT NULL DEFAULT now(),
expires_at timestamptz,completed_at timestamptz,error text,metadata jsonb DEFAULT '{}',email_account_id uuid REFERENCES email_accounts,
draft_id uuid REFERENCES email_messages,approved_by uuid REFERENCES users,approved_at timestamptz,result jsonb NOT NULL DEFAULT '{}',
correlation_id uuid,idempotency_key text);
CREATE UNIQUE INDEX email_actions_org_idempotency_uniq ON email_actions(organization_id,idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE TABLE email_action_approvals(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),action_id uuid NOT NULL REFERENCES email_actions,
approver_id uuid NOT NULL REFERENCES users,decision approval_decision NOT NULL,reason text,decided_at timestamptz DEFAULT now(),
decided_by uuid,organization_id uuid,created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(action_id,approver_id));`;

beforeAll(async()=>{
  await db.connect(); await db.query('DROP SCHEMA IF EXISTS aca CASCADE'); await db.query(fixture);
  if (existsSync(migration)) await db.query(readFileSync(migration,'utf8'));
  await db.query('INSERT INTO organizations VALUES($1),($2)',[ORG,OTHER]);
  await db.query('INSERT INTO users VALUES($1)',[USER]);
  await db.query('INSERT INTO agents VALUES($1)',[AGENT]);
  await db.query('INSERT INTO email_accounts VALUES($1)',[ACCOUNT]);
  await db.query(`INSERT INTO organization_memberships(organization_id,user_id,role,status) VALUES($1,$2,'owner','active')`,[ORG,USER]);
});
afterAll(async()=>{await closePostgresPool(); await db.end();});
beforeEach(async()=>{vi.clearAllMocks();transport.status='connected';await db.query(`UPDATE aca.organization_memberships SET status='active',role='owner'`);await db.query('TRUNCATE aca.email_action_approvals,aca.email_actions,aca.email_messages');});

async function draft(){
 const id=randomUUID(); await db.query(`INSERT INTO aca.email_messages VALUES($1,$2,$3,true,'["qa@example.com"]','[]','[]','QA test','Harmless test')`,[id,ORG,ACCOUNT]);
 return {organizationId:ORG,emailAccountId:ACCOUNT,actionType:'send_email' as const,draftId:id,
  recipientSnapshot:{to:['qa@example.com'],cc:[],bcc:[],subject:'QA test',bodyText:'Harmless test'},requestedBy:USER};
}

describe('real PostgreSQL email approval lifecycle',()=>{
 it('manual approval persists and appears in the same organization queue',async()=>{
  const input=await draft(); const action=await createEmailAction(input);
  expect(action.status).toBe('pending_approval'); expect(action.draftId).toBe(input.draftId);
  const queue=await listPendingEmailActionsForOrganization(ORG);
  expect(queue.map(row=>row.id)).toEqual([action.id]); expect(queue[0]?.recipientSnapshot).toEqual(input.recipientSnapshot);
  expect(await listPendingEmailActionsForOrganization(OTHER)).toEqual([]);
 });
 it('AI approval retains the requesting agent and actor',async()=>{
  const action=await createEmailAction({...await draft(),agentId:AGENT});
  expect(action.agentId).toBe(AGENT); expect(action.requestedBy).toBe(USER);
 });
 it('manual route returns the persisted request even when its secondary audit write fails',async()=>{
  const input=await draft();audit.mockRejectedValueOnce(new Error('audit unavailable'));
  const response=await requestApproval(new Request('https://test.local/api/mail/actions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,expectedSnapshot:input.recipientSnapshot})}));
  expect(response.status).toBe(201);
  const body=await response.json();
  const queue=await listPendingEmailActionsForOrganization(ORG);
  expect(queue.map(row=>row.id)).toEqual([body.action.id]);
  expect(body.status).toBe('pending_approval');
  expect(transport.sendDraft).not.toHaveBeenCalled();
 });
 it('concurrent identical requests reuse one pending review',async()=>{
  const input={...await draft(),agentId:AGENT,idempotencyKey:'same-review'};
  const actions=await Promise.all([createEmailAction(input),createEmailAction(input)]);
  expect(actions[0].id).toBe(actions[1].id); expect(await listPendingEmailActionsForOrganization(ORG)).toHaveLength(1);
 });
 it('changed reviewed content is rejected without creating an action',async()=>{
  const input=await draft(); input.recipientSnapshot.bodyText='Stale review';
  await expect(createEmailAction(input)).rejects.toBeInstanceOf(EmailActionIdempotencyConflictError);
  expect(await listPendingEmailActionsForOrganization(ORG)).toEqual([]);
 });
 it('approval records the decision and permits only one worker claim',async()=>{
  const action=await createEmailAction(await draft());
  expect(await decideEmailAction(OTHER,action.id,USER,'approved')).toBeNull();
  expect((await decideEmailAction(ORG,action.id,USER,'approved'))?.status).toBe('approved');
  const decisions=await db.query('SELECT email_action_id,decided_by,decision FROM aca.email_action_approvals');
  expect(decisions.rows).toEqual([{email_action_id:action.id,decided_by:USER,decision:'approved'}]);
  const claims=await Promise.all([claimApprovedEmailAction(action.id,ORG),claimApprovedEmailAction(action.id,ORG)]);
  expect(claims.filter(Boolean)).toHaveLength(1);
  expect((await completeEmailAction(action.id,ORG,'completed',{providerMessageId:'test-only'}))?.status).toBe('completed');
  expect(await decideEmailAction(ORG,action.id,USER,'approved')).toBeNull();
 });
 it('rejected or expired requests can never be claimed by the worker',async()=>{
  const rejected=await createEmailAction(await draft());
  expect((await decideEmailAction(ORG,rejected.id,USER,'rejected'))?.status).toBe('rejected');
  expect(await claimApprovedEmailAction(rejected.id,ORG)).toBeNull();
  const expired=await createEmailAction({...await draft(),expiresAt:'2000-01-01T00:00:00Z'});
  expect(await decideEmailAction(ORG,expired.id,USER,'approved')).toBeNull();
  expect(await claimApprovedEmailAction(expired.id,ORG)).toBeNull();
 });
 it.each(['gmail','imap_smtp'])('executes one reviewed snapshot through the %s transport only after human approval',async(provider)=>{
  transport.provider=provider;
  const input=await draft();const action=await createEmailAction(input);
  await expect(executeApprovedEmailAction(action.id,ORG)).rejects.toThrow(/not approved/);
  expect(transport.sendDraft).not.toHaveBeenCalled();
  await decideEmailAction(ORG,action.id,USER,'approved');
  await db.query(`UPDATE aca.email_messages SET text_body='Unreviewed later edit' WHERE id=$1`,[input.draftId]);
  const result=await executeApprovedEmailAction(action.id,ORG);
  expect(result.status).toBe('completed');
  expect(transport.createDraft).toHaveBeenCalledWith(expect.objectContaining({body_text:'Harmless test',to:['qa@example.com']}));
  expect(transport.sendDraft).toHaveBeenCalledTimes(1);
  await expect(executeApprovedEmailAction(action.id,ORG)).rejects.toThrow(/not approved/);
  expect(transport.sendDraft).toHaveBeenCalledTimes(1);
 });
 it('a mailbox revoked after review cannot reach the provider',async()=>{
  const action=await createEmailAction(await draft());await decideEmailAction(ORG,action.id,USER,'approved');
  transport.status='revoked';
  await expect(executeApprovedEmailAction(action.id,ORG)).rejects.toThrow(/account is unavailable/);
  expect(transport.connect).not.toHaveBeenCalled();expect(transport.sendDraft).not.toHaveBeenCalled();
 });
 it('revoked membership after approval prevents provider execution',async()=>{
  const action=await createEmailAction(await draft());await decideEmailAction(ORG,action.id,USER,'approved');
  await db.query(`UPDATE aca.organization_memberships SET status='suspended' WHERE user_id=$1`,[USER]);
  await expect(executeApprovedEmailAction(action.id,ORG)).rejects.toThrow(/authorization is no longer valid/);
  expect(transport.connect).not.toHaveBeenCalled();expect(transport.sendDraft).not.toHaveBeenCalled();
 });
 it('the forward reconciliation is safe to rerun',async()=>{
  expect(existsSync(migration)).toBe(true);
  await db.query(readFileSync(migration,'utf8'));
  expect((await createEmailAction(await draft())).status).toBe('pending_approval');
 });
 it('preserves legacy review history and does not rewrite canonical decision timestamps on rerun',async()=>{
  try {
   await db.query('DROP SCHEMA IF EXISTS aca_history_test CASCADE');
   await db.query(fixture.replace('CREATE SCHEMA aca; SET search_path=aca,public;', 'CREATE SCHEMA aca_history_test; SET search_path=aca_history_test,public;'));
   await db.query('INSERT INTO organizations VALUES($1)',[ORG]);
   await db.query('INSERT INTO users VALUES($1)',[USER]);
   await db.query('INSERT INTO agents VALUES($1)',[AGENT]);
   const id=randomUUID();
   await db.query(`INSERT INTO email_actions(id,organization_id,agent_id,action_type,target,status) VALUES($1,$2,$3,'send_email','{"legacy":true}','completed')`,[id,ORG,AGENT]);
   await db.query(`INSERT INTO email_action_approvals(action_id,approver_id,decision,reason,decided_at) VALUES($1,$2,'approved','Reviewed by owner','2026-01-02T03:04:05Z')`,[id,USER]);
   await db.query(readFileSync(migration,'utf8'));
   let review=(await db.query('SELECT * FROM email_action_approvals')).rows[0];
   expect(review).toMatchObject({email_action_id:id,organization_id:ORG,decided_by:USER,comment:'Reviewed by owner'});
   expect(review.created_at.toISOString()).toBe('2026-01-02T03:04:05.000Z');
   await db.query(`UPDATE email_action_approvals SET created_at='2026-02-03T04:05:06Z'`);
   await db.query(readFileSync(migration,'utf8'));
   review=(await db.query('SELECT * FROM email_action_approvals')).rows[0];
   expect(review.created_at.toISOString()).toBe('2026-02-03T04:05:06.000Z');
   expect((await db.query('SELECT status,target FROM email_actions')).rows).toEqual([{status:'completed',target:{legacy:true}}]);
  } finally {await db.query('SET search_path=aca,public');}
 });
});
