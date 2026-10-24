import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("./whatsapp-issue47-browser.js", import.meta.url), "utf8");
const org = "10000000-0000-4000-8000-000000000001";
const account = "10000000-0000-4000-8000-000000000002";
const actionId = "10000000-0000-4000-8000-000000000003";
const recipient = "+919876543210";

async function execute({ templateStatus = 200, anonymousStatus = 401, proposalStatus = 202 } = {}) {
  const logs = [];
  const calls = [];
  const reply = (status, json = {}) => ({ status, json: async () => json });
  const responses = {
    pending: { approvalRequired: true, status: "pending", actionId },
    template: { templates: [{ name: "example", status: "approved" }] }
  };
  const fetch = async (url, options) => {
    const method = options?.method ?? "GET";
    const body = options?.body ? JSON.parse(options.body) : null;
    calls.push({ url, method, credentials: options.credentials, headers: options.headers, body });
    if (url.startsWith("/api/whatsapp/templates?")) {
      return options.credentials === "omit" ? reply(anonymousStatus) : reply(templateStatus, responses.template);
    }
    assert.equal(url, "/api/whatsapp/messages");
    assert.equal(method, "POST");
    if (!body.to.startsWith("+")) return reply(422, { error: "validation_error" });
    if (body.body.endsWith(" changed")) return reply(409, { error: "idempotency_conflict" });
    return reply(proposalStatus, responses.pending);
  };
  const prompts = [org, account, recipient, "PENDING ONLY"];
  const context = {
    window: {
      location: { origin: "https://example.test" },
      confirm: () => true,
      prompt: () => prompts.shift(),
    },
    crypto: { randomUUID: () => "20000000-0000-4000-8000-000000000004" },
    console: { log: (...items) => logs.push(items.map(x => typeof x === "string" ? x : JSON.stringify(x)).join(" ")) },
    URL,
    fetch,
  };
  await runInNewContext(source, context);
  return { logs, calls };
}

test("acceptance run uses same-origin session, Meta GET, one pending proposal and no delivery endpoint", async () => {
  const { logs, calls } = await execute();
  assert.equal(calls.length, 6);
  assert.equal(calls.filter(c => c.url === "/api/whatsapp/messages").length, 4);
  assert.equal(calls.filter(c => c.method === "POST" && c.body.to === recipient).length, 3);
  assert.equal(calls.filter(c => c.url.includes("/decision") || c.url.startsWith("https://graph.facebook.com")).length, 0);
  assert.equal(calls[0].credentials, "omit");
  assert.equal(calls[1].credentials, "same-origin");
  assert.equal(calls[2].credentials, "same-origin");
  assert.equal(calls[3].headers["Idempotency-Key"], calls[4].headers["Idempotency-Key"]);
  assert.equal(calls[4].headers["Idempotency-Key"], calls[5].headers["Idempotency-Key"]);
  assert.ok(logs.some(x => x.includes("HTTP checks passed")));
  assert.ok(logs.some(x => x.includes("Action ID")));
  assert.ok(logs.findIndex(x => x.includes("Action ID")) < logs.findIndex(x => x.includes("HTTP checks passed")));
  assert.ok(logs.every(x => !x.includes(recipient) && !x.includes("aca-access-token")));
});

test("provider-not-ready halts without creating any approval", async () => {
  const { logs, calls } = await execute({ templateStatus: 409 });
  assert.equal(calls.length, 2);
  assert.ok(logs.some(x => x.includes("NOT ACCEPTED")));
  assert.ok(!calls.some(c => c.method === "POST"));
});

test("unauthenticated GET must fail closed before any authenticated operations", async () => {
  const { calls, logs } = await execute({ anonymousStatus: 200 });
  assert.equal(calls.length, 1);
  assert.ok(logs.some(x => x.includes("NOT ACCEPTED")));
});

test("non-pending HTTP outcome cannot be reported as acceptance PASS", async () => {
  const { calls, logs } = await execute({ proposalStatus: 409 });
  assert.equal(calls.length, 4);
  assert.ok(logs.some(x => x.includes("NOT ACCEPTED")));
  assert.ok(!logs.some(x => x.includes("HTTP checks passed")));
});

test("harness includes no explicit send, approval, Meta POST or credential read", () => {
  assert.doesNotMatch(source, /api\/whatsapp\/send-actions|fetch\(\s*["']https?:\/\/graph\.facebook\.com/);
  assert.doesNotMatch(source, /document\.cookie|localStorage|sessionStorage|process\.env/);
  assert.ok(source.includes('credentials: "omit"'));
  assert.ok(source.includes('credentials: "same-origin"'));
  assert.ok(source.includes('confirmation !== "PENDING ONLY"'));
});
