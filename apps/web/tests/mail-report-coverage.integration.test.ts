import {beforeAll,afterAll,beforeEach,describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {getMailReportEvidence} from '../src/lib/mail/report-evidence';
import type {MailReportScope} from '../src/lib/mail/report-evidence';
import {createEmailReadTools} from '../../../packages/email-agent-runtime/src/email-read-tools';
import type {PostgresEmailAccountRepository,PostgresAgentRepository,PostgresEmailFolderLabelRepository} from '@ai-comms-agent/db';
import type {ToolContext} from '@ai-comms-agent/shared';
import {closePostgresPool} from '../../../packages/db/src/client';
import {PostgresEmailAccountRepository as RealAccountRepository} from '../../../packages/db/src/email/repository';

const url=process.env.ACA_TEST_DATABASE_URL;
const parsed=url?new URL(url):null;
if(!parsed || !['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!='/aca_repair_test')throw new Error('Dedicated local aca_repair_test required');
process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';
const pg=createRequire(new URL('../../../packages/db/package.json',import.meta.url))('pg');
const db=new pg.Client({connectionString:url});
const org=randomUUID(),other=randomUUID(),agent=randomUUID(),account=randomUUID(),second=randomUUID(),inbox=randomUUID(),allmail=randomUUID();
const from='2026-10-22T12:00:00Z',to='2026-10-23T12:00:00Z';
beforeAll(async()=>{
 await db.connect();await db.query(`DROP SCHEMA IF EXISTS aca CASCADE;CREATE SCHEMA aca;SET search_path=aca,public;
 CREATE TABLE agents(id uuid,organization_id uuid);
 CREATE TABLE email_accounts(id uuid,organization_id uuid,email_address text,provider text,status text,deleted_at timestamptz,last_synced_at timestamptz);
 CREATE TABLE agent_email_accounts(agent_id uuid,email_account_id uuid,role text);
 CREATE TABLE email_folders(id uuid,email_account_id uuid,role text,provider_folder_id text);
 CREATE TABLE email_messages(id uuid,thread_id uuid,organization_id uuid,email_account_id uuid,folder_id uuid,internet_message_id text,provider_message_id text,from_email text,from_name text,subject text,received_at timestamptz,is_draft boolean DEFAULT false,is_sent boolean DEFAULT false,is_read boolean DEFAULT false,snippet text,text_body text,
 to_recipients jsonb DEFAULT '[]',is_starred boolean DEFAULT false,provider_draft_sync_status text,updated_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),importance_score numeric,action_required boolean DEFAULT false,labels jsonb DEFAULT '[]');
 CREATE TABLE email_attachments(message_id uuid);`);
 await db.query('INSERT INTO agents VALUES($1,$2)',[agent,org]);
 await db.query(`INSERT INTO email_accounts VALUES($1,$3,'one@example.com','imap_smtp','connected',null,$4),($2,$3,'two@example.com','gmail','connected',null,$4)`,[account,second,org,to]);
 await db.query('ALTER TABLE email_accounts ADD COLUMN display_name text');
 await db.query('ALTER TABLE email_accounts ADD COLUMN created_at timestamptz DEFAULT now()');
 await db.query(`INSERT INTO agent_email_accounts VALUES($1,$2,'primary'),($1,$3,'read_only')`,[agent,account,second]);
 await db.query(`INSERT INTO email_folders VALUES($1,$3,'custom','INBOX'),($2,$3,'custom','[Gmail]/All Mail')`,[inbox,allmail,account]);
});
beforeEach(async()=>{await db.query('TRUNCATE aca.email_messages');});
afterAll(async()=>{await closePostgresPool();await db.end();});
async function message(options:{account?:string;folder?:string;identity?:string;at?:string;draft?:boolean;sent?:boolean;tenant?:string;read?:boolean}={}){
 const id=randomUUID();
 await db.query(`INSERT INTO aca.email_messages(id,organization_id,email_account_id,folder_id,internet_message_id,provider_message_id,from_email,subject,received_at,is_draft,is_sent,is_read,snippet) VALUES($1,$2,$3,$4,$5,$10,'sender@example.com','Same subject',$6,$7,$8,$9,'A synchronized preview')`,[id,options.tenant??org,options.account??account,options.folder??inbox,options.identity??id,options.at??to,options.draft??false,options.sent??false,options.read??false,id]);
 return id;
}
const report=(scope:MailReportScope={unreadOnly:false},limit=500)=>getMailReportEvidence({organizationId:org,agentId:agent,fromUtc:from,toUtc:to,scope,limit});
describe('canonical report evidence',()=>{
 it('selects the latest three total across readable mailboxes with a stable tie-break and unchanged unread state',async()=>{
  const older=await message({at:'2026-10-23T08:00:00Z'});
  const one=await message({at:'2026-10-23T10:00:00Z'});
  const two=await message({account:second,at:'2026-10-23T11:00:00Z'});
  const three=await message({account:second,at:'2026-10-23T11:00:00Z'});
  await message({identity:'duplicate',folder:inbox,at:'2026-10-23T07:00:00Z'});
  await message({identity:'duplicate',folder:allmail,at:'2026-10-23T07:00:00Z'});
  const before=(await db.query('SELECT id,is_read FROM aca.email_messages ORDER BY id')).rows;
  const evidence=await report({unreadOnly:true},3);
  expect(evidence.rows.map(row=>row.id)).toEqual([two,three].sort().reverse().concat(one));
  expect(evidence.rows.map(row=>row.id)).not.toContain(older);expect(evidence.matchedCount).toBe(5);
  expect((await db.query('SELECT id,is_read FROM aca.email_messages ORDER BY id')).rows).toEqual(before);
 });
 it('counts each mailbox from the canonical unread snapshot even when the preview is limited',async()=>{
  await message({identity:'<same-unread@provider>',folder:inbox});
  await message({identity:'<same-unread@provider>',folder:allmail});
  await message();await message({read:true});
  await message({account:second});await message({account:second});await message({account:second});
  const evidence=await report({unreadOnly:true},1);
  expect(evidence.matchedCount).toBe(5);expect(evidence.includedCount).toBe(1);
  expect(evidence.mailboxCounts).toEqual([{account_email:'one@example.com',unread_count:2},{account_email:'two@example.com',unread_count:3}]);
 });
 it('excludes soft-deleted accounts while preserving a recoverable disconnected mailbox',async()=>{
  const deleted=randomUUID(),disconnected=randomUUID(),foreign=randomUUID();
  await db.query(`INSERT INTO aca.email_accounts(id,organization_id,email_address,provider,status,deleted_at) VALUES($1,$4,'deleted@example.com','gmail','connected',now()),($2,$4,'disconnected@example.com','gmail','disconnected',null),($3,$5,'foreign@example.com','gmail','connected',null)`,[deleted,disconnected,foreign,org,other]);
  try{
   const ids=(await new RealAccountRepository().listForOrganization(org)).map(row=>row.id);
   expect(ids).toContain(disconnected);expect(ids).not.toContain(deleted);expect(ids).not.toContain(foreign);
  }finally{await db.query('DELETE FROM aca.email_accounts WHERE id=ANY($1::uuid[])',[[deleted,disconnected,foreign]]);}
 });
 it('counts one logical IMAP mail across INBOX/All Mail, preserves same-subject mail and copies in another account',async()=>{
  const canonical=await message({identity:'<same@provider>',folder:inbox});
  await message({identity:'<same@provider>',folder:allmail});
  const distinct=await message({identity:'<different@provider>'});
  const copy=await message({account:second,identity:'<same@provider>'});
  const evidence=await report();
  expect(evidence.matchedCount).toBe(3);expect(evidence.rows.map(row=>row.id).sort()).toEqual([canonical,distinct,copy].sort());
 });
 it('excludes draft, sent, foreign, out-of-window and unauthorized-account rows',async()=>{
  const valid=await message({at:from});await message({draft:true});await message({sent:true});await message({tenant:other});
  await message({at:'2026-10-22T11:59:59.999Z'});await message({at:'2026-10-23T12:00:00.001Z'});
  await message({account:randomUUID()});
  expect((await report()).rows.map(row=>row.id)).toEqual([valid]);
 });
 it('applies the named mailbox and unread scope without broadening it',async()=>{
  await message();const selected=await message({account:second});await message({account:second,read:true});
  const evidence=await report({unreadOnly:true,mailbox:'two@example.com'});
  expect(evidence.rows.map(row=>row.id)).toEqual([selected]);expect(evidence.scope.mailbox).toBe('two@example.com');
 });
 it.each([0,3,500,510])('reports exact bounded coverage for %i matches',async(count)=>{
  await db.query(`INSERT INTO aca.email_messages(id,organization_id,email_account_id,folder_id,provider_message_id,from_email,subject,received_at) SELECT gen_random_uuid(),$1,$2,$3,n::text,'sender@example.com','Report item', $4::timestamptz FROM generate_series(1,$5::integer) n`,[org,account,inbox,to,count]);
  const evidence=await report();expect(evidence.matchedCount).toBe(count);expect(evidence.includedCount).toBe(Math.min(count,500));expect(evidence.hasMore).toBe(count>500);
 });
 it('a newest-three preview retains the full count',async()=>{
  for(let i=0;i<4;i++)await message();const evidence=await report({unreadOnly:true},3);
  expect(evidence.matchedCount).toBe(4);expect(evidence.includedCount).toBe(3);expect(evidence.hasMore).toBe(true);
 });
 it('message-list pagination keeps an exact count and a stable boundary while new mail arrives',async()=>{
  for(let i=0;i<4;i++)await message();
  const tools=createEmailReadTools({accounts:{getForAgent:async()=>({id:account,status:'connected',capabilities:{}})} as unknown as PostgresEmailAccountRepository,agents:{} as PostgresAgentRepository,folders:{} as PostgresEmailFolderLabelRepository});
  const tool=tools.find(tool=>tool.name==='email.messages.list')!;
  const context:ToolContext={organization_id:org,agent_id:agent,user_id:randomUUID(),conversation_id:randomUUID(),turn_id:randomUUID(),correlation_id:randomUUID(),channel:'chat',auth_subject:{user_id:null,role:'owner',permissions:['email.read']}};
  const first=await tool.execute({account_id:account,limit:2},context);expect(first.ok).toBe(true);
  const page=first.output as {messages:Array<{id:string}>;matched_count:number;next_cursor:string};
  expect(page.matched_count).toBe(4);expect(page.messages).toHaveLength(2);
  await message();
  const next=await tool.execute({account_id:account,limit:2,cursor:page.next_cursor},context);
  const secondPage=next.output as typeof page;
  expect(secondPage.matched_count).toBe(4);expect(secondPage.messages).toHaveLength(2);
  expect(new Set([...page.messages,...secondPage.messages].map(row=>row.id)).size).toBe(4);
  expect(secondPage.next_cursor).toBeNull();
 });
});
