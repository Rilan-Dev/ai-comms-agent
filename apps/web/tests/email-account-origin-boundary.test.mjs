import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

function handler(source, method) {
  const start = source.indexOf("export async function " + method + "(");
  assert.ok(start >= 0, method + " route exists");
  const end = source.indexOf("export async function ", start + 23);
  return source.slice(start, end < 0 ? undefined : end);
}

test("admin mailbox connect/test/reconnect POST is checked before any credential or provider work", () => {
  const route = read("../src/app/api/email-accounts/route.ts");
  const post = handler(route, "POST");
  assert.match(post, /assertSameOrigin\(request\)/);
  assert.match(post, /error: "invalid_origin"/);
  assert.match(post, /status: 403/);
  assert.ok(post.indexOf("assertSameOrigin(request)") < post.indexOf("await ensureDevSeed()"));
  assert.match(post, /role: "admin"/);
  assert.match(post, /testImapSmtpConnection/);
});

test("admin mailbox deletion fails closed for a foreign Origin before repository mutation", () => {
  const route = read("../src/app/api/email-accounts/route.ts");
  const deletion = handler(route, "DELETE");
  assert.match(deletion, /assertSameOrigin\(request\)/);
  assert.match(deletion, /error: "invalid_origin"/);
  assert.ok(deletion.indexOf("assertSameOrigin(request)") < deletion.indexOf("await ensureDevSeed()"));
  assert.match(deletion, /role: "admin"/);
  assert.match(deletion, /repository\.delete\(accountId\)/);
});

test("admin manual sync rejects a foreign Origin before work scheduling", () => {
  const route = read("../src/app/api/email-accounts/[accountId]/sync/route.ts");
  const post = handler(route, "POST");
  assert.match(post, /assertSameOrigin\(request\)/);
  assert.match(post, /error: "invalid_origin"/);
  assert.ok(post.indexOf("assertSameOrigin(request)") < post.indexOf("await query("));
  assert.match(post, /role: "admin"/);
});

test("admin Zoho webhook configuration rejects a foreign Origin before rotating secrets", () => {
  const route = read("../src/app/api/email-accounts/[accountId]/zoho-webhook/route.ts");
  const post = handler(route, "POST");
  assert.match(post, /assertSameOrigin\(request\)/);
  assert.match(post, /error: "invalid_origin"/);
  assert.ok(post.indexOf("assertSameOrigin(request)") < post.indexOf("const token = randomBytes("));
  assert.match(post, /role: "admin"/);
  assert.match(post, /saveCredentials/);
});

test("server-to-server inbound Zoho webhook endpoint is not accidentally treated as admin configuration", () => {
  const route = read("../src/app/api/email-accounts/[accountId]/zoho-webhook/route.ts");
  assert.match(route, /getOAuthPublicOrigin\(request\)/);
  const inbound = read("../src/app/api/webhooks/zoho/[token]/route.ts");
  assert.match(inbound, /export async function POST/);
});
