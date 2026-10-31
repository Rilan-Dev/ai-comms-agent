import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
const runtimeSource = readFileSync(new URL("../../../packages/agent-core/src/runtime.ts", import.meta.url), "utf8");
const bounded = (text, begin, end) => {
  const start = text.indexOf(begin);
  const stop = text.indexOf(end, start + begin.length);
  assert.ok(start >= 0 && stop > start, `Cannot locate query between ${begin} and ${end}`);
  return text.slice(start, stop);
};
const ambient = bounded(chat, "const result = await query<EmailContextRow>(", "if (result.rows.length === 0)");
const ground = bounded(runtimeSource, "const recentResult = await query<", "// Merge results");

for (const [name, sql] of [["ambient Chat context", ambient], ["agent hybrid context", ground]]) {
  test(`${name} deduplicates IMAP folder copies before applying a 20-email limit`, () => {
    assert.match(sql, /ROW_NUMBER\(\) OVER/);
    assert.match(sql, /PARTITION BY (?:m|em)\.email_account_id/);
    assert.match(sql, /(?:a|ea)\.provider = 'imap_smtp'/);
    assert.match(sql, /NULLIF\(BTRIM\((?:m|em)\.internet_message_id\), ''\) IS NOT NULL/);
    assert.match(sql, /LOWER\(BTRIM\((?:m|em)\.internet_message_id\)\)/);
    assert.match(sql, /'row:' \|\| (?:m|em)\.id::text/);
    assert.match(sql, /duplicate_rank = 1/);
    assert.ok(sql.indexOf("duplicate_rank = 1") < sql.indexOf("LIMIT 20"), "dedup must occur before LIMIT");
  });

  test(`${name} chooses INBOX without weakening the agent, tenant or provider boundaries`, () => {
    const scopedSql = name === "ambient Chat context" ? chat : sql;
    assert.match(scopedSql, /JOIN agent_email_accounts b/);
    assert.match(scopedSql, /b\.role IN \('primary', 'read_only'\)/);
    if (name === "ambient Chat context") {
      assert.match(sql, /agentScopeSql\.replace/); // injects the verified binding join
    }
    assert.match(sql, /(?:m|em)\.organization_id = \$1/);
    assert.match(sql, /(?:f|folder)\.role = 'inbox'/);
    assert.match(sql, /UPPER\((?:f|folder)\.provider_folder_id\) = 'INBOX'/);
    assert.match(sql, /(?:f|folder)\.email_account_id = (?:m|em)\.email_account_id/);
  });
}

test("chat fallback date and explicit sender filters execute before folder ranking", () => {
  assert.match(ambient, /\$\{matchSql\}/);
  assert.ok(ambient.indexOf("${matchSql}") < ambient.indexOf("duplicate_rank = 1"));
  assert.match(chat, /m\.subject ILIKE '%' \|\| term \|\| '%'/);
  assert.match(chat, /b\.agent_id = \$agentId/);
});

test("Agent hybrid retrieval keeps typed full-text search, agent scope and existing metadata", () => {
  assert.match(ground, /\$\{matchClause\}/);
  assert.ok(ground.indexOf("${matchClause}") < ground.indexOf("duplicate_rank = 1"));
  assert.match(runtimeSource, /em\.search_vector @@ to_tsquery\('simple', \$3\)/); // query fragment is assembled before the SQL template
  assert.match(runtimeSource, /\[ctx\.orgId, ctx\.agentId, textQuery, lookupTerms\]/);
  assert.match(ground, /'provider_message_id', em\.provider_message_id/);
  assert.match(ground, /em\.is_draft = false/);
});
