import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isValidMailMessageIds } from "../src/lib/mail/folder-batch-validation.ts";

const first="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const second="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const source = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("shared message batch check prevents filtered and duplicate read-state updates", () => {
  assert.equal(isValidMailMessageIds([first,second]), true);
  for (const ids of [[],[first,first.toUpperCase()],[first,"invalid"],[first,7],Array(101).fill(first)]) {
    assert.equal(isValidMailMessageIds(ids), false);
  }
});

test("read-state route denies partial batch before recording a success audit", () => {
  const handler=source("../src/app/api/mail/messages/read-state/route.ts");
  assert.match(handler, /isValidMailMessageIds\(messageIds\)/);
  assert.doesNotMatch(handler, /messageIds\.filter\(/);
  assert.match(handler, /permission: "email\.read"/);
  assert.match(handler, /assertSameOrigin\(request\)/);
  assert.match(handler, /if \(updated !== messageIds\.length\)/);
  assert.match(handler, /status: 404/);
  assert.ok(handler.indexOf("if (updated !== messageIds.length)") < handler.indexOf("await recordAuditEvent("));
});

test("database changes mail read flags only after complete tenant-scoped locked selection", () => {
  const repo=source("../../../packages/db/src/email/repository.ts");
  const start=repo.indexOf("export async function updateMailReadStateForOrganization(");
  const end=repo.indexOf("async function changeMailFoldersAtomically(",start);
  const method=repo.slice(start,end);
  assert.ok(start>=0 && end>start);
  assert.match(method,/withTransaction\(async \(client\) =>/);
  assert.match(method,/FOR UPDATE OF m/);
  assert.match(method,/m\.organization_id = \$1 AND a\.organization_id = \$1/);
  assert.match(method,/a\.deleted_at IS NULL AND m\.id = ANY\(\$2::uuid\[\]\)/);
  assert.match(method,/\[organizationId, messageIds\]/);
  assert.match(method,/m\.organization_id = \$2 AND m\.id = ANY\(\$3::uuid\[\]\)/);
  assert.match(method,/selected\.rows\.length !== messageIds\.length/);
  assert.match(method,/UPDATE email_messages m/);
  assert.match(method,/if \(update\.rows\.length !== messageIds\.length\)/);
  assert.match(method,/transaction rolled back/);
});
