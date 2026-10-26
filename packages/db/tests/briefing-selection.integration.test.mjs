import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { migrateFixture, seedBriefingFixture, testDatabaseUrl } from './helpers/briefing-db-fixture.mjs';
const require=createRequire(new URL('../../../apps/worker/package.json',import.meta.url));
(await import(pathToFileURL(require.resolve('tsx/esm/api')).href)).register();

test('C2 persisted selection, review and crash recovery',async t=>{
  const {pool}=await migrateFixture();let app;
  try {
    const ids=await seedBriefingFixture(pool);
    for(const {tablename} of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='aca'")).rows)
      await pool.query(`ALTER TABLE aca."${tablename}" OWNER TO c1_fixture`);
    process.env.DATABASE_URL=testDatabaseUrl().replace('postgres@','c1_fixture@');process.env.DATABASE_SSL='false';
    const access=await import('../src/briefings/access.ts');
    const api=await import('../src/briefings/coverage.ts');
    const reads=await import('../src/briefings/repository.ts');
    const canonical=await import('../src/briefings/canonical-sources.ts');
    const {publishBriefingItems}=await import('../src/briefings/selection.ts');
    app=await import('../src/client.ts');
    const p={organizationId:ids.orgA,userId:ids.userA,agentId:ids.agentA};
    const admin={organizationId:ids.orgA,userId:ids.adminA};
    const q=(sql,args=[])=>pool.query(sql,args);
    await access.assignBriefingMailboxGrant(admin,ids.userA,ids.mailA,'selection tests');
    await q("UPDATE aca.email_messages SET received_at=now()-interval '5 days' WHERE id=$1",[ids.messageA]);
    const req=(key,extra={})=>({mode:'catch_up',mailboxIds:[ids.mailA],period:null,language:'en',requestKey:key,...extra});
    const prepare=key=>api.prepareBriefing(p,req(key));
    const sourceIds=async id=>(await api.listBriefingSources(p,id,null,200)).items.map(s=>s.messageId);
    const evidenceItem=(source,start=0,representation='complete')=>({id:'model-id',sourceIds:[source.messageId],title:'Obligation',summary:'Please act',reason:'Explicit request',priority:'high',deadline:null,confidence:'supported',suggestedAction:'reply',representation,snoozedUntil:null,evidence:[{sourceId:source.messageId,contentRevision:source.contentRevision,start,end:start+1,quote:'p',supports:'summary'}]});
    const finish=async(manifest,items,partial=false)=>{
      const claim=await api.claimBriefingBatch(p,manifest.id,'test-worker');
      assert.ok(claim);
      await api.completeBriefingBatch(p,claim,items,partial);
      return claim;
    };
    await t.test('scheduled claims reauthorize the current routine before work',async()=>{
      const request=req('guard-routine',{mode:'scheduled',period:{start:new Date(Date.now()-7*86400000).toISOString(),end:new Date().toISOString()},routine:{id:randomUUID(),revision:1,occurrenceId:randomUUID(),coverageKey:'guard',window:'previous_24_hours'}});
      const adapter={load:async()=>({historyStart:request.period.start,completedSourceKeys:new Set()}),complete:async()=>{}};
      const m=await api.prepareBriefing(p,request,adapter);
      try {
        await assert.rejects(api.claimBriefingBatch(p,m.id,'no-adapter'),/adapter/i);
        await assert.rejects(api.claimBriefingBatch(p,m.id,'paused',{...adapter,load:async()=>{throw new Error('routine paused');}}),/paused/);
        const paused={...adapter,load:async()=>{throw new Error('routine paused');}};
        const claim=await api.claimBriefingBatch(p,m.id,'authorized',adapter);
        const before=(await q('SELECT status,lease_token,lease_expires_at FROM aca.briefing_generation_batches WHERE id=$1',[claim.batchId])).rows[0];
        await assert.rejects(api.heartbeatBriefingBatch(p,claim),/adapter/i);
        await assert.rejects(api.heartbeatBriefingBatch(p,claim,paused),/paused/);
        await assert.rejects(api.completeBriefingBatch(p,claim,[],true),/adapter/i);
        await assert.rejects(api.completeBriefingBatch(p,claim,[],true,paused),/paused/);
        assert.deepEqual((await q('SELECT status,lease_token,lease_expires_at FROM aca.briefing_generation_batches WHERE id=$1',[claim.batchId])).rows[0],before);
        assert.deepEqual((await q('SELECT content_json FROM aca.summaries WHERE id=$1',[m.id])).rows[0].content_json,[]);
        await assert.rejects(api.prepareBriefing(p,request,paused),/paused/);

      } finally {await q('DELETE FROM aca.summaries WHERE id=$1',[m.id]);}
    });
    await t.test('claimed work exposes canonical sources through the public API',async()=>{
      const m=await prepare('public-claim');
      try {
        const claim=await api.claimBriefingBatch(p,m.id,'public-worker');
        assert.ok(Array.isArray(claim.sources));
        assert.equal(claim.sources[0].messageId,ids.messageA);
      } finally {await q('DELETE FROM aca.summaries WHERE id=$1',[m.id]);}
    });
    await t.test('incoming selection excludes sent/draft mail but includes an old newly synced incoming message',async()=>{
      const created=[];
      for(const kind of ['draft','sent','late']) {
        const thread=(await q('INSERT INTO aca.email_threads(organization_id,email_account_id) VALUES($1,$2) RETURNING id',[ids.orgA,ids.mailA])).rows[0].id;
        const message=(await q("INSERT INTO aca.email_messages(organization_id,email_account_id,thread_id,text_body,is_draft,is_sent,received_at,created_at) VALUES($1,$2,$3,'new sync',$4,$5,now()-interval '60 days',now()-interval '1 second') RETURNING id",[ids.orgA,ids.mailA,thread,kind==='draft',kind==='sent'])).rows[0].id;
        created.push({kind,id:message});
      }
      const m=await prepare('incoming-only');const selected=await sourceIds(m.id);
      assert.ok(selected.includes(created.find(m=>m.kind==='late').id));
      assert.ok(created.filter(m=>m.kind!=='late').every(m=>!selected.includes(m.id)));
      await q('DELETE FROM aca.email_messages WHERE id=ANY($1::uuid[])',[created.map(m=>m.id)]);
    });
    await t.test('catch-up excludes provider-read mail without acknowledging it for the user',async()=>{
      await q('UPDATE aca.email_messages SET is_read=true WHERE id=$1',[ids.messageA]);
      try {
        const m=await prepare('provider-read-excluded');
        assert.equal(m.sourceCount,0);
        assert.equal((await q('SELECT count(*)::int n FROM aca.briefing_review_sources WHERE message_id=$1',[ids.messageA])).rows[0].n,0);
      } finally { await q('UPDATE aca.email_messages SET is_read=false WHERE id=$1',[ids.messageA]); }
    });
    await t.test('provider read after selection prevents a catch-up generation claim',async()=>{
      const m=await prepare('provider-read-before-claim');
      await q('UPDATE aca.email_messages SET is_read=true WHERE id=$1',[ids.messageA]);
      try { await assert.rejects(api.claimBriefingBatch(p,m.id,'stale-unread-worker'),/conflict/i); }
      finally {
        await q('UPDATE aca.email_messages SET is_read=false WHERE id=$1',[ids.messageA]);
        await q('DELETE FROM aca.summaries WHERE id=$1',[m.id]);
      }
    });
    await t.test('provider read during generation prevents publishing a stale catch-up',async()=>{
      const m=await prepare('provider-read-before-publish');
      const source=(await api.listBriefingSources(p,m.id)).items[0];
      const claim=await api.claimBriefingBatch(p,m.id,'stale-publication-worker');
      await q('UPDATE aca.email_messages SET is_read=true WHERE id=$1',[ids.messageA]);
      try {
        await assert.rejects(canonical.loadCanonicalBriefingSources(p,claim),/source.*changed/i);
        await assert.rejects(api.completeBriefingBatch(p,claim,[evidenceItem(source)],false),/conflict/i);
        assert.deepEqual((await q('SELECT content_json FROM aca.summaries WHERE id=$1',[m.id])).rows[0].content_json,[]);
      } finally {
        await q('UPDATE aca.email_messages SET is_read=false WHERE id=$1',[ids.messageA]);
        await q('DELETE FROM aca.summaries WHERE id=$1',[m.id]);
      }
    });
    await t.test('upstream publication compatibility registers grounded output through the lease boundary',async()=>{
      const m=await prepare('compat-publication');const source=(await api.listBriefingSources(p,m.id)).items[0];
      await assert.rejects(publishBriefingItems(p,m.id,m.scope.scopeVersion,[{...evidenceItem(source),evidence:[{...evidenceItem(source).evidence[0],quote:'fabricated'}]}]),/canonical mail/);
      const published=await publishBriefingItems(p,m.id,m.scope.scopeVersion,[evidenceItem(source)]);
      assert.equal(published.status,'ready');
      const read=await reads.getBriefing(p,m.id);assert.equal(read.items.length,1);assert.equal(read.manifest.status,'ready');
    });
    await t.test('missing persisted provenance invalidates reads and prevents claiming work',async()=>{
      const m=await prepare('missing-provenance');
      await q('DELETE FROM aca.summary_sources WHERE summary_id=$1',[m.id]);
      assert.equal((await reads.getBriefing(p,m.id)).manifest.status,'invalidated');
      await assert.rejects(api.listBriefingSources(p,m.id),/conflict/i);
      await assert.rejects(api.claimBriefingBatch(p,m.id,'missing-worker'),/conflict/i);
    });
    let first,source,stableIds;
    await t.test('five-day absence selects mail; identical retries reuse immutable manifest',async()=>{
      first=await prepare('first');source=(await api.listBriefingSources(p,first.id,null,200)).items[0];
      assert.equal(first.sourceCount,1);assert.equal(source.messageId,ids.messageA);
      const retry=await prepare('first');assert.equal(retry.id,first.id);
      const concurrent=await Promise.all([prepare('concurrent'),prepare('concurrent')]);assert.equal(concurrent[0].id,concurrent[1].id);
      await assert.rejects(api.prepareBriefing(p,req('first',{language:'fr'})),/conflict/i);
      assert.equal((await q('SELECT is_read FROM aca.email_messages WHERE id=$1',[ids.messageA])).rows[0].is_read,false);
      await assert.rejects(api.listBriefingSources({...p,userId:ids.adminA},first.id,null,200));
    });
    await t.test('two obligations require both explicit acknowledgements; retries and two devices are safe',async()=>{
      await finish(first,[evidenceItem(source,0),evidenceItem(source,2)]);
      const overlap=await prepare('overlap');
      await finish(overlap,[{...evidenceItem(source,2),title:'Reworded'},evidenceItem(source,0)]);
      const stored=(await q('SELECT content_json FROM aca.summaries WHERE id=$1',[first.id])).rows[0].content_json;
      const overlapping=(await q('SELECT content_json FROM aca.summaries WHERE id=$1',[overlap.id])).rows[0].content_json;
      assert.deepEqual(overlapping.map(i=>i.id).sort(),stored.map(i=>i.id).sort());
      stableIds=stored.map(i=>i.id);assert.equal(new Set(stableIds).size,2);
      await api.acknowledgeBriefingItems(p,first.id,[stableIds[0]],first.scope.scopeVersion);
      assert.deepEqual(await sourceIds((await prepare('one-reviewed')).id),[ids.messageA]);
      const answers=await Promise.all([1,2].map(()=>api.acknowledgeBriefingItems(p,first.id,[stableIds[1]],first.scope.scopeVersion)));
      assert.equal(answers.reduce((n,r)=>n+r.reviewed,0),1);
      assert.deepEqual(new Set((await reads.getBriefing(p,first.id)).reviewedItemIds),new Set(stableIds));
      const empty=await prepare('both-reviewed');assert.equal(empty.sourceCount,0);
      assert.equal((await reads.getBriefing(p,empty.id)).manifest.status,'ready');
      assert.equal((await reads.listBriefings(p)).briefings.find(b=>b.manifest.id===empty.id).manifest.status,'ready');
      await q("UPDATE aca.summaries SET derived_expires_at=now()-interval '1 second' WHERE id=$1",[overlap.id]);
      assert.equal((await prepare('expired-output')).sourceCount,0);
      assert.equal((await reads.getBriefing(p,overlap.id)).manifest.status,'invalidated');
      assert.equal((await q('SELECT is_read FROM aca.email_messages WHERE id=$1',[ids.messageA])).rows[0].is_read,false);
      await assert.rejects(api.acknowledgeBriefingItems(p,first.id,stableIds,'stale'),/conflict/i);
    });
    await t.test('metadata-only changes stay reviewed; a new reply changes source revision',async()=>{
      await q('UPDATE aca.email_messages SET is_read=true WHERE id=$1',[ids.messageA]);
      assert.equal((await prepare('metadata-only')).sourceCount,0);
      await q("INSERT INTO aca.email_messages(organization_id,email_account_id,thread_id,text_body,received_at) VALUES($1,$2,$3,'reply',now())",[ids.orgA,ids.mailA,ids.threadA]);
      const next=await prepare('new-reply');assert.equal(next.sourceCount,1);
      assert.ok(!(await sourceIds(next.id)).includes(ids.messageA));
      await assert.rejects(api.acknowledgeBriefingItems(p,first.id,stableIds,first.scope.scopeVersion),/conflict/i);
    });
    await t.test('late committed old mail remains eligible; earlier manifest never changes',async()=>{
      const before=await prepare('before-late');const old=await sourceIds(before.id);
      const msg=(await q("INSERT INTO aca.email_messages(organization_id,email_account_id,thread_id,text_body,received_at) VALUES($1,$2,$3,'late sync',now()-interval '6 days') RETURNING id",[ids.orgA,ids.mailA,ids.threadA])).rows[0].id;
      // A changed thread invalidates old saved sources instead of silently changing them.
      await assert.rejects(api.listBriefingSources(p,before.id,null,200),/conflict/i);
      const after=await prepare('after-late');assert.ok((await sourceIds(after.id)).includes(msg));
      assert.equal((await q('SELECT count(*) FROM aca.summary_sources WHERE summary_id=$1',[before.id])).rows[0].count,String(old.length));
    });
    await t.test('partial generation cannot acknowledge omitted work; snooze is not review',async()=>{
      const m=await prepare('partial');const sources=(await api.listBriefingSources(p,m.id,null,200)).items;
      await finish(m,[evidenceItem(sources[0],0,'partial')],true);
      const item=(await q('SELECT content_json FROM aca.summaries WHERE id=$1',[m.id])).rows[0].content_json[0];
      await assert.rejects(api.acknowledgeBriefingItems(p,m.id,[item.id],m.scope.scopeVersion),/complete/i);
      await assert.rejects(api.snoozeBriefingItem(p,m.id,item.id,'2026-10-20T09:00:00',m.scope.scopeVersion),/UTC/i);
      await api.snoozeBriefingItem(p,m.id,item.id,new Date(Date.now()+60000).toISOString(),m.scope.scopeVersion);
      assert.equal((await q('SELECT acknowledged_at FROM aca.mail_review_items WHERE item_id=$1',[item.id])).rows[0].acknowledged_at,null);
      assert.ok((await prepare('after-partial')).sourceCount>0);
      assert.deepEqual((await reads.getBriefing(p,m.id)).items,[]);
      await q("UPDATE aca.mail_review_items SET snoozed_until=now()-interval '1 second' WHERE item_id=$1",[item.id]);
      assert.equal((await reads.getBriefing(p,m.id)).items[0].id,item.id);
    });
    await t.test('deterministic source-list fallback persists as partial and full regeneration replaces only partial coverage',async()=>{
      const {generateBriefingBatch}=await import('../../email-agent-runtime/src/briefings/generation.ts');
      const m=await prepare('fallback');const sources=(await api.listBriefingSources(p,m.id)).items;
      const result=await generateBriefingBatch(sources.map(source=>({...source,text:'private body'})),async()=>{throw new Error('provider timeout');});
      assert.equal(result.status,'partial');
      const claim=await api.claimBriefingBatch(p,m.id,'fallback-worker');
      await assert.rejects(api.completeBriefingBatch(p,claim,[{...result.items[0],summary:'invented private claim'}],true),/Invalid/);
      await api.completeBriefingBatch(p,claim,result.items,true);
      const read=await reads.getBriefing(p,m.id);assert.equal(read.items.length,sources.length);
      assert.ok(read.items.every(item=>item.representation==='partial' && item.evidence.length===0));
      const regenerated=await prepare('fallback-regenerated');
      await finish(regenerated,sources.map(source=>evidenceItem(source)));
      const pendingPartial=await q("SELECT count(*) FROM aca.mail_review_items WHERE organization_id=$1 AND scope_version=$2 AND representation='partial'",[p.organizationId,regenerated.scope.scopeVersion]);
      assert.equal(pendingPartial.rows[0].count,'0');
    });
    await t.test('expired leases resume unfinished sources; stale workers cannot complete or heartbeat',async()=>{
      const m=await prepare('lease');const a=await api.claimBriefingBatch(p,m.id,'worker-a');assert.ok(a);
      assert.equal(await api.claimBriefingBatch(p,m.id,'worker-b'),null);
      assert.equal(await api.heartbeatBriefingBatch(p,a),true);
      await q("UPDATE aca.briefing_generation_batches SET lease_expires_at=now()-interval '1 second' WHERE id=$1",[a.batchId]);
      await app.closePostgresPool();
      const b=await api.claimBriefingBatch(p,m.id,'worker-b');assert.ok(b);assert.notEqual(a.leaseToken,b.leaseToken);assert.deepEqual(b.sources,a.sources);
      assert.equal(await api.heartbeatBriefingBatch(p,a),false);
      await assert.rejects(api.completeBriefingBatch(p,a,[],false),/lease/i);
      await api.completeBriefingBatch(p,b,[],true);
    });
    await t.test('revoked scope cannot acknowledge, and a new grant cannot inherit old review coverage',async()=>{
      await access.revokeBriefingMailboxGrant(admin,ids.userA,ids.mailA,'test revoke');
      await assert.rejects(api.acknowledgeBriefingItems(p,first.id,stableIds,first.scope.scopeVersion));
      await access.assignBriefingMailboxGrant(admin,ids.userA,ids.mailA,'test regrant');
      const next=await prepare('new-grant');assert.notEqual(next.scope.scopeVersion,first.scope.scopeVersion);assert.ok(next.sourceCount>0);
    });
    await t.test('5000 equal-timestamp candidates paginate without duplicates or missing sources',async()=>{
      const other=await seedBriefingFixture(pool);
      const who={organizationId:other.orgA,userId:other.userA,agentId:other.agentA};
      await access.assignBriefingMailboxGrant({organizationId:other.orgA,userId:other.adminA},other.userA,other.mailA,'bulk');
      await q('DELETE FROM aca.email_messages WHERE id=$1',[other.messageA]);
      await q(`WITH threads AS (INSERT INTO aca.email_threads(organization_id,email_account_id) SELECT $1,$2 FROM generate_series(1,5000) RETURNING id)
        INSERT INTO aca.email_messages(organization_id,email_account_id,thread_id,received_at,text_body)
        SELECT $1,$2,id,now()-interval '2 days','bulk' FROM threads`,[other.orgA,other.mailA]);
      const m=await api.prepareBriefing(who,{...req('bulk'),mailboxIds:[other.mailA]});assert.equal(m.sourceCount,5000);
      const seen=new Set();let cursor=null,pages=0;
      do {const page=await api.listBriefingSources(who,m.id,cursor,200);assert.ok(page.items.length<=200);page.items.forEach(s=>seen.add(s.messageId));cursor=page.nextCursor;pages++;}while(cursor);
      assert.equal(seen.size,5000);assert.equal(pages,25);
      const counts=(await q('SELECT max(source_count) sources,max(estimated_input_tokens) tokens,sum(source_count) total FROM aca.briefing_generation_batches b JOIN aca.briefing_generation_jobs j ON j.id=b.job_id WHERE j.summary_id=$1',[m.id])).rows[0];
      assert.ok(counts.sources<=50 && counts.tokens<=12000);assert.equal(Number(counts.total),5000);
      await assert.rejects(publishBriefingItems(who,m.id,m.scope.scopeVersion,[]),/batch API/);
      const claims=await Promise.all([1,2,3].map(i=>api.claimBriefingBatch(who,m.id,`parallel-${i}`)));
      assert.equal(claims.filter(Boolean).length,2);
      assert.equal(new Set(claims.filter(Boolean).flatMap(claim=>claim.sources.map(source=>source.messageId))).size,100);
      for(const claim of claims.filter(Boolean)) {
        assert.equal(claim.sources.length,50);
        assert.ok(claim.sources.every(source=>seen.has(source.messageId)));
        await api.completeBriefingBatch(who,claim,claim.sources.map(source=>evidenceItem(source)),false);
      }
    });
    await t.test('scheduled adapter isolates routines and generation coverage from personal review and delivery',async()=>{
      await q('CREATE TABLE aca.fixture_routine_coverage(routine_id uuid,scope_key text,source_key text,PRIMARY KEY(routine_id,scope_key,source_key))');
      await q('GRANT ALL ON aca.fixture_routine_coverage TO c1_fixture');
      const start=new Date(Date.now()-7*86400000).toISOString();
      const adapter={
        async load(client,who,request,scope){
          assert.equal(who.userId,p.userId);assert.equal(scope.scopeVersion,(await access.resolveBriefingScope(p,[ids.mailA])).scopeVersion);
          return {historyStart:start,completedSourceKeys:new Set((await client.query('SELECT source_key FROM aca.fixture_routine_coverage WHERE routine_id=$1 AND scope_key=$2',[request.routine.id,request.routine.coverageKey])).rows.map(r=>r.source_key))};
        },
        async complete(client,who,request,scope,id,sources){
          for(const source of sources)await client.query('INSERT INTO aca.fixture_routine_coverage VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[request.routine.id,request.routine.coverageKey,`${source.messageId}:${source.contentRevision}`]);
        }
      };
      const routineA=randomUUID(),routineB=randomUUID();
      const scheduled=(key,id= routineA,coverageKey='same',window='since_previous_occurrence',revision=1)=>req(key,{mode:'scheduled',period:{start:new Date(Date.now()-86400000).toISOString(),end:new Date().toISOString()},routine:{id,revision,occurrenceId:randomUUID(),coverageKey,window}});
      // Two missed daily fires still include the older uncovered five/six-day mail.
      const a=await api.prepareBriefing(p,scheduled('routine-a'),adapter);assert.ok(a.sourceCount>=3);
      const sources=(await api.listBriefingSources(p,a.id)).items;
      await assert.rejects(api.claimBriefingBatch(p,a.id,'unauthorized-worker'),/adapter/i);
      await assert.rejects(api.claimBriefingBatch(p,a.id,'paused-worker',{...adapter,load:async()=>{throw new Error('routine paused');}}),/paused/);
      const claim=await api.claimBriefingBatch(p,a.id,'routine-worker',adapter);
      const personalBefore=(await q('SELECT count(*) FROM aca.mail_review_items')).rows[0].count;
      await api.completeBriefingBatch(p,claim,sources.map(s=>evidenceItem(s)),false,adapter);
      assert.equal((await q('SELECT count(*) FROM aca.mail_review_items')).rows[0].count,personalBefore);
      await assert.rejects(api.acknowledgeBriefingItems(p,a.id,['anything'],a.scope.scopeVersion),/separate/i);
      // Unknown delivery never clears generation coverage or triggers regeneration.
      const empty=await api.prepareBriefing(p,scheduled('unknown-delivery-recovery'),adapter);assert.equal(empty.sourceCount,0);
      assert.equal((await reads.getBriefing(p,empty.id)).manifest.status,'ready');
      assert.equal((await reads.listBriefings(p)).briefings.find(b=>b.manifest.id===empty.id).manifest.status,'ready');
      assert.equal((await api.prepareBriefing(p,scheduled('edited-revision',routineA,'same','since_previous_occurrence',2),adapter)).sourceCount,0);
      assert.equal((await api.prepareBriefing(p,scheduled('other-routine',routineB),adapter)).sourceCount,a.sourceCount);
      assert.equal((await api.prepareBriefing(p,scheduled('new-scope',routineA,'new'),adapter)).sourceCount,a.sourceCount);
      assert.ok((await api.prepareBriefing(p,scheduled('intentional-overlap',routineA,'same','previous_24_hours'),adapter)).sourceCount>0);
      const partialManifest=await api.prepareBriefing(p,scheduled('routine-partial',routineB),adapter);
      const partialClaim=await api.claimBriefingBatch(p,partialManifest.id,'partial-worker',adapter);
      await api.completeBriefingBatch(p,partialClaim,[],true,adapter);
      assert.equal((await api.prepareBriefing(p,scheduled('partial-retry',routineB),adapter)).sourceCount,a.sourceCount);
      const personal=await prepare('personal-after-routine');assert.ok(personal.sourceCount>0);
      const personalSources=(await api.listBriefingSources(p,personal.id)).items;
      await finish(personal,personalSources.map(source=>evidenceItem(source)));
      const represented=(await q('SELECT content_json FROM aca.summaries WHERE id=$1',[personal.id])).rows[0].content_json;
      await api.acknowledgeBriefingItems(p,personal.id,represented.map(i=>i.id),personal.scope.scopeVersion);
      assert.equal((await prepare('personal-done')).sourceCount,0);
      assert.equal((await api.prepareBriefing(p,scheduled('routine-after-personal-review',routineB),adapter)).sourceCount,a.sourceCount);

    });
    await t.test('scheduled selection requires a trusted coverage adapter and cannot borrow personal history',async()=>{
      await assert.rejects(api.prepareBriefing(p,req('scheduled',{mode:'scheduled',period:{start:new Date(Date.now()-86400000).toISOString(),end:new Date().toISOString()},routine:{id:randomUUID(),revision:1,occurrenceId:randomUUID(),coverageKey:'scope',window:'since_previous_occurrence'}})),/adapter/i);
    });
  }finally{if(app)await app.closePostgresPool();await pool.end();}
});
