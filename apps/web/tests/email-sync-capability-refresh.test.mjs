import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("mailbox sync replaces stale persisted capabilities after live verified provider connection", () => {
  const sync = read("../../worker/src/email/mailbox-sync-worker.ts");
  assert.match(sync, /normalizeCapabilitySet\(await adapter\.discoverCapabilities\(\)\)/);
  assert.match(sync, /await accounts\.updateCapabilities\(candidate\.id, discoveredCapabilities\)/);
  assert.match(sync, /EMAIL_CAPABILITIES\.some\(capability => candidate\.capabilities\?\.\[capability\] !== discoveredCapabilities\[capability\]\)/);
  assert.match(sync, /a\.capabilities/);
  const connect = sync.indexOf("await adapter.connect(credentials)");
  const discovery = sync.indexOf("normalizeCapabilitySet(await adapter.discoverCapabilities())", connect);
  const persisted = sync.indexOf("await accounts.updateCapabilities(candidate.id, discoveredCapabilities)", discovery);
  const connected = sync.indexOf("await accounts.updateSyncState(candidate.id,", persisted);
  assert.ok(connect >= 0 && discovery > connect && persisted > discovery && connected > persisted,
    "Never mark a mailbox connected before persisting verified live capability discovery");
});

test("sync uses the actual connected adapter rather than guessing Gmail or IMAP capabilities", () => {
  const sync = read("../../worker/src/email/mailbox-sync-worker.ts");
  assert.doesNotMatch(sync, /candidate\.provider === "imap_smtp" \? \{.*drafts: true/s);
  assert.match(sync, /adapter\.discoverCapabilities\(\)/);
  assert.match(sync, /normalizeCapabilitySet/);
});

test("IMAP reconnect cannot mark stale all-false capabilities as connected after a socket test alone", () => {
  const route = read("../src/app/api/email-accounts/route.ts");
  const start = route.indexOf('if (action === "reconnect_imap_smtp")');
  const end = route.indexOf('if (action === "connect_imap_smtp"', start);
  assert.ok(start >= 0 && end > start);
  const reconnect = route.slice(start, end);
  assert.match(reconnect, /testImapSmtpConnection\(/);
  assert.match(reconnect, /repository\.updateStatus\(accountId, "pending"\)/);
  assert.doesNotMatch(reconnect, /repository\.updateStatus\(accountId, "connected"\)/);
  assert.match(reconnect, /pending_worker_verification/);
  assert.match(route.slice(route.indexOf("export async function POST("), start), /role: "admin"/);
});

test("web UI describes capability rediscovery honestly, not as already ready", () => {
  const ui = read("../src/app/mail/accounts/email-accounts-client.tsx");
  assert.match(ui, /Mailbox credentials verified; capability discovery is pending/);
  assert.doesNotMatch(ui, /Mailbox connection verified and restored\./);
});

test("chat composer remains read-only about readiness and never grants email.write or auto-sends", () => {
  const compose = read("../src/app/api/chat/mail-compose/route.ts");
  const permission = read("../../../packages/shared/src/identity/types.ts");
  assert.match(compose, /trusted\.subject\.permissions\.has\("email\.write"\)/);
  assert.match(compose, /mailbox\.capabilities\.drafts === true/);
  assert.match(compose, /mailbox\.capabilities\.send === true/);
  assert.match(compose, /invokeEmailReadTool\(runtime, toolName, input, context\)/);
  // Ownership grants are intentional and separate from agent checkbox
  // selections. The permission boundary is four-role, not "no role may write".
  const roleMap = permission.slice(
    permission.indexOf("export const SYSTEM_ROLE_PERMISSIONS"),
    permission.indexOf("// Auth Subject"),
  );
  assert.ok(roleMap.startsWith("export const SYSTEM_ROLE_PERMISSIONS"));
  function rolePermissions(role) {
    const match = roleMap.match(new RegExp("\\b" + role + ":\\s*\\[([^\\]]*)\\]"));
    assert.ok(match, "Expected canonical RBAC mapping for " + role);
    return [...match[1].matchAll(/"([a-z.]+)"/g)].map(permission => permission[1]);
  }
  for (const role of ["owner", "admin"]) {
    assert.ok(rolePermissions(role).includes("email.write"), role + " has explicit write authority");
    assert.ok(rolePermissions(role).includes("email.read"), role + " may access mail");
  }
  for (const role of ["member", "viewer"]) {
    assert.ok(!rolePermissions(role).includes("email.write"), role + " must not gain email write access");
  }
});
