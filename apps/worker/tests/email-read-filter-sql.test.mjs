import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

// Execute the same SQL-fragment template literal that production's listMessages
// passes to add(...), not a separately reimplemented copy of the predicate.
const source = readFileSync(
  new URL("../../../packages/email-agent-runtime/src/email-read-tools.ts", import.meta.url), "utf8",
);
function compiledFilter(name, bindIndex) {
  const startToken = `if (${name}) add((n) => \``;
  const start = source.indexOf(startToken);
  assert.ok(start >= 0, `expected live ${name} filter in listMessages`);
  const quote = start + startToken.length - 1;
  const end = source.indexOf("`", quote + 1);
  assert.ok(end > quote, "filter template must be closed");
  return runInNewContext(`((n) => ${source.slice(quote, end + 1)})(${bindIndex})`);
}

test("folder filter uses the same bound text parameter for local ID, provider ID and folder name", () => {
  for (const index of [3, 11]) {
    const sql = compiledFilter("folderId", index);
    assert.equal((sql.match(new RegExp(`\\$${index}(?!\\d)`, "g")) ?? []).length, 4, sql);
    assert.match(sql, /f\.email_account_id = m\.email_account_id/);
    assert.match(sql, /f\.organization_id = \$1/);
    assert.doesNotMatch(sql, /(?:=|ILIKE)\s+\d+(?!\d)/);
  }
});

test("label JSONB containment compares against the bound label string rather than its parameter number", () => {
  for (const index of [3, 11]) {
    const sql = compiledFilter("label", index);
    assert.equal(sql, `m.labels @> jsonb_build_array($${index}::text)`);
  }
});

test("mail read filters retain the existing organization/account SQL boundaries", () => {
  assert.match(source, /m\.organization_id = \$1/);
  assert.match(source, /m\.email_account_id = \$2/);
  assert.match(source, /a\.organization_id = \$1/);
  assert.match(source, /a\.deleted_at IS NULL/);
  assert.match(source, /const account = await resolveAccount\(text\(input\.account_id\), context\)/);
});

test("folder matches are correlated to the current message folder, not any folder in the account", () => {
  for (const index of [3, 11]) {
    const sql = compiledFilter("folderId", index);
    // Without f.id = m.folder_id, a matching INBOX anywhere in the account
    // would make every All Mail / Sent message pass the folder filter.
    assert.match(sql, /f\.id\s*=\s*m\.folder_id\b/);
    assert.match(sql, /f\.email_account_id\s*=\s*m\.email_account_id/);
    assert.match(sql, /f\.organization_id\s*=\s*\$1/);
  }
});
