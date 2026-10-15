import assert from "node:assert/strict";
import test from "node:test";
import {
  isImapIdleChangeNotification,
  serverSupportsImapIdle,
} from "../src/email/imap-smtp-adapter.ts";

test("IMAP IDLE capability detection requires an explicit IDLE token", () => {
  assert.equal(serverSupportsImapIdle(["* CAPABILITY IMAP4rev1 IDLE UIDPLUS"]), true);
  assert.equal(serverSupportsImapIdle(["* CAPABILITY IMAP4rev1 IDLEPLUS"]), false);
  assert.equal(serverSupportsImapIdle(["* CAPABILITY IMAP4rev1 UIDPLUS"]), false);
});

test("IMAP IDLE detects mailbox state changes but ignores unrelated untagged responses", () => {
  assert.equal(isImapIdleChangeNotification("* 12 EXISTS"), true);
  assert.equal(isImapIdleChangeNotification("* 3 EXPUNGE"), true);
  assert.equal(isImapIdleChangeNotification("* 9 FETCH (UID 42 FLAGS (\\Seen))"), true);
  assert.equal(isImapIdleChangeNotification("* VANISHED 4:7"), true);
  assert.equal(isImapIdleChangeNotification("* OK Still here"), false);
  assert.equal(isImapIdleChangeNotification("+ idling"), false);
});
