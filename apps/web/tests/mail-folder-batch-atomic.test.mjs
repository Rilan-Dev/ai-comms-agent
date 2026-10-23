import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { isValidFolderBatchIds, isValidFolderId } from "../src/lib/mail/folder-batch-validation.ts";

const one = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const two = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const otherFolder = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("bulk mail folder selection rejects inaccessible-looking and malformed IDs before SQL", () => {
  assert.equal(isValidFolderBatchIds([]), false);
  assert.equal(isValidFolderBatchIds([one, "not-a-uuid"]), false);
  assert.equal(isValidFolderBatchIds([one, 123]), false);
  assert.equal(isValidFolderBatchIds("not-an-array"), false);
  assert.equal(isValidFolderBatchIds(Array(101).fill(one)), false);
  assert.equal(isValidFolderBatchIds([one, one.toUpperCase()]), false);
  assert.equal(isValidFolderBatchIds([one, two]), true);
  assert.equal(isValidFolderId(otherFolder), true);
  assert.equal(isValidFolderId("invalid-folder"), false);
});

test("folder API checks unique UUID IDs, tenant action and target before mutation", () => {
  const route = read("../src/app/api/mail/messages/folder/route.ts");
  const patch = route.slice(route.indexOf("export async function PATCH("));
  assert.match(patch, /isValidFolderBatchIds\(messageIds\)/);
  assert.match(patch, /isValidFolderId\(folderId\)/);
  assert.match(patch, /\["archive", "move"\]/);
  assert.match(patch, /permission: "organization.update"/);
  assert.match(patch, /assertSameOrigin\(request\)/);
  assert.ok(patch.indexOf("isValidFolderBatchIds(messageIds)") < patch.indexOf("archiveMailMessagesForOrganization("));
  assert.match(patch, /updated !== messageIds\.length/);
});

test("archive and move must share a transaction-level all-or-nothing implementation", () => {
  const repo = read("../../../packages/db/src/email/repository.ts");
  const from = repo.indexOf("async function changeMailFoldersAtomically(");
  const to = repo.indexOf("export async function listMailFoldersForOrganization(", from);
  assert.ok(from >= 0 && to > from);
  const segment = repo.slice(from, to);
  assert.match(segment, /withTransaction\(async \(client\) =>/);
  assert.match(segment, /FOR UPDATE OF m/);
  assert.match(segment, /selected\.rows\.length !== ids\.length/);
  assert.match(segment, /return 0;/);
  assert.match(segment, /f\.role = 'archive'/);
  assert.match(segment, /f\.id = \$2/);
  assert.match(segment, /f\.email_account_id/);
  assert.match(segment, /m\.organization_id = \$1/);
  assert.match(segment, /RETURNING m\.id/);
  assert.match(segment, /throw new Error\("Mail folder batch update was incomplete/);
  assert.match(segment, /new Set\(messageIds\.map\(id => id\.toLowerCase\(\)\)\)/);
});

test("public archive and move functions call the common atomic path and no independent update", () => {
  const repo = read("../../../packages/db/src/email/repository.ts");
  const from = repo.indexOf("export async function archiveMailMessagesForOrganization(");
  const to = repo.indexOf("export async function listMailFoldersForOrganization(", from);
  const segment = repo.slice(from, to);
  assert.match(segment, /return changeMailFoldersAtomically\(organizationId, messageIds, null\)/);
  assert.match(segment, /return changeMailFoldersAtomically\(organizationId, messageIds, folderId\)/);
  assert.equal((segment.match(/UPDATE email_messages m/g) ?? []).length, 0);
});

test("move destination row is explicitly present before its account ID is accessed (TS2532 regression)", () => {
  const repo = read("../../../packages/db/src/email/repository.ts");
  const start = repo.indexOf("async function changeMailFoldersAtomically(");
  const end = repo.indexOf("export async function archiveMailMessagesForOrganization(", start);
  assert.ok(start >= 0 && end > start);
  const move = repo.slice(start, end);
  assert.match(move, /const destinationRow = destination\.rows\[0\];/);
  assert.match(move, /if \(!destinationRow \|\| destination\.rows\.length !== 1/);
  assert.match(move, /destinationRow\.email_account_id !== accounts\[0\]/);
  assert.match(move, /targets = \[destinationRow\];/);
  assert.doesNotMatch(move, /destination\.rows\[0\]\.email_account_id/);
  assert.ok(move.indexOf("if (!destinationRow") < move.indexOf("destinationRow.email_account_id"));
});
