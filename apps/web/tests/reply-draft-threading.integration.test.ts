import {afterAll,beforeAll,beforeEach,describe,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {createLocalDraft} from '../../../packages/db/src/email/repository';
import {closePostgresPool} from '../../../packages/db/src/client';
const url=process.env.ACA_TEST_DATABASE_URL;
const parsed=url?new URL(url):null;
if(!parsed||!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/aca_repair_test')throw Error('Dedicated loopback aca_repair_test database required');
process.env.DATABASE_URL=url;process.env.DATABASE_SSL='false';
const pg=createRequire(new URL('../../../packages/db/package.json',import.meta.url))('pg');
const db=new pg.Client({connectionString:url});
const ORG='10000000-0000-4000-8000-000000000001',OTHER='10000000-0000-4000-8000-000000000002',ACCOUNT='20000000-0000-4000-8000-000000000001',THREAD='30000000-0000-4000-8000-000000000001',SOURCE='40000000-0000-4000-8000-000000000001';
const input={organizationId:ORG,emailAccountId:ACCOUNT,to:['customer@example.test'],subject:'Re: QA thread',bodyText:'Exact reviewed reply',replyToMessageId:SOURCE};
beforeAll(async()=>{await db.connect();await db.query(`CREATE EXTENSION IF NOT EXISTS citext; DROP SCHEMA IF EXISTS aca CASCADE; CREATE SCHEMA aca; SET search_path=aca,public;
CREATE TABLE email_accounts(id uuid PRIMARY KEY,organization_id uuid,email_address text,status text,capabilities jsonb,deleted_at timestamptz);
CREATE TABLE email_threads(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email_account_id uuid,organization_id uuid,provider_thread_id text,subject text,normalized_subject text,participant_emails citext[]);
CREATE TABLE email_messages(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email_account_id uuid,organization_id uuid,thread_id uuid,provider_message_id text,from_email text,to_recipients jsonb,cc_recipients jsonb,bcc_recipients jsonb,subject text,text_body text,snippet text,is_read boolean,is_draft boolean,is_sent boolean,received_at timestamptz,provider_draft_sync_status text,internet_message_id text,in_reply_to text,references_header text,updated_at timestamptz DEFAULT now());`);});
beforeEach(async()=>{await db.query('TRUNCATE aca.email_messages,aca.email_threads,aca.email_accounts');await db.query(`INSERT INTO aca.email_accounts VALUES($1,$2,'sender@example.test','connected','{"drafts":true}',NULL);`,[ACCOUNT,ORG]);await db.query("INSERT INTO aca.email_threads(id,email_account_id,organization_id,provider_thread_id,subject) VALUES($1,$2,$3,'gmail-thread-123','QA thread')",[THREAD,ACCOUNT,ORG]);await db.query("INSERT INTO aca.email_messages(id,email_account_id,organization_id,thread_id,provider_message_id,internet_message_id,references_header,is_draft,subject) VALUES($1,$2,$3,$4,'provider-source','<source@example.test>','<older@example.test>',false,'QA thread')",[SOURCE,ACCOUNT,ORG,THREAD]);});
afterAll(async()=>{await closePostgresPool();await db.query('DROP SCHEMA IF EXISTS aca CASCADE');await db.end();});
describe('reply drafts retain the scoped original thread and RFC headers',()=>{
 it('saves a reply in its existing thread with exact body and reply headers',async()=>{
  const draft=await createLocalDraft(input);const row=(await db.query('SELECT * FROM aca.email_messages WHERE id=$1',[draft.id])).rows[0];
  expect(row.thread_id).toBe(THREAD);expect(row.in_reply_to).toBe('<source@example.test>');expect(row.references_header).toBe('<older@example.test> <source@example.test>');expect(row.text_body).toBe(input.bodyText);
  expect((await db.query('SELECT count(*)::int n FROM aca.email_threads')).rows[0].n).toBe(1);
 });
 it('keeps ordinary drafts as new conversations',async()=>{const draft=await createLocalDraft({...input,replyToMessageId:undefined});expect(draft.thread_id).not.toBe(THREAD);});
 it.each(['organization_id','email_account_id'] as const)('rejects a source outside the selected %s without an orphan draft',async field=>{
  await db.query(`UPDATE aca.email_messages SET ${field}=$1 WHERE id=$2`,[OTHER,SOURCE]);await expect(createLocalDraft(input)).rejects.toThrow();expect((await db.query('SELECT count(*)::int n FROM aca.email_messages')).rows[0].n).toBe(1);
 });
 it('rejects a draft as the reply source',async()=>{await db.query('UPDATE aca.email_messages SET is_draft=true WHERE id=$1',[SOURCE]);await expect(createLocalDraft(input)).rejects.toThrow();});
 it('rejects injected message-ID headers without writing a draft',async()=>{await db.query('UPDATE aca.email_messages SET internet_message_id=$1 WHERE id=$2',['<source@example.test>\r\nBcc: victim@example.test',SOURCE]);await expect(createLocalDraft(input)).rejects.toThrow();expect((await db.query('SELECT count(*)::int n FROM aca.email_messages')).rows[0].n).toBe(1);});
});
