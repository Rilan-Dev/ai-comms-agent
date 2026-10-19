import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { migrateFixture, seedBriefingFixture, testDatabaseUrl } from './helpers/briefing-db-fixture.mjs';

// This test can only run against the verified loopback, tmpfs Docker fixture.
// migrateFixture refuses a production URL and resets only the disposable DB.
const require = createRequire(new URL('../../../apps/worker/package.json', import.meta.url));
(await import(pathToFileURL(require.resolve('tsx/esm/api')).href)).register();

test('C3 canonical loading: full-grant scope, fenced source and revocation', async t => {
  const { pool } = await migrateFixture();
  let app;
  try {
    const ids = await seedBriefingFixture(pool);
    for (const { tablename } of (await pool.query("SELECT tablename FROM pg_tables WHERE schemaname='aca'")).rows) {
      await pool.query(`ALTER TABLE aca."${tablename}" OWNER TO c1_fixture`);
    }
    process.env.DATABASE_URL = testDatabaseUrl().replace('postgres@', 'c1_fixture@');
    process.env.DATABASE_SSL = 'false';

    const access = await import('../src/briefings/access.ts');
    const coverage = await import('../src/briefings/coverage.ts');
    const canonical = await import('../src/briefings/canonical-sources.ts');
    app = await import('../src/client.ts');
    const q = (sql, args = []) => pool.query(sql, args);
    const principal = { organizationId: ids.orgA, userId: ids.userA, agentId: ids.agentA };
    const admin = { organizationId: ids.orgA, userId: ids.adminA };
    const request = () => ({
      mode: 'catch_up', mailboxIds: [ids.mailA, ids.mailC],
      period: null, language: 'en', requestKey: randomUUID(),
    });
    await access.assignBriefingMailboxGrant(admin, ids.userA, ids.mailA, 'C3 disposable fixture');
    await access.assignBriefingMailboxGrant(admin, ids.userA, ids.mailC, 'C3 disposable fixture');

    // Deterministically ordered UUIDs force batch 1 to contain only mailbox A,
    // even though the immutable manifest includes both A and C.
    await q(`WITH threads AS (
      INSERT INTO aca.email_threads(organization_id,email_account_id)
      SELECT $1,$2 FROM generate_series(1,55) RETURNING id
    ), numbered AS (
      SELECT id,row_number() OVER (ORDER BY id) AS n FROM threads
    )
    INSERT INTO aca.email_messages(
      id,organization_id,email_account_id,thread_id,subject,text_body,received_at
    )
    SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
      $1,$2,id,'C3 bounded source','Please review the original email',
      now()-interval '1 day' FROM numbered`, [ids.orgA, ids.mailA]);
    const cThread = (await q(
      'INSERT INTO aca.email_threads(organization_id,email_account_id) VALUES($1,$2) RETURNING id',
      [ids.orgA, ids.mailC],
    )).rows[0].id;
    await q(`INSERT INTO aca.email_messages(
      id,organization_id,email_account_id,thread_id,subject,text_body,received_at
    ) VALUES('f0000000-0000-4000-8000-000000000001',$1,$2,$3,
      'Second mailbox','A separate authorized source',now()-interval '2 days')`,
    [ids.orgA, ids.mailC, cThread]);
    await q("UPDATE aca.email_messages SET received_at=now()-interval '1 day' WHERE id=$1", [ids.messageA]);

    const prepare = () => coverage.prepareBriefing(principal, request());
    const claimFor = async () => {
      const manifest = await prepare();
      assert.ok(manifest.sourceCount >= 57, 'both mailboxes must contribute');
      const claim = await coverage.claimBriefingBatch(principal, manifest.id, 'c3-disposable-test');
      assert.ok(claim, 'the C2 claim must exist');
      assert.equal(claim.sources.length, 50);
      assert.ok(claim.sources.every(s => s.mailboxId === ids.mailA),
        'first batch must be a strict subset of the full two-mailbox manifest');
      return { manifest, claim };
    };
    const release = async claim => q(
      "UPDATE aca.briefing_generation_batches SET lease_expires_at=now()-interval '1 second' WHERE id=$1",
      [claim.batchId],
    );

    await t.test('full two-mailbox scope permits claimed single-mailbox batch', async () => {
      const { manifest, claim } = await claimFor();
      try {
        assert.deepEqual(manifest.scope.mailboxIds, [ids.mailA, ids.mailC].sort());
        const loaded = await canonical.loadCanonicalBriefingSources(principal, claim);
        assert.equal(loaded.length, claim.sources.length);
        assert.deepEqual(
          new Set(loaded.map(s => s.messageId)),
          new Set(claim.sources.map(s => s.messageId)),
        );
        assert.ok(loaded.every(s => s.text.includes('email') || s.text === 'private body'));
        assert.ok(loaded.every(s => !s.partial));
      } finally { await release(claim); }
    });

    await t.test('other tenant, other user and substituted mailbox cannot load claimed source', async () => {
      const { claim } = await claimFor();
      try {
        await assert.rejects(canonical.loadCanonicalBriefingSources(
          { ...principal, organizationId: ids.orgB }, claim,
        ));
        await assert.rejects(canonical.loadCanonicalBriefingSources(
          { ...principal, userId: ids.userC }, claim,
        ));
        await assert.rejects(canonical.loadCanonicalBriefingSources(
          principal, { ...claim, sources: [{ ...claim.sources[0], mailboxId: ids.mailC },
            ...claim.sources.slice(1)] },
        ));
      } finally { await release(claim); }
    });

    await t.test('revoking an otherwise unused mailbox grant invalidates entire claimed manifest', async () => {
      const { claim } = await claimFor();
      try {
        await access.revokeBriefingMailboxGrant(
          admin, ids.userA, ids.mailC, 'C3 revoke after claim',
        );
        await assert.rejects(
          canonical.loadCanonicalBriefingSources(principal, claim),
          /Briefing access denied|scope changed|denied/i,
        );
      } finally {
        await release(claim);
        await access.assignBriefingMailboxGrant(
          admin, ids.userA, ids.mailC, 'C3 regrant for next fixture',
        );
      }
    });

    await t.test('content revision changed after claim is not returned to model', async () => {
      const { claim } = await claimFor();
      const id = claim.sources[0].messageId;
      try {
        await q("UPDATE aca.email_messages SET text_body=text_body || ' CHANGED' WHERE id=$1", [id]);
        await assert.rejects(
          canonical.loadCanonicalBriefingSources(principal, claim),
          /sources changed|scope changed|revision|conflict/i,
        );
      } finally { await release(claim); }
    });

    await t.test('superseded lease token and expired lease are denied', async () => {
      const { claim } = await claimFor();
      try {
        await assert.rejects(canonical.loadCanonicalBriefingSources(
          principal, { ...claim, leaseToken: randomUUID() },
        ), /lease|selection changed/i);
        await release(claim);
        await assert.rejects(
          canonical.loadCanonicalBriefingSources(principal, claim),
          /lease|selection changed/i,
        );
      } finally { await release(claim); }
    });
  } finally {
    if (app) await app.closePostgresPool();
    await pool.end();
  }
});
