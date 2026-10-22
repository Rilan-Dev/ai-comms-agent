import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mayDiscoverComposeMailboxes, mayWriteComposeDraft } from "../src/lib/mail/compose-access.ts";

test("general organization access never grants mailbox address discovery", () => {
  assert.equal(mayDiscoverComposeMailboxes(new Set(["organization.read"])), false);
  assert.equal(mayDiscoverComposeMailboxes(new Set(["organization.read", "email.read"])), true);
  assert.equal(mayDiscoverComposeMailboxes(new Set(["organization.read", "email.write"])), true);
  assert.equal(mayDiscoverComposeMailboxes(new Set()), false);
});

test("only authenticated email.write can create a draft or request a send approval", () => {
  assert.equal(mayWriteComposeDraft(new Set(["organization.read", "email.read"])), false);
  assert.equal(mayWriteComposeDraft(new Set(["organization.read", "email.write"])), true);
  assert.equal(mayWriteComposeDraft(new Set(["organization.read"])), false);
});

test("GET refuses unauthorized callers before loading mailbox accounts or registry", () => {
  const source = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  const get = source.slice(source.indexOf("export async function GET"), source.indexOf("export async function POST"));
  const gate = get.indexOf("mayDiscoverComposeMailboxes(trusted.subject.permissions)");
  const query = get.indexOf("const mailboxes = await primaryMailboxes(");
  assert.ok(gate >= 0 && query > gate, "gate mailbox access before DB discovery");
  assert.match(get, /status: 403/);
  assert.match(get, /trusted\.subject\.permissions\.has\("email\.write"\)/);
});

test("POST denies missing write authorization before checking whether a mailbox is assigned", () => {
  const route = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  const post = route.slice(route.indexOf("export async function POST"));
  const gate = post.indexOf("mayWriteComposeDraft(trusted.subject.permissions)");
  const binding = post.indexOf("const bound = await primaryMailboxes");
  assert.ok(gate >= 0 && binding > gate, "deny nonwriters without leaking bound accounts");
  assert.match(post, /status: 403/);
  assert.match(post, /invokeEmailReadTool\(runtime, toolName, input, context\)/);
  assert.doesNotMatch(post, /sendDraft\(|decideEmailAction\(/);
});
