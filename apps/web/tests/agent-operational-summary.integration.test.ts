import {afterAll,beforeAll,describe,expect,it} from 'vitest';
import {createRequire} from 'node:module';
import {getAgentOperationalSummary} from '../src/lib/agents/operational-summary';
const url=process.env.ACA_TEST_DATABASE_URL;const parsed=url?new URL(url):null;
if(!parsed||!['127.0.0.1','localhost'].includes(parsed.hostname)||parsed.pathname!=='/aca_repair_test')throw Error('Dedicated loopback aca_repair_test database required');
const pg=createRequire(new URL('../../../packages/db/package.json',import.meta.url))('pg');
const db=new pg.Client({connectionString:url});
beforeAll(async()=>{await db.connect();await db.query(`CREATE TEMP TABLE email_actions(organization_id text,agent_id text,status text,expires_at timestamptz); CREATE TEMP TABLE whatsapp_send_actions(organization_id text,agent_id text,status text,expires_at timestamptz,queued_message_id text);
 INSERT INTO email_actions VALUES ('org','agent','pending_approval',NULL),('org','other','pending_approval',NULL),('other','agent','pending_approval',NULL),('org','agent','pending_approval',now()-interval '1 day'),('org','agent','sent',NULL);
 INSERT INTO whatsapp_send_actions VALUES ('org','agent','pending',now()+interval '1 day',NULL),('org','agent','pending',now()-interval '1 day',NULL),('other','agent','pending',now()+interval '1 day',NULL),('org','agent','requires_template',now()+interval '1 day',NULL),('org','agent','pending',now()+interval '1 day','already-queued');`);});
afterAll(async()=>{await db.end();});
describe('agent approval counts on PostgreSQL',()=>{
 it('excludes other organizations, agents, expired requests and non-pending outcomes',async()=>{
  const result=await getAgentOperationalSummary({organizationId:'org',agentId:'agent',permissions:new Set(['organization.update','whatsapp.read'])},(sql,params)=>db.query(sql,params));
  expect(result).toEqual({emailApprovals:1,whatsappApprovals:1});
 });
});
