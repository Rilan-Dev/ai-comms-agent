import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Exercise the *actual* tenant-scoped inbox query builder against a recording
// query client. This catches PostgreSQL 08P01 before a live database is needed.
const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
function inboxQueryBuilder(record) {
  const begin = repository.indexOf("export async function listInboxMessages(");
  const end = repository.indexOf("export async function getMailMessageForOrganization(", begin);
  assert.ok(begin >= 0 && end > begin, "expected production inbox query builder");
  const code = repository.slice(begin, end)
    .replace(
      /export async function listInboxMessages\([^\n]*\)\s*:\s*Promise<Array<Record<string, unknown>>>\s*\{/,
      "async function listInboxMessages(organizationId, filters = {}) {",
    )
    .replace("const values: unknown[] =", "const values =")
    .replace("query<Row>(", "query(");
  assert.match(code, /^async function listInboxMessages\(/);
  assert.doesNotMatch(code, /query<Row>|values: unknown\[\]/);
  return new Function("query", code + "\nreturn listInboxMessages;")(async (sql, values) => {
    record.push({ sql, values });
    return { rows: [] };
  });
}
function placeholders(sql) {
  return [...sql.matchAll(/\$(\d+)/g)].map(match => Number(match[1]));
}

const cases = [
  { name: "unfiltered page", filters: { limit: 2, offset: 3 }, count: 3 },
  { name: "filtered account page", filters: { accountId: "account-a", limit: 3, offset: 4 }, count: 4 },
  { name: "keyword page", filters: { query: "report", limit: 7, offset: 9 }, count: 4 },
  { name: "account and keyword page", filters: { accountId: "account-a", query: "report", limit: 9, offset: 2, unreadOnly: true, actionRequired: true }, count: 5 },
  { name: "default pagination", filters: {}, count: 3 },
];

for (const scenario of cases) {
  test("inbox binds every SQL parameter: " + scenario.name, async () => {
    const calls = [];
    const list = inboxQueryBuilder(calls);
    assert.deepEqual(await list("organization-a", scenario.filters), []);
    assert.equal(calls.length, 1);
    const { sql, values } = calls[0];
    assert.equal(values.length, scenario.count);
    assert.match(sql, /LIMIT \$\d+ OFFSET \$\d+$/);
    const indexes = [...new Set(placeholders(sql))].sort((a,b) => a-b);
    assert.deepEqual(indexes, Array.from({ length: values.length }, (_,i) => i+1),
      "PostgreSQL bind placeholders must cover all supplied values without gaps");
    assert.match(sql, /m\.organization_id = \$1/);
    assert.match(sql, /a\.organization_id = \$1/);
    assert.match(sql, /a\.deleted_at IS NULL/);
    assert.match(sql, /m\.is_draft = false/);
    assert.match(sql, /EXISTS \(SELECT 1 FROM email_folders inbox_folder/);
    if (scenario.filters.accountId) {
      assert.equal(values[1], scenario.filters.accountId);
      assert.match(sql, /m\.email_account_id = \$2/);
    }
    if (scenario.filters.query) {
      assert.ok(values.includes("%report%"));
      assert.ok(!sql.includes("ILIKE '%report%'"));
    }
    assert.equal(values.at(-2), scenario.filters.limit ?? 50);
    assert.equal(values.at(-1), scenario.filters.offset ?? 0);
  });
}

test("account and query values remain bound, never SQL interpolated", async () => {
  const calls = [];
  const list = inboxQueryBuilder(calls);
  const suspicious = "account-id'; DROP TABLE email_messages; --";
  await list("organization-a", { accountId: suspicious, query: "' OR TRUE --", limit: 501, offset: -20 });
  const { sql, values } = calls[0];
  assert.ok(!sql.includes(suspicious));
  assert.ok(!sql.includes("' OR TRUE --"));
  assert.equal(values[1], suspicious);
  assert.equal(values[2], "%' OR TRUE --%");
  assert.deepEqual(values.slice(-2), [500, 0]);
  assert.deepEqual([...new Set(placeholders(sql))].sort((a,b)=>a-b), [1,2,3,4,5]);
});
