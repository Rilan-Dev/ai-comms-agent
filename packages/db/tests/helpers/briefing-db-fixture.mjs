import { Pool } from 'pg';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';

export function testDatabaseUrl() {
  if (process.env.BRIEFING_TEST_DATABASE_OPT_IN !== 'disposable-local-c1') throw new Error('Explicit disposable test opt-in required');
  const raw = process.env.BRIEFING_TEST_DATABASE_URL;
  if (!raw) throw new Error('BRIEFING_TEST_DATABASE_URL required; DATABASE_URL is never a fallback');
  const u = new URL(raw);
  if (u.protocol !== 'postgresql:' || u.hostname !== '127.0.0.1' || u.port !== '55432' || u.pathname !== '/ai_comms_c1_test' || u.username !== 'postgres' || u.password || u.search || u.hash) throw new Error('Refusing non-test target');
  let inspect;
  try {
    inspect = JSON.parse(execFileSync(
      'docker', ['inspect', 'ai-comms-c1-testdb'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ))[0];
  } catch {
    // Do not silently create or target another DB; bootstrap is a separate,
    // explicit, opt-in operation on the dedicated localhost test container.
    throw new Error('Disposable briefing test container ai-comms-c1-testdb is missing or unavailable. Run BRIEFING_TEST_DATABASE_OPT_IN=disposable-local-c1 bash scripts/start-briefing-testdb.sh before the C3 DB tests.');
  }
  const binding = inspect?.HostConfig?.PortBindings?.['5432/tcp']?.[0];
  if (!inspect?.State?.Running || binding?.HostIp !== '127.0.0.1' ||
      binding?.HostPort !== '55432' ||
      !inspect?.HostConfig?.Tmpfs?.['/var/lib/postgresql/data']) {
    throw new Error('Refusing unsafe briefing test container; only running localhost:55432 tmpfs ai-comms-c1-testdb is permitted');
  }
  return raw;
}
const root = fileURLToPath(new URL('../../../../', import.meta.url));
export async function migrateFixture({ seedUpgrade = true } = {}) {
  const url = testDatabaseUrl();
  const pool = new Pool({ connectionString: url, ssl: false });
  // Hold a session lock for the fixture's whole lifetime, including tests.
  // Parallel Node test files must not reset a schema another suite is using.
  const fixtureLease = await pool.connect();
  await fixtureLease.query("SELECT pg_advisory_lock(hashtextextended('briefing-disposable-fixture',0))");
  const endPool = pool.end.bind(pool);
  pool.end = async () => {
    try { await fixtureLease.query("SELECT pg_advisory_unlock(hashtextextended('briefing-disposable-fixture',0))"); }
    finally { fixtureLease.release(); await endPool(); }
  };
  const identity = (await pool.query('select current_database() db')).rows[0];
  if (identity.db !== 'ai_comms_c1_test') throw new Error('Unexpected database identity');
  await pool.query('DROP SCHEMA IF EXISTS aca CASCADE; DROP SCHEMA IF EXISTS private CASCADE; CREATE SCHEMA aca; CREATE SCHEMA private; CREATE TABLE aca._aca_schema_migrations(version text PRIMARY KEY,checksum text NOT NULL,applied_at timestamptz DEFAULT now())');
  const checksums = new Map(readdirSync(`${root}supabase/migrations`).filter(n => n.endsWith('.sql')).map(n => [n, createHash('sha256').update(readFileSync(`${root}supabase/migrations/${n}`)).digest('hex')]));
  let upgradeIds;
  try {
    for (const [name,hash] of [...checksums.entries()].sort(([a],[b])=>a.localeCompare(b,'en'))) {
      if (name === '0050_personal_mail_briefings.sql' && seedUpgrade) {
        upgradeIds=await seedBriefingFixture(pool);
        await pool.query("INSERT INTO aca.summaries(id,organization_id,agent_id,summary_type,period_start,period_end,content) VALUES($1,$2,$3,'legacy',now()-interval '1 day',now(),'legacy summary')",[upgradeIds.legacy,upgradeIds.orgA,upgradeIds.agentA]);
      }
      // Native psql executes each statement strictly, unlike the legacy Node
      // runner which suppresses some SQL errors. Never suppress migration errors.
      execFileSync('docker',['exec','-i','ai-comms-c1-testdb','psql','-X','-v','ON_ERROR_STOP=1','-U','postgres','-d','ai_comms_c1_test'],
        { input: `SET search_path=aca,public;\n${readFileSync(`${root}supabase/migrations/${name}`,'utf8')}`,encoding:'utf8',stdio:'pipe' });
      await pool.query('INSERT INTO aca._aca_schema_migrations(version,checksum) VALUES($1,$2)',[name,hash]);
    }
  } catch (e) { await pool.end(); throw new Error(`Migration chain failed: ${e.message}\n${e.stdout ?? ''}\n${e.stderr ?? ''}`); }
  for (const [n, hash] of checksums) if (createHash('sha256').update(readFileSync(`${root}supabase/migrations/${n}`)).digest('hex') !== hash) throw new Error(`Migration changed: ${n}`);
  await pool.query('GRANT USAGE ON SCHEMA aca, private TO authenticated, c1_fixture; GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA aca TO authenticated, c1_fixture; GRANT authenticated TO c1_fixture');
  return { pool, upgradeIds, checksums };
}

export async function seedBriefingFixture(pool) {
  const { randomUUID } = await import('node:crypto');
  const ids = Object.fromEntries(['orgA','orgB','userA','userB','adminA','userC','agentA','agentB','mailA','mailB','mailC','threadA','threadB','messageA','messageB','summaryA','summaryB','legacy'].map(k => [k, randomUUID()]));
  const client = await pool.connect();
  const q = (text, values = []) => client.query(text, values);
  try {
  await q('SET search_path=aca,public');
  await q('BEGIN');
  for (const [org,user,name] of [[ids.orgA,ids.userA,'A'],[ids.orgB,ids.userB,'B']]) {
    await q('INSERT INTO organizations(id,name,slug) VALUES($1::uuid,$2,$1::text)',[org,name]);
    await q('INSERT INTO users(id,email) VALUES($1,$2)',[user,`${user}@example.test`]);
    await q("INSERT INTO organization_memberships(organization_id,user_id,role) VALUES($1,$2,'owner')",[org,user]);
  }
  for(const [user,role] of [[ids.adminA,'admin'],[ids.userC,'member']]) {
    await q('INSERT INTO users(id,email) VALUES($1,$2)',[user,`${user}@example.test`]);
    await q('INSERT INTO organization_memberships(organization_id,user_id,role) VALUES($1,$2,$3)',[ids.orgA,user,role]);
  }
  for(const [agent,org,mail,thread,message,user] of [[ids.agentA,ids.orgA,ids.mailA,ids.threadA,ids.messageA,ids.userA],[ids.agentB,ids.orgB,ids.mailB,ids.threadB,ids.messageB,ids.userB]]) {
    await q("INSERT INTO agents(id,organization_id,name,slug,status) VALUES($1::uuid,$2,'fixture',$1::text,'active')",[agent,org]);
    await q("INSERT INTO email_accounts(id,organization_id,provider,email_address,status,created_by) VALUES($1,$2,'gmail',$3,'connected',$4)",[mail,org,`${mail}@example.test`,user]);
    await q("INSERT INTO agent_email_accounts(agent_id,email_account_id,role) VALUES($1,$2,'primary')",[agent,mail]);
    await q('INSERT INTO email_threads(id,email_account_id,organization_id) VALUES($1,$2,$3)',[thread,mail,org]);
    await q("INSERT INTO email_messages(id,email_account_id,organization_id,thread_id,subject,text_body) VALUES($1,$2,$3,$4,'private title','private body')",[message,mail,org,thread]);
  }
  await q("INSERT INTO email_accounts(id,organization_id,provider,email_address,status) VALUES($1,$2,'gmail',$3,'connected')",[ids.mailC,ids.orgA,`${ids.mailC}@example.test`]);
  await q("INSERT INTO agent_email_accounts(agent_id,email_account_id,role) VALUES($1,$2,'read_only')",[ids.agentA,ids.mailC]);
  // Upgrade fixtures also seed before migration 0059 exists.
  if((await q("SELECT 1 FROM information_schema.columns WHERE table_schema='aca' AND table_name='email_sync_states' AND column_name='provider_flags_checked_at'")).rowCount){
    await q("INSERT INTO email_sync_states(email_account_id,organization_id,status,provider_flags_checked_at) SELECT id,organization_id,'idle',now() FROM email_accounts WHERE id=ANY($1::uuid[])",[[ids.mailA,ids.mailB,ids.mailC]]);
  }
  await q('COMMIT');
  return ids;
  } catch(error) { await q('ROLLBACK');throw error; }
  finally { client.release(); }
}
