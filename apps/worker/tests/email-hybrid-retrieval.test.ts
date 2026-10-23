import assert from "node:assert/strict";
import test from "node:test";
import { query } from "@ai-comms-agent/db";
import { createEmailHybridRetriever, type EmailVectorCandidate } from "@ai-comms-agent/db";

const org = "00000000-0000-4000-8000-000000000001";
const agent = "00000000-0000-4000-8000-000000000002";
const account = "00000000-0000-4000-8000-000000000003";
const otherAccount = "00000000-0000-4000-8000-000000000004";

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    provider_message_id: "provider-message-1",
    email_account_id: account,
    thread_id: "thread-1",
    from_email: "billing@example.test",
    to_recipients: ["user@example.test"],
    subject: "Renewal terms",
    text_body: "The renewal period is thirty days.",
    snippet: "Renewal period is thirty days.",
    received_at: "2026-10-01T12:00:00.000Z",
    email_address: "work@example.test",
    provider: "gmail",
    score: 0.8,
    matched_by: ["semantic"],
    ...overrides,
  };
}

test("hybrid retrieval resolves fresh bindings and revalidates semantic candidates in SQL", async () => {
  const calls: Array<{ sql: string; values: unknown[] }> = [];
  let call = 0;
  const queryMock = (async (sql: string, values: unknown[] = []) => {
    calls.push({ sql, values });
    call += 1;
    if (call === 1) return { rows: [{ account_id: account }] };
    if (call === 2) return { rows: [] };
    if (call === 3) return { rows: [row()] };
    return { rows: [] };
  }) as unknown as typeof query;

  const hits: EmailVectorCandidate[] = [
    { orgId: org, accountId: account, messageId: "provider-message-1", contentHash: "a".repeat(64), score: 0.8 },
    { orgId: org, accountId: otherAccount, messageId: "must-not-leak", score: 0.99 },
    { orgId: "00000000-0000-4000-8000-000000000099", accountId: account, messageId: "wrong-org", score: 0.98 },
  ];
  let vectorScope: { orgId: string; allowedAccountIds: string[] } | null = null;
  const search = createEmailHybridRetriever({
    query: queryMock,
    vectorSearch: async (input) => {
      vectorScope = { orgId: input.orgId, allowedAccountIds: input.allowedAccountIds };
      return hits;
    },
  });

  const result = await search({ organizationId: org, agentId: agent, query: "renewal terms", limit: 5 });

  assert.equal(result.sources.length, 1);
  assert.equal(result.sources[0]?.citation, `email:${row().id}`);
  assert.deepEqual(result.sources[0]?.matchedBy, ["semantic"]);
  assert.deepEqual(vectorScope, { orgId: org, allowedAccountIds: [account] });
  assert.match(calls[2]?.sql ?? "", /JOIN agent_email_accounts/);
  assert.match(calls[2]?.sql ?? "", /jsonb_to_recordset/);
  assert.match(calls[2]?.sql ?? "", /COALESCE\(d\.sha256/);
  assert.match(calls[2]?.sql ?? "", /array_remove\(c\.matched_by, 'semantic'\)/);
  assert.deepEqual(calls[2]?.values[2], [account]);
  assert.match(String(calls[2]?.values[3] ?? ""), /"content_hash":"a{64}"/);
});

test("an explicitly empty account filter fails closed instead of widening scope", async () => {
  let calls = 0;
  const queryMock = (async () => {
    calls += 1;
    return { rows: [{ account_id: account }] };
  }) as unknown as typeof query;
  let vectorCalled = false;
  const search = createEmailHybridRetriever({
    query: queryMock,
    vectorSearch: async () => {
      vectorCalled = true;
      return [];
    },
  });

  const result = await search({ organizationId: org, agentId: agent, query: "invoice", accountIds: [] });

  assert.equal(result.sources.length, 0);
  assert.equal(result.allowedAccountCount, 0);
  assert.equal(calls, 1);
  assert.equal(vectorCalled, false);
});

test("semantic retrieval failure is reported as degraded lexical fallback", async () => {
  const queryMock = (async (_sql: string, _values: unknown[] = []) => {
    if (_sql.includes("SELECT a.id AS account_id")) return { rows: [{ account_id: account }] };
    if (_sql.includes("WITH candidates")) return { rows: [row({ score: 1, matched_by: ["lexical"] })] };
    return { rows: [row({ score: 1, matched_by: ["lexical"] })] };
  }) as unknown as typeof query;
  const search = createEmailHybridRetriever({
    query: queryMock,
    vectorSearch: async () => { throw new Error("private upstream detail"); },
  });

  const result = await search({ organizationId: org, agentId: agent, query: "renewal" });

  assert.equal(result.retrieval, "lexical_fallback");
  assert.equal(result.degraded, true);
  assert.match(result.note ?? "", /may be incomplete/);
});

test("hybrid lexical and semantic result paths suppress IMAP folder copies before their limits", async () => {
  const statements: string[] = [];
  const queryMock = (async (sql: string) => {
    statements.push(sql);
    if (sql.includes("SELECT a.id AS account_id")) return { rows: [{ account_id: account }] };
    return { rows: [row()] };
  }) as unknown as typeof query;
  const search = createEmailHybridRetriever({
    query: queryMock,
    vectorSearch: async () => [{ orgId: org, accountId: account, messageId: "provider-message-1",
      contentHash: "b".repeat(64), score: 0.9 }],
  });
  await search({ organizationId: org, agentId: agent, query: "renewal", limit: 5 });
  assert.equal(statements.length, 3);

  // Folder UID alone is not a logical email identity. Bound the logical key
  // per account, and only merge Gmail IMAP copies with a real Message-ID.
  for (const sql of [statements[1]!, statements[2]!]) {
    assert.match(sql, /ROW_NUMBER\(\) OVER/);
    assert.match(sql, /PARTITION BY m\.email_account_id/);
    assert.match(sql, /a\.provider='imap_smtp'/);
    assert.match(sql, /NULLIF\(BTRIM\(m\.internet_message_id\), ''\) IS NOT NULL/);
    assert.match(sql, /'message:' \|\| LOWER\(BTRIM\(m\.internet_message_id\)\)/);
    assert.match(sql, /'row:' \|\| m\.id::text/);
    assert.match(sql, /f\.email_account_id=m\.email_account_id/);
    assert.match(sql, /f\.role='inbox'/);
    assert.match(sql, /duplicate_rank=1/);
    assert.ok(sql.indexOf("duplicate_rank=1") < sql.lastIndexOf("LIMIT"), "Dedup must precede LIMIT");
    assert.match(sql, /b\.role IN \('primary','read_only'\)/);
    assert.match(sql, /m\.organization_id=\$1/);
  }
  assert.match(statements[2]!, /jsonb_to_recordset/);
  assert.match(statements[2]!, /array_remove\(c\.matched_by, 'semantic'\)/);
});
