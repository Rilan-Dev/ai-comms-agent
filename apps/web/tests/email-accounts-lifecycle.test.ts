import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(__dirname, "../src/app/api/email-accounts/[accountId]/structure/route.ts");
const clientPath = resolve(__dirname, "../src/app/mail/accounts/email-accounts-client.tsx");
const discoveryPath = resolve(__dirname, "../../worker/src/email/discovery.ts");
const verificationPath = resolve(__dirname, "../../worker/src/email/provider-verification.ts");

test("mailbox structure route is organization-scoped and never returns credentials", () => {
  const source = readFileSync(routePath, "utf8");
  assert.match(source, /authorize\(/);
  assert.match(source, /account\.organization_id !== organizationId/);
  assert.match(source, /listFolders\(accountId\)/);
  assert.match(source, /listLabels\(accountId\)/);
  assert.doesNotMatch(source, /loadCredentials/);
  assert.doesNotMatch(source, /password|access_token|refresh_token/);
});

test("accounts UI exposes persisted structure and agent assignments", () => {
  const source = readFileSync(clientPath, "utf8");
  assert.match(source, /\/api\/email-accounts\/.*\/structure/);
  assert.match(source, /View folders|Refresh folders/);
  assert.match(source, /Agent: \{agent\.name\}/);
  assert.match(source, /No persisted discovery snapshot/);
});

test("worker discovery uses the verified provider lifecycle", () => {
  const source = readFileSync(discoveryPath, "utf8");
  assert.match(source, /verifyEmailProviderConnection\(provider, credentials/);
  assert.match(source, /replaceStructure/);
  assert.doesNotMatch(source, /replaceFolders\(account\.id, account\.organization_id, folders\)/);
  assert.doesNotMatch(source, /replaceLabels\(account\.id, account\.organization_id, labels\)/);
  assert.match(source, /updateStatus\(account\.id, "connected"\)/);
  assert.match(source, /updateStatus\(account\.id, "error", message\)/);
});

test("provider verification owns cleanup around live provider discovery", () => {
  const source = readFileSync(verificationPath, "utf8");
  assert.match(source, /await provider\.connect\(credentials\)/);
  assert.match(source, /await provider\.discoverCapabilities\(\)/);
  assert.match(source, /finally/);
  assert.match(source, /await provider\.disconnect\(\)/);
});


test("accounts UI keeps disconnected mailboxes recoverable", () => {
  const source = readFileSync(clientPath, "utf8");
  assert.match(source, /account\.status !== "connected"/);
  assert.doesNotMatch(source, /account\.status !== "connected" && account\.status !== "disconnected"/);
  assert.match(source, /Reconnect/);
});
