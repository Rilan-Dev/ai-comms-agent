import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const handler = (source, method) => {
  const start = source.indexOf("export async function " + method + "(");
  assert.ok(start >= 0, method + " handler missing");
  const next = source.indexOf("export async function ", start + method.length + 23);
  return source.slice(start, next < 0 ? undefined : next);
};

test("viewer cannot enumerate WhatsApp accounts under organization.read", () => {
  const get = handler(read("../src/app/api/whatsapp/accounts/route.ts"), "GET");
  assert.match(get, /permission: "whatsapp\.read"/);
  assert.doesNotMatch(get, /permission: "organization\.read"/);
  assert.ok(get.indexOf('permission: "whatsapp.read"') < get.indexOf("listWhatsAppAccountsForOrganization(organizationId)"));
});

test("Meta webhook verification token is only readable by organization administrators", () => {
  const get = handler(read("../src/app/api/whatsapp/webhook-config/route.ts"), "GET");
  assert.match(get, /permission: "organization\.update"/);
  assert.doesNotMatch(get, /permission: "organization\.read"/);
  assert.ok(get.indexOf('permission: "organization.update"') < get.indexOf('SELECT verify_token FROM whatsapp_accounts'));
  assert.match(get, /verifyToken/);
});

test("every WhatsApp browser write checks explicit Origin before provider or DB work", () => {
  const cases = [
    ["../src/app/api/whatsapp/accounts/route.ts", ["POST", "DELETE"]],
    ["../src/app/api/whatsapp/messages/route.ts", ["POST"]],
    ["../src/app/api/whatsapp/send-actions/decision/route.ts", ["POST"]],
    ["../src/app/api/whatsapp/templates/route.ts", ["POST"]],
    ["../src/app/api/whatsapp/webhook-config/route.ts", ["POST"]],
  ];
  for (const [p, methods] of cases) {
    const source = read(p);
    assert.match(source, /import \{ assertSameOrigin \} from "@\/lib\/identity\/local-auth"/);
    for (const method of methods) {
      const h = handler(source, method);
      assert.match(h, /assertSameOrigin\(request\)/, p + method);
      assert.match(h, /error: "invalid_origin"/, p + method);
      assert.match(h, /status: 403/, p + method);
      assert.ok(h.indexOf("assertSameOrigin(request)") < h.indexOf("await ensureDevSeed()"), p + method);
    }
  }
});

test("vendor-origin WhatsApp webhook POST remains independent of browser same-origin guard", () => {
  const vendor = handler(read("../src/app/api/whatsapp/webhook/route.ts"), "POST");
  assert.doesNotMatch(vendor, /assertSameOrigin\(request\)/);
  assert.match(vendor, /x-hub-signature-256/);
});

test("WhatsApp outbound proposals still require human approval and scoped send grants", () => {
  const messages = handler(read("../src/app/api/whatsapp/messages/route.ts"), "POST");
  const approval = handler(read("../src/app/api/whatsapp/send-actions/decision/route.ts"), "POST");
  assert.match(messages, /permission: "whatsapp\.send"/);
  assert.match(messages, /pending/);
  assert.match(approval, /permission: "whatsapp\.send"/);
  assert.match(approval, /queued/);
});
