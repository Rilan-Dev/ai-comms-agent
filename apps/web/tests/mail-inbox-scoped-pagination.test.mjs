import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const repository = readFileSync(new URL("../../../packages/db/src/email/repository.ts", import.meta.url), "utf8");
const api = readFileSync(new URL("../src/app/api/mail/inbox/route.ts", import.meta.url), "utf8");
const start = repository.indexOf("export async function listInboxMessages(");
const end = repository.indexOf("export async function getMailMessageForOrganization(", start);
assert.ok(start >= 0 && end > start, "Inbox repository function must be found");
const source = repository.slice(start, end);
const bodyStart = source.indexOf("  const values:");
const bodyEnd = source.lastIndexOf("\n}");
assert.ok(bodyStart >= 0 && bodyEnd > bodyStart, "Inbox function body must be found");
const body = source.slice(bodyStart, bodyEnd)
  .replace("const values: unknown[] = [organizationId];", "const values = [organizationId];")
  .replace("query<Row>", "query");

async function runInboxQuery(filters) {
  let execution = null;
  const query = async (sql, params) => { execution = { sql, params }; return { rows: [] }; };
  const execute = new Function("organizationId", "filters", "query", `return (async () => { ${body} })();`);
  const rows = await execute("tenant-one", filters, query);
  assert.deepEqual(rows, []);
  assert.ok(execution, "Inbox query executed");
  return execution;
}

test("database page size honors the API's documented 500 maximum without dropping rows", async () => {
  assert.match(api, /limit > 500/);
  const at500 = await runInboxQuery({ limit: 500, offset: 500 });
  assert.deepEqual(at500.params.slice(-2), [500, 500]);
  const bounded = await runInboxQuery({ limit: 9999, offset: 0 });
  assert.equal(bounded.params.at(-2), 500);
  const small = await runInboxQuery({ limit: 37, offset: 12 });
  assert.deepEqual(small.params.slice(-2), [37, 12]);
});

test("Inbox results exclude locally persisted drafts for all providers and scope messages to the same tenant", async () => {
  const { sql } = await runInboxQuery({});
  assert.match(sql, /m\.organization_id = \$1/);
  assert.match(sql, /m\.is_draft = false/);
  assert.match(sql, /a\.organization_id = \$1/);
  assert.match(sql, /a\.deleted_at IS NULL/);
});

test("IMAP and other mapped provider folders require true Inbox membership", async () => {
  const { sql } = await runInboxQuery({});
  assert.match(sql, /EXISTS \(SELECT 1 FROM email_folders inbox_folder/);
  assert.match(sql, /inbox_folder\.id = m\.folder_id/);
  assert.match(sql, /inbox_folder\.email_account_id = m\.email_account_id/);
  assert.match(sql, /inbox_folder\.role = 'inbox'/);
  assert.match(sql, /UPPER\(inbox_folder\.provider_folder_id\) = 'INBOX'/);
  assert.doesNotMatch(sql, /a\.provider <> 'imap_smtp' OR EXISTS/);
});

test("unmapped historical inbound non-IMAP mail is retained, but not an unmapped sent item", async () => {
  const { sql } = await runInboxQuery({});
  assert.match(sql, /a\.provider <> 'imap_smtp' AND m\.folder_id IS NULL AND m\.is_sent = false/);
});

test("pagination uses a deterministic tie-breaker and retains existing query filters", async () => {
  const { sql, params } = await runInboxQuery({
    accountId: "account-one", unreadOnly: true, actionRequired: true,
    query: "invoice", limit: 50, offset: 100,
  });
  assert.match(sql, /ORDER BY m\.received_at DESC NULLS LAST, m\.id DESC/);
  assert.match(sql, /m\.email_account_id = \$2/);
  assert.match(sql, /m\.is_read = false/);
  assert.match(sql, /m\.action_required = true/);
  assert.match(sql, /m\.subject ILIKE \$3/);
  assert.deepEqual(params, ["tenant-one", "account-one", "%invoice%", 50, 100]);
});
