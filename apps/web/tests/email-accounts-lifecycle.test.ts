import assert from "node:assert/strict";
import {test} from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const routePath = resolve(__dirname, "../src/app/api/email-accounts/[accountId]/structure/route.ts");
const clientPath = resolve(__dirname, "../src/app/mail/accounts/email-accounts-client.tsx");
const discoveryPath = resolve(__dirname, "../../worker/src/email/discovery.ts");
const verificationPath = resolve(__dirname, "../../worker/src/email/provider-verification.ts");
const gmailCallbackPath = resolve(__dirname, "../src/app/api/oauth/gmail/callback/route.ts");
const zohoCallbackPath = resolve(__dirname, "../src/app/api/oauth/zoho/callback/route.ts");
const accountsRoutePath = resolve(__dirname, "../src/app/api/email-accounts/route.ts");

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
  assert.match(source, /No folders or labels have been discovered yet/);
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
  assert.match(source, /withProviderRetry\(\(\) => provider\.discoverCapabilities\(\)\)/);
  assert.match(source, /finally/);
  assert.match(source, /await provider\.disconnect\(\)/);
});


test("accounts UI keeps disconnected mailboxes recoverable", () => {
  const source = readFileSync(clientPath, "utf8");
  assert.match(source, /account\.status !== "connected"/);
  assert.doesNotMatch(source, /account\.status !== "connected" && account\.status !== "disconnected"/);
  assert.match(source, /Reconnect/);
});


test("OAuth callbacks return provider failures to the account UI without exposing token payloads", () => {
  for (const source of [readFileSync(gmailCallbackPath, "utf8"), readFileSync(zohoCallbackPath, "utf8")]) {
    assert.match(source, /\/mail\/accounts\?providerError=/);
    assert.match(source, /NextResponse\.redirect/);
    assert.doesNotMatch(source, /access_token.*providerError|refresh_token.*providerError/);
  }
});


test("email account API enforces organization authorization and never returns credentials", () => {
  const source = readFileSync(accountsRoutePath, "utf8");
  assert.match(source, /permission: "email\.read"/);
  assert.match(source, /role: "admin"/);
  assert.match(source, /account\.organization_id !== organizationId/);
  assert.doesNotMatch(source, /loadCredentials\([^\n]+\).*NextResponse/);
  assert.doesNotMatch(source, /access_token|refresh_token|password.*NextResponse/);
  assert.doesNotMatch(source, /\\\\n/);
});


test("inbox source contains no escaped-newline literals and sender search remains parameterized", () => {
 const inbox=readFileSync(resolve(__dirname,"../src/app/mail/inbox/inbox-client.tsx"),"utf8");
 const repository=readFileSync(resolve(__dirname,"../../../packages/db/src/email/repository.ts"),"utf8");
 assert.doesNotMatch(inbox,/\\\\n/);
 assert.ok(repository.includes('m.from_email ILIKE '+String.fromCharCode(36,36)+'{values.length}'));
});
