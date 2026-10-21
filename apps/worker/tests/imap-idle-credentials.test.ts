import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { resolveImapCredentialType } from "../src/email/imap-idle-worker";

test("IMAP IDLE supports historical password-based accounts without a stored credential_type", () => {
  assert.equal(resolveImapCredentialType({ username: "test@example.test", password: "redacted" }), "password");
  assert.equal(resolveImapCredentialType({ username: "test@example.test", password: "redacted", credential_type: null }), "password");
});

test("IMAP IDLE preserves all explicitly supported credential discriminants", () => {
  for (const credential_type of ["oauth_token", "password", "app_password"] as const) {
    assert.equal(resolveImapCredentialType({ credential_type }), credential_type);
  }
});

test("IMAP IDLE rejects malformed/missing credentials instead of silently changing authentication", () => {
  for (const invalid of [
    {}, { username: "test@example.test" }, { credential_type: "unknown", password: "redacted" },
    { credential_type: "", password: "redacted" }, { password: "" }, { password: 123 },
  ]) {
    assert.throws(() => resolveImapCredentialType(invalid), /invalid credential type/);
  }
});

test("future encrypted credential saves include the declared type in the encrypted payload", () => {
  const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/email/repository.ts"), "utf8");
  const save = repository.slice(repository.indexOf("async saveCredentials("), repository.indexOf("async loadCredentials("));
  assert.match(save, /JSON\.stringify\(\{ \.\.\.payload, credential_type: credentialType \}\)/);
});

test("the mailbox claim returns sync mode and staged IDs as separate columns", () => {
  const sync = readFileSync(resolve(__dirname, "../src/email/mailbox-sync-worker.ts"), "utf8");
  const claim = sync.slice(sync.indexOf("RETURNING cursor_token AS cursor"), sync.indexOf("if (!claimed.rows[0])"));
  assert.match(claim, /last_success_at, sync_mode,\s+pending_message_ids, pending_cursor_token/);
  assert.doesNotMatch(claim, /last_success_at, sync_mode\s+pending_message_ids/);
});

test("completed initial import commits the next mode instead of displaying initial forever", () => {
  const sync = readFileSync(resolve(__dirname, "../src/email/mailbox-sync-worker.ts"), "utf8");
  const completion = sync.slice(sync.indexOf("await removeDeletedMessages(candidate, providerDeleted);"), sync.indexOf("await accounts.updateSyncState(candidate.id"));
  assert.match(completion, /SET cursor_token=\$1, history_id=\$2, sync_mode=\$5, status='idle'/);
  assert.match(completion, /\[stagedCursor, stagedHistory, candidate.id, claimed.rows\[0\].last_attempt_at, stagedMode\]/);
});

test("IMAP retrieval uses one command at a time on a shared socket", () => {
  const sync = readFileSync(resolve(__dirname, "../src/email/mailbox-sync-worker.ts"), "utf8");
  const getMessages = sync.slice(sync.indexOf("// A single IMAP TLS socket cannot safely interleave"), sync.indexOf("messages.push(...settled);"));
  assert.match(getMessages, /candidate.provider === "imap_smtp" \? 1 : PERSIST_CONCURRENCY/);
  assert.match(getMessages, /await Promise.all\(/);
});
