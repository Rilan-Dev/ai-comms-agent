import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pool } from 'pg';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { migrateFixture, seedBriefingFixture, testDatabaseUrl } from './helpers/briefing-db-fixture.mjs';
const workerRequire = createRequire(new URL('../../../apps/worker/package.json', import.meta.url));
const { register } = await import(pathToFileURL(workerRequire.resolve('tsx/esm/api')).href);
register();

test('C1 private storage and pooled application authorization', async t => {
  const { pool, upgradeIds, checksums } = await migrateFixture();
  let app;
  try {
    await t.test('private coverage schema exists', async () => {
      const result = await pool.query("select to_regclass('aca.briefing_mailbox_grants') IS NOT NULL AS present");
      assert.equal(result.rows[0].present, true);
    });
    await t.test('upgrade preserves legacy summaries and grants only proven mailbox creators', async () => {
      const legacy=(await pool.query('SELECT owner_user_id,content FROM aca.summaries WHERE id=$1',[upgradeIds.legacy])).rows[0];
      assert.equal(legacy.owner_user_id,null);assert.equal(legacy.content,'legacy summary');
      const grants=(await pool.query('SELECT user_id,mailbox_id FROM aca.briefing_mailbox_grants WHERE organization_id=$1',[upgradeIds.orgA])).rows;
      assert.deepEqual(grants,[{user_id:upgradeIds.userA,mailbox_id:upgradeIds.mailA}]);
      const ledger=(await pool.query('SELECT version,checksum FROM aca._aca_schema_migrations')).rows;
      assert.equal(ledger.length,checksums.size);
      for(const row of ledger) assert.equal(row.checksum,checksums.get(row.version));
    });
    const ids = await seedBriefingFixture(pool);
    const principal = { organizationId: ids.orgA, userId: ids.userA, agentId: ids.agentA };
    const admin = { organizationId: ids.orgA, userId: ids.adminA };
    const api = await import('../src/briefings/access.ts');
    const repo = await import('../src/briefings/repository.ts');
    const client = await import('../src/client.ts');
    // Table ownership models the application's pooled role without SUPERUSER or BYPASSRLS.
    const tables = (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='aca'")).rows;
    for (const { tablename } of tables) await pool.query(`ALTER TABLE aca."${tablename}" OWNER TO c1_fixture`);
    process.env.DATABASE_URL = testDatabaseUrl().replace('postgres@', 'c1_fixture@');
    process.env.DATABASE_SSL = 'false';
    app = client;
    const q = (sql, args=[]) => pool.query(sql,args);
    const grant = (user,mail) => api.assignBriefingMailboxGrant(admin,user,mail,'C1 fixture assignment');
    await grant(ids.userA,ids.mailA);
    await grant(ids.userB,ids.mailB).then(() => assert.fail('cross-org assignment'), () => {});
    await t.test('scope resolves explicit grants and fails whole mixed scope', async () => {
      const scope = await api.resolveBriefingScope(principal,[ids.mailA]);
      assert.deepEqual(scope.mailboxIds,[ids.mailA]);
      assert.equal((await api.resolveBriefingScope({ agentId: ids.agentA, userId: ids.userA, organizationId: ids.orgA },[ids.mailA])).scopeVersion,scope.scopeVersion);
      await assert.rejects(api.resolveBriefingScope(principal,[ids.mailA,ids.mailC]));
      await assert.rejects(api.resolveBriefingScope({...principal,userId:ids.adminA},[ids.mailA]));
      await assert.rejects(api.resolveBriefingScope({...principal,userId:ids.userB},[ids.mailA]));
      await assert.rejects(api.resolveBriefingScope({...principal,organizationId:ids.orgB},[ids.mailA]));
    });
    await t.test('revocation is possible while a target is suspended', async () => {
      await grant(ids.userC,ids.mailA);
      await q("UPDATE aca.users SET status='suspended' WHERE id=$1",[ids.userC]);
      try {await api.revokeBriefingMailboxGrant(admin,ids.userC,ids.mailA,'suspended target cleanup');}
      finally {await q("UPDATE aca.users SET status='active' WHERE id=$1",[ids.userC]);}
      await assert.rejects(api.resolveBriefingScope({...principal,userId:ids.userC},[ids.mailA]));
    });
    await t.test('send-only/revoked bindings and inactive principals cannot read', async () => {
      const before = await api.resolveBriefingScope(principal,[ids.mailA]);
      await q("UPDATE aca.agent_email_accounts SET role='send_only' WHERE agent_id=$1 AND email_account_id=$2",[ids.agentA,ids.mailA]);
      await assert.rejects(api.resolveBriefingScope(principal,[ids.mailA]));
      await q("UPDATE aca.agent_email_accounts SET role='read_only' WHERE agent_id=$1 AND email_account_id=$2",[ids.agentA,ids.mailA]);
      assert.notEqual((await api.resolveBriefingScope(principal,[ids.mailA])).scopeVersion,before.scopeVersion);
      await q('DELETE FROM aca.agent_email_accounts WHERE agent_id=$1 AND email_account_id=$2',[ids.agentA,ids.mailA]);
      await assert.rejects(api.resolveBriefingScope(principal,[ids.mailA]));
      await q("INSERT INTO aca.agent_email_accounts(agent_id,email_account_id,role) VALUES($1,$2,'primary')",[ids.agentA,ids.mailA]);
      for (const [table,id,status] of [['organizations',ids.orgA,'suspended'],['users',ids.userA,'suspended'],['agents',ids.agentA,'paused'],['email_accounts',ids.mailA,'revoked']]) {
        const previous = (await q(`select status from aca.${table} where id=$1`,[id])).rows[0].status;
        await q(`UPDATE aca.${table} SET status=$2 WHERE id=$1`,[id,status]);
        await assert.rejects(api.resolveBriefingScope(principal,[ids.mailA]));
        await q(`UPDATE aca.${table} SET status=$2 WHERE id=$1`,[id,previous]);
      }
    });
    await t.test('grant administration checks actor, target, account and audits atomic changes', async () => {
      await assert.rejects(api.assignBriefingMailboxGrant({...admin,userId:ids.userC},ids.userC,ids.mailA,'self grant'));
      await assert.rejects(grant(ids.userB,ids.mailA));
      await assert.rejects(grant(ids.userC,ids.mailB));
      await grant(ids.userC,ids.mailA);
      await api.revokeBriefingMailboxGrant(admin,ids.userC,ids.mailA,'remove test access');
      await assert.rejects(api.resolveBriefingScope({...principal,userId:ids.userC},[ids.mailA]));
      const audit = (await q("SELECT metadata FROM aca.audit_events WHERE action='briefing.access.revoke' ORDER BY created_at DESC LIMIT 1")).rows[0].metadata;
      assert.equal(audit.targetUserId,ids.userC);
      assert.equal(audit.oldScope.active,true);
      assert.equal(audit.newScope.active,false);
      assert.equal(audit.reason,'remove test access');
      assert.equal((await q('SELECT count(*) FROM aca.briefing_mailbox_grants WHERE organization_id=$1 AND user_id=$2',[ids.orgA,ids.adminA])).rows[0].count,'0');
    });
    await t.test('audit failure rolls back grant changes and version', async () => {
      const before=(await q('SELECT * FROM aca.briefing_mailbox_grants WHERE user_id=$1 AND mailbox_id=$2',[ids.userA,ids.mailA])).rows;
      await q("CREATE FUNCTION aca.fixture_reject_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture audit rejection'; END $$");
      await q('CREATE TRIGGER fixture_reject_audit BEFORE INSERT ON aca.audit_events FOR EACH ROW EXECUTE FUNCTION aca.fixture_reject_audit()');
      try {
        await assert.rejects(grant(ids.userA,ids.mailA),/fixture audit rejection/);
        await assert.rejects(api.revokeBriefingMailboxGrant(admin,ids.userA,ids.mailA,'rollback test'),/fixture audit rejection/);
        assert.deepEqual((await q('SELECT * FROM aca.briefing_mailbox_grants WHERE user_id=$1 AND mailbox_id=$2',[ids.userA,ids.mailA])).rows,before);
      } finally {
        await q('DROP TRIGGER fixture_reject_audit ON aca.audit_events');
        await q('DROP FUNCTION aca.fixture_reject_audit()');
      }
    });
    let savedScope;
    const item={id:'stable-item',sourceIds:[ids.messageA],priority:'high',title:'sensitive title',summary:'sensitive summary',reason:'sensitive reason',deadline:null,confidence:'supported',suggestedAction:'review',evidence:[],representation:'complete',snoozedUntil:null};
    await t.test('private repository reads require exact tenant/user/agent and source access', async () => {
      savedScope=await api.resolveBriefingScope(principal,[ids.mailA]);
      await q(`INSERT INTO aca.summaries(id,organization_id,agent_id,summary_type,period_start,period_end,content,owner_user_id,mailbox_ids,briefing_status,briefing_mode,scope_version,content_json) VALUES($1,$2,$3,'personal_briefing',now()-interval '7 days',now(),'secret',$4,$5,'ready','catch_up',$6,$7)`,[ids.summaryA,ids.orgA,ids.agentA,ids.userA,[ids.mailA],savedScope.scopeVersion,JSON.stringify([item])]);
      await q(`INSERT INTO aca.summary_sources(summary_id,organization_id,owner_user_id,agent_id,email_message_id,mailbox_id,content_revision,item_metadata) SELECT $1,$2,$3,$4,id,email_account_id,aca.briefing_content_revision(id),'{}' FROM aca.email_messages WHERE id=$5`,[ids.summaryA,ids.orgA,ids.userA,ids.agentA,ids.messageA]);
      await q('UPDATE aca.summaries SET selected_source_manifest=$1 WHERE id=$2',[JSON.stringify([{messageId:ids.messageA}]),ids.summaryA]);
      assert.equal((await repo.getBriefing(principal,ids.summaryA)).items[0].title,'sensitive title');
      for(const p of [{...principal,userId:ids.userC},{...principal,organizationId:ids.orgB},{...principal,agentId:ids.agentB}]) await assert.rejects(repo.getBriefing(p,ids.summaryA));
      assert.equal((await repo.listBriefings(principal,{limit:1})).briefings.length,1);
      assert.deepEqual((await repo.listBriefings({...principal,userId:ids.userC},{limit:1})).briefings,[]);
    });
    await t.test('get and list suppress inconsistent evidence and allow current evidence', async () => {
      const revision=(await q('SELECT content_revision FROM aca.summary_sources WHERE summary_id=$1',[ids.summaryA])).rows[0].content_revision;
      const evidence={sourceId:ids.messageA,contentRevision:revision,start:0,end:5,quote:'valid',supports:'summary'};
      const save=content=>q('UPDATE aca.summaries SET content_json=$1 WHERE id=$2',[JSON.stringify([content]),ids.summaryA]);
      try {
        await save({...item,evidence:[evidence],unexpected:'must not escape'});
        for(const read of [await repo.getBriefing(principal,ids.summaryA),(await repo.listBriefings(principal)).briefings[0]]) {
          assert.equal(read.items[0].evidence[0].quote,'valid');
          assert.equal(read.items[0].unexpected,undefined);
        }
        for(const bad of [[{...evidence,sourceId:ids.messageB}],[{...evidence,contentRevision:'stale'}],null,[null],[{...evidence,quote:42}]]) {
          await save({...item,evidence:bad});
          for(const read of [await repo.getBriefing(principal,ids.summaryA),(await repo.listBriefings(principal)).briefings[0]]) {
            assert.equal(read.manifest.status,'invalidated');assert.deepEqual(read.items,[]);
            assert.equal(read.manifest.sourceCount,0);
          }
        }
      } finally {await save(item);}
    });
    await t.test('non-superuser RLS cannot expose private rows via legacy permissive policies', async () => {
      await q("CREATE POLICY fixture_old_permissive ON aca.summaries FOR ALL TO authenticated USING(true) WITH CHECK(true)");
      await q("CREATE POLICY fixture_old_sources ON aca.summary_sources FOR ALL TO authenticated USING(true) WITH CHECK(true)");
      const u = new URL(testDatabaseUrl());u.username='c1_fixture';
      const rls=new Pool({connectionString:u.href});
      const c=await rls.connect();
      try {
        await c.query('SET ROLE authenticated');
        assert.deepEqual((await c.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user')).rows[0],{rolsuper:false,rolbypassrls:false});
        for(const user of [ids.userA,ids.userB,ids.userC,ids.adminA]) {
          await c.query("SELECT set_config('app.user_id',$1,false)",[user]);
          assert.equal((await c.query('SELECT * FROM aca.summaries WHERE id=$1',[ids.summaryA])).rowCount,0);
          assert.equal((await c.query('SELECT * FROM aca.summary_sources WHERE summary_id=$1',[ids.summaryA])).rowCount,0);
          assert.equal((await c.query("UPDATE aca.summaries SET owner_user_id=NULL WHERE id=$1 RETURNING id",[ids.summaryA])).rowCount,0);
        }
      } finally {c.release();await rls.end();}
    });
    await t.test('source revisions ignore read flags and invalidate content/new thread messages', async () => {
      await q('UPDATE aca.email_messages SET is_read=true WHERE id=$1',[ids.messageA]);
      assert.equal((await repo.getBriefing(principal,ids.summaryA)).manifest.status,'ready');
      await q("INSERT INTO aca.email_messages(email_account_id,organization_id,thread_id,text_body) VALUES($1,$2,$3,'new reply')",[ids.mailA,ids.orgA,ids.threadA]);
      const invalid=await repo.getBriefing(principal,ids.summaryA);
      assert.equal(invalid.manifest.status,'invalidated');assert.deepEqual(invalid.items,[]);assert.equal(invalid.manifest.sourceCount,0);
      await q('UPDATE aca.summary_sources SET content_revision=aca.briefing_content_revision(email_message_id) WHERE summary_id=$1',[ids.summaryA]);
      await q("UPDATE aca.email_messages SET text_body='changed private content' WHERE id=$1",[ids.messageA]);
      assert.equal((await repo.getBriefing(principal,ids.summaryA)).manifest.status,'invalidated');
      await q('UPDATE aca.summary_sources SET content_revision=aca.briefing_content_revision(email_message_id) WHERE summary_id=$1',[ids.summaryA]);
      await api.revokeBriefingMailboxGrant(admin,ids.userA,ids.mailA,'revocation');
      const revoked=await repo.getBriefing(principal,ids.summaryA);
      assert.equal(revoked.manifest.status,'invalidated');assert.deepEqual(revoked.items,[]);assert.equal(revoked.manifest.sourceCount,0);
      assert.deepEqual((await repo.listBriefings(principal,{limit:1})).briefings[0].items,[]);
      await grant(ids.userA,ids.mailA);
    });
    await t.test('foreground activity throttles t0/t30/t61 to two writes without acknowledging mail', async () => {
      await api.recordForegroundActivity(principal,'2026-10-18T00:00:00.000Z');
      const first=(await q('select xmin::text revision,last_foreground_at from aca.user_mail_activity where user_id=$1',[ids.userA])).rows[0];
      await api.recordForegroundActivity(principal,'2026-10-18T00:00:30.000Z');
      assert.equal((await q('select xmin::text revision from aca.user_mail_activity where user_id=$1',[ids.userA])).rows[0].revision,first.revision);
      await api.recordForegroundActivity(principal,'2026-10-18T00:01:01.000Z');
      const last=(await q('select xmin::text revision,last_foreground_at from aca.user_mail_activity where user_id=$1',[ids.userA])).rows[0];
      assert.notEqual(last.revision,first.revision);assert.equal(last.last_foreground_at.toISOString(),'2026-10-18T00:01:01.000Z');
      assert.equal((await q('select count(*) from aca.mail_review_items')).rows[0].count,'0');
      await grant(ids.userC,ids.mailA);
      await api.recordForegroundActivity({...principal,userId:ids.userC},'2026-10-18T00:00:00.000Z');
      await q('DELETE FROM aca.organization_memberships WHERE organization_id=$1 AND user_id=$2',[ids.orgA,ids.userC]);
      assert.equal((await q('select count(*) from aca.user_mail_activity where user_id=$1',[ids.userC])).rows[0].count,'0');
    });
    await t.test('compound storage keys reject cross-tenant grants/sources/jobs', async () => {
      await assert.rejects(q("INSERT INTO aca.briefing_mailbox_grants(organization_id,user_id,mailbox_id,assigned_by,reason) VALUES($1,$2,$3,$4,'bad')",[ids.orgA,ids.userA,ids.mailB,ids.adminA]));
      await assert.rejects(q('UPDATE aca.summary_sources SET mailbox_id=$1 WHERE summary_id=$2',[ids.mailB,ids.summaryA]));
      await assert.rejects(q("INSERT INTO aca.briefing_generation_jobs(organization_id,owner_user_id,agent_id,request_key,scope_version) VALUES($1,$2,$3,'bad','v1')",[ids.orgA,ids.userA,ids.agentB]));
      const values=[ids.orgA,ids.userA,ids.agentA];
      const results=await Promise.allSettled([1,2].map(()=>q("INSERT INTO aca.briefing_generation_jobs(organization_id,owner_user_id,agent_id,request_key,scope_version) VALUES($1,$2,$3,'same-request','v1')",values)));
      assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
      await q("INSERT INTO aca.briefing_generation_jobs(organization_id,owner_user_id,agent_id,request_key,scope_version) VALUES($1,$2,$3,'same-request','v2')",values);
      await assert.rejects(q('UPDATE aca.summaries SET mailbox_ids=$1 WHERE id=$2',[[ids.mailB],ids.summaryA]));
    });
    await t.test('single-message and sanitized content changes invalidate revisions', async () => {
      const thread=(await q('INSERT INTO aca.email_threads(email_account_id,organization_id) VALUES($1,$2) RETURNING id',[ids.mailA,ids.orgA])).rows[0].id;
      const msg=(await q("INSERT INTO aca.email_messages(email_account_id,organization_id,thread_id,subject,text_body) VALUES($1,$2,$3,'single-message','before') RETURNING id",[ids.mailA,ids.orgA,thread])).rows[0].id;
      const revision=async()=> (await q('SELECT aca.briefing_content_revision($1) AS value',[msg])).rows[0].value;
      const before=await revision();
      await q("UPDATE aca.email_messages SET text_body='after' WHERE id=$1",[msg]);
      assert.notEqual(await revision(),before);
      const textRevision=await revision();
      await q("UPDATE aca.email_messages SET html_body_sanitized='<p>corrected</p>' WHERE id=$1",[msg]);
      assert.notEqual(await revision(),textRevision);
    });
    await t.test('source deletion suppresses all saved text before any invalidation worker', async () => {
      const scope=await api.resolveBriefingScope(principal,[ids.mailA]);
      await q('UPDATE aca.summaries SET scope_version=$1 WHERE id=$2',[scope.scopeVersion,ids.summaryA]);
      await q('UPDATE aca.summary_sources SET content_revision=aca.briefing_content_revision(email_message_id) WHERE summary_id=$1',[ids.summaryA]);
      await q('DELETE FROM aca.email_messages WHERE id=$1',[ids.messageA]);
      const read=await repo.getBriefing(principal,ids.summaryA);
      assert.equal(read.manifest.status,'invalidated');assert.deepEqual(read.items,[]);assert.equal(read.manifest.sourceCount,0);
    });
  } finally {if(app) await app.closePostgresPool();await pool.end();}
});

test('fresh full chain applies strictly without seeded application rows', async()=> {
  const {pool,checksums}=await migrateFixture({seedUpgrade:false});
  try {
    assert.equal((await pool.query('SELECT count(*) FROM aca._aca_schema_migrations')).rows[0].count,String(checksums.size));
    assert.equal((await pool.query('SELECT count(*) FROM aca.briefing_mailbox_grants')).rows[0].count,'0');
  } finally {await pool.end();}
});
