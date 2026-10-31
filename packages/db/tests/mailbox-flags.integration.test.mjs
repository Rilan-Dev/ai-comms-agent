import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {migrateFixture,seedBriefingFixture,testDatabaseUrl} from './helpers/briefing-db-fixture.mjs';
const require=createRequire(new URL('../../../apps/worker/package.json',import.meta.url));
(await import(pathToFileURL(require.resolve('tsx/esm/api')).href)).register();

test('durable provider read-state reconciliation',async t=>{
  const {pool}=await migrateFixture();let app;
  try{
    const ids=await seedBriefingFixture(pool);
    for(const {tablename} of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='aca'")).rows)await pool.query(`ALTER TABLE aca."${tablename}" OWNER TO c1_fixture`);
    process.env.DATABASE_URL=testDatabaseUrl().replace('postgres@','c1_fixture@');process.env.DATABASE_SSL='false';
    app=await import('../src/client.ts');
    const api=await import('../src/email/flag-reconciliation.ts');
    const q=(sql,args=[])=>pool.query(sql,args);
    const scope={organizationId:ids.orgA,emailAccountId:ids.mailA};
    await q("UPDATE aca.email_messages SET provider_message_id='INBOX:12',internet_message_id='<one@test>' WHERE id=$1",[ids.messageA]);
    await q("INSERT INTO aca.email_sync_states(email_account_id,organization_id,status,last_attempt_at) VALUES($1,$2,'running',now()) ON CONFLICT(email_account_id) DO UPDATE SET status='running',last_attempt_at=now(),provider_flags_checked_at=NULL",[ids.mailA,ids.orgA]);
    const claim=async()=> (await q("UPDATE aca.email_sync_states SET status='running',last_attempt_at=clock_timestamp() WHERE email_account_id=$1 RETURNING last_attempt_at::text value",[ids.mailA])).rows[0].value;
    const state=async()=> (await q('SELECT provider_flags_cursor,provider_flags_started_at,provider_flags_checked_at FROM aca.email_sync_states WHERE email_account_id=$1',[ids.mailA])).rows[0];
    const flags=page=>page.messages.map(m=>({provider_message_id:m.providerMessageId,message_id_header:m.messageIdHeader,is_read:true,is_starred:false,is_draft:false,is_outbound:false}));
    await t.test('catch-up freshness rejects missing, incomplete, stale, failed and cross-organization coverage',async()=>{
      const freshness=await import('../src/briefings/read-state.ts');
      const check=()=>app.withTransaction(client=>freshness.requireFreshMailboxFlags(client,ids.orgA,[ids.mailA]));
      await assert.rejects(check(),/read status/i);
      await q("UPDATE aca.email_sync_states SET provider_flags_checked_at=now(),provider_flags_started_at=NULL,provider_flags_error=NULL WHERE email_account_id=$1",[ids.mailA]);
      await check();
      await assert.rejects(app.withTransaction(client=>freshness.requireFreshMailboxFlags(client,ids.orgB,[ids.mailA])),/read status/i);
      for(const sql of ["provider_flags_started_at=now()","provider_flags_checked_at=now()-interval '6 minutes'","provider_flags_error='offline'"]){
        await q(`UPDATE aca.email_sync_states SET ${sql} WHERE email_account_id=$1`,[ids.mailA]);
        await assert.rejects(check(),/read status/i);
        await q("UPDATE aca.email_sync_states SET provider_flags_checked_at=now(),provider_flags_started_at=NULL,provider_flags_error=NULL WHERE email_account_id=$1",[ids.mailA]);
      }
      await q('UPDATE aca.email_sync_states SET provider_flags_checked_at=NULL WHERE email_account_id=$1',[ids.mailA]);
    });
    await t.test('a completed metadata page updates canonical flags without consuming personal review or changing content revision',async()=>{
      const before=(await q('SELECT aca.briefing_content_revision($1) revision',[ids.messageA])).rows[0].revision;
      const page=await api.prepareMailboxFlagPage(scope,await claim());assert.ok(page);assert.equal(page.messages.length,1);
      assert.equal((await state()).provider_flags_checked_at,null);
      await api.completeMailboxFlagPage(page,{flags:flags(page),missing:[],refetched:[]});
      assert.equal((await q('SELECT is_read FROM aca.email_messages WHERE id=$1',[ids.messageA])).rows[0].is_read,true);
      assert.equal((await q('SELECT aca.briefing_content_revision($1) revision',[ids.messageA])).rows[0].revision,before);
      assert.equal((await q('SELECT count(*)::int n FROM aca.mail_review_items')).rows[0].n,0);
      assert.ok((await state()).provider_flags_checked_at);assert.equal((await state()).provider_flags_started_at,null);
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:flags(page),missing:[],refetched:[]}),/changed|stale|lease/i);
    });
    await t.test('missing, duplicate or substituted metadata cannot advance the durable cursor',async()=>{
      const page=await api.prepareMailboxFlagPage(scope,await claim());const before=await state();
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:[],missing:[],refetched:[]}),/coverage/i);
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:[...flags(page),...flags(page)],missing:[],refetched:[]}),/coverage|duplicate/i);
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:[{...flags(page)[0],provider_message_id:'other:99'}],missing:[],refetched:[]}),/coverage|source/i);
      assert.deepEqual(await state(),before);
    });
    await t.test('a source changed during provider I/O is not overwritten by older read flags',async()=>{
      const page=await api.prepareMailboxFlagPage(scope,await claim());
      await q("UPDATE aca.email_messages SET subject='changed during I/O' WHERE id=$1",[ids.messageA]);
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:flags(page),missing:[],refetched:[]}),/source.*changed/i);
    });
    await t.test('an expired sync lease and cross-tenant scope cannot publish flags',async()=>{
      const lease=await claim();const page=await api.prepareMailboxFlagPage(scope,lease);await claim();
      let effects=0;
      await assert.rejects(api.withMailboxFlagLease(page,async()=>{effects++;}),/lease|changed/i);
      assert.equal(effects,0);
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:flags(page),missing:[],refetched:[]}),/lease|changed/i);
      assert.equal(await api.prepareMailboxFlagPage({...scope,organizationId:ids.orgB},await claim()),null);
    });
    await t.test('a reused UID requires a full canonical refetch before coverage can advance',async()=>{
      const page=await api.prepareMailboxFlagPage(scope,await claim());
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:[{...flags(page)[0],message_id_header:'<replacement@test>'}],missing:[],refetched:[]}),/identity/i);
      await q("UPDATE aca.email_messages SET internet_message_id='<replacement@test>',text_body='replacement',is_read=false WHERE id=$1",[ids.messageA]);
      await api.completeMailboxFlagPage(page,{flags:[],missing:[],refetched:[{providerMessageId:'INBOX:12',messageIdHeader:'<replacement@test>'}]});
      assert.equal((await q('SELECT is_read FROM aca.email_messages WHERE id=$1',[ids.messageA])).rows[0].is_read,false);
    });
    await t.test('confirmed deletion must be persisted before its metadata page is acknowledged',async()=>{
      const page=await api.prepareMailboxFlagPage(scope,await claim());
      await assert.rejects(api.completeMailboxFlagPage(page,{flags:[],missing:['INBOX:12'],refetched:[]}),/missing.*present/i);
      await q('DELETE FROM aca.email_messages WHERE id=$1',[ids.messageA]);
      await api.completeMailboxFlagPage(page,{flags:[],missing:['INBOX:12'],refetched:[]});
    });
    await t.test('bounded keyset pages resume without marking incomplete coverage fresh',async()=>{
      await q(`WITH rows AS (SELECT gen_random_uuid() id,n FROM generate_series(1,61) n)
        INSERT INTO aca.email_messages(id,organization_id,email_account_id,thread_id,provider_message_id,internet_message_id,text_body)
        SELECT id,$1,$2,$3,'INBOX:'||(n+100),'<'||id||'@test>','fixture' FROM rows`,[ids.orgA,ids.mailA,ids.threadA]);
      const lease=await claim();const first=await api.prepareMailboxFlagPage(scope,lease);assert.equal(first.messages.length,50);assert.ok(first.nextCursor);
      const checked=(await state()).provider_flags_checked_at;
      await api.completeMailboxFlagPage(first,{flags:flags(first),missing:[],refetched:[]});
      assert.deepEqual((await state()).provider_flags_checked_at,checked);
      const second=await api.prepareMailboxFlagPage(scope,lease);assert.equal(second.messages.length,11);assert.equal(second.nextCursor,null);
      assert.equal(new Set([...first.messages,...second.messages].map(m=>m.id)).size,61);
      await api.completeMailboxFlagPage(second,{flags:flags(second),missing:[],refetched:[]});
      assert.equal((await state()).provider_flags_cursor,null);assert.ok((await state()).provider_flags_checked_at);
    });
    await t.test('a focused source check is fresh even while an unrelated historical sweep is older than five minutes',async()=>{
      const selected=(await q('SELECT id FROM aca.email_messages WHERE email_account_id=$1 ORDER BY id LIMIT 1',[ids.mailA])).rows[0].id;
      await q("UPDATE aca.email_sync_states SET provider_flags_started_at=now()-interval '20 minutes',provider_flags_cursor=$2 WHERE email_account_id=$1",[ids.mailA,selected]);
      await q('UPDATE aca.email_messages SET provider_flags_requested_at=now() WHERE id=$1',[selected]);
      const before=await state();const page=await api.prepareMailboxFlagPage(scope,await claim(),50,true);
      assert.equal(page.focused,true);assert.deepEqual(page.messages.map(row=>row.id),[selected]);
      await api.completeMailboxFlagPage(page,{flags:flags(page),missing:[],refetched:[]});
      assert.deepEqual(await state(),before);
      const observed=(await q(`SELECT provider_flags_requested_at,provider_flags_observed_at>now()-interval '5 minutes' fresh,
        provider_flags_observation_revision=aca.mail_provider_observation_revision(id) current FROM aca.email_messages WHERE id=$1`,[selected])).rows[0];
      assert.deepEqual(observed,{provider_flags_requested_at:null,fresh:true,current:true});
    });
    await t.test('source verification uses current personal grants and exact revisions, never whole-inventory freshness',async()=>{
      const verify=await import('../src/briefings/source-verification.ts');
      const access=await import('../src/briefings/access.ts');
      const p={organizationId:ids.orgA,userId:ids.userA,agentId:ids.agentA};
      const row=(await q('SELECT id,aca.briefing_content_revision(id) revision FROM aca.email_messages WHERE email_account_id=$1 ORDER BY id LIMIT 1',[ids.mailA])).rows[0];
      const sources=[{messageId:row.id,mailboxId:ids.mailA,contentRevision:row.revision}];
      const check=()=>app.withTransaction(client=>verify.ensureBriefingSourceFlags(client,p,[ids.mailA],sources));
      await assert.rejects(check());
      await access.assignBriefingMailboxGrant({organizationId:ids.orgA,userId:ids.adminA},ids.userA,ids.mailA,'source verification test');
      assert.equal(await check(),true);
      await q('UPDATE aca.email_messages SET provider_flags_observed_at=NULL,provider_flags_observation_revision=NULL WHERE id=$1',[row.id]);
      assert.equal(await check(),false);
      assert.ok((await q('SELECT provider_flags_requested_at FROM aca.email_messages WHERE id=$1',[row.id])).rows[0].provider_flags_requested_at);
      await assert.rejects(app.withTransaction(client=>verify.ensureBriefingSourceFlags(client,p,[ids.mailA],[{...sources[0],contentRevision:'0'.repeat(64)}])),/changed/i);
      for(const invalid of ['is_draft=true','is_sent=true','provider_message_id=NULL']){
        await q(`UPDATE aca.email_messages SET ${invalid},provider_flags_requested_at=NULL WHERE id=$1`,[row.id]);
        const revision=(await q('SELECT aca.briefing_content_revision(id) revision FROM aca.email_messages WHERE id=$1',[row.id])).rows[0].revision;
        await assert.rejects(app.withTransaction(client=>verify.ensureBriefingSourceFlags(client,p,[ids.mailA],[{...sources[0],contentRevision:revision}])),/changed/i);
        assert.equal((await q('SELECT provider_flags_requested_at FROM aca.email_messages WHERE id=$1',[row.id])).rows[0].provider_flags_requested_at,null);
        await q("UPDATE aca.email_messages SET is_draft=false,is_sent=false,provider_message_id='INBOX:12' WHERE id=$1",[row.id]);
      }
      await access.revokeBriefingMailboxGrant({organizationId:ids.orgA,userId:ids.adminA},ids.userA,ids.mailA,'test revoke');
      await assert.rejects(check());
      assert.equal((await q('SELECT count(*)::int n FROM aca.mail_review_items')).rows[0].n,0);
    });
  }finally{await app?.closePostgresPool();await pool.end();}
});
