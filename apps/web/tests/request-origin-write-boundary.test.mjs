import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { isTrustedRequestOrigin } from "../src/lib/identity/same-origin-policy.ts";

const base = {
  expectedOrigin: "https://aca.vercel.app",
  host: "aca-git-development-rilan.vercel.app",
  forwardedProto: "https",
  production: true,
};

test("same exact APP_ORIGIN and actual routed Vercel alias remain usable", () => {
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca.vercel.app" }), true);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca-git-development-rilan.vercel.app" }), true);
});

test("unrelated Vercel tenants and HTTPS downgrades are never trusted", () => {
  for (const origin of [
    "https://attacker.vercel.app",
    "https://aca.vercel.app.attacker.example",
    "https://another-project-git-development.vercel.app",
    "http://aca.vercel.app",
    "https://aca-git-development-rilan.vercel.app:8443",
    "null",
  ]) {
    assert.equal(isTrustedRequestOrigin({ ...base, origin }), false, origin);
  }
});

test("expected origin is not an arbitrary URL prefix or suffix", () => {
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca.vercel.app/" }), false);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca.vercel.app@evil.example" }), false);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca.vercel.app.evil.example" }), false);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca.vercel.app:443" }), false);
});

test("malformed host/protocol or a missing authority fails closed for explicit origins", () => {
  assert.equal(isTrustedRequestOrigin({ origin: "https://random.example", expectedOrigin: null, host: null, forwardedProto: null, production: true }), false);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca-git-development-rilan.vercel.app", host: "aca-git-development-rilan.vercel.app,attacker.example" }), false);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca-git-development-rilan.vercel.app", forwardedProto: "javascript" }), false);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "https://aca-git-development-rilan.vercel.app", host: "aca-git-development-rilan.vercel.app/path" }), false);
});

test("requests without an Origin header retain existing non-browser client compatibility", () => {
  assert.equal(isTrustedRequestOrigin({ ...base, origin: null }), true);
  assert.equal(isTrustedRequestOrigin({ ...base, origin: "" }), true);
});

test("same-origin guard never allows a generic Vercel suffix", () => {
  const auth = readFileSync(new URL("../src/lib/identity/local-auth.ts", import.meta.url), "utf8");
  assert.match(auth, /isTrustedRequestOrigin\(/);
  assert.doesNotMatch(auth, /origin\.endsWith\("\.vercel\.app"\)/);
  assert.doesNotMatch(auth, /expected\.endsWith\("\.vercel\.app"\)/);
});

test("compose, send-approval and model tool-loop writes reject mismatched explicit origins", () => {
  const compose = readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
  const actions = readFileSync(new URL("../src/app/api/mail/actions/route.ts", import.meta.url), "utf8");
  const stream = readFileSync(new URL("../src/app/api/chat/stream/route.ts", import.meta.url), "utf8");
  for (const [source, signature] of [[compose, "export async function POST(request: Request)"], [actions, "export async function POST(request: Request)"], [actions, "export async function PATCH(request: Request)"], [stream, "export async function POST(request: Request)"]]) {
    const handler = source.slice(source.indexOf(signature), source.indexOf("export async function ", source.indexOf(signature) + signature.length) < 0 ? undefined : source.indexOf("export async function ", source.indexOf(signature) + signature.length));
    assert.match(handler, /assertSameOrigin\(request\)/);
    assert.match(handler, /error: "invalid_origin"/);
    assert.match(handler, /status: 403/);
    assert.ok(handler.indexOf("assertSameOrigin(request)") < handler.indexOf("await ensureDevSeed()"));
  }
});


test("every direct mail draft and mailbox mutation checks origin before touching the DB", () => {
  const specs = [
    ["../src/app/api/mail/drafts/route.ts", ["POST", "PATCH", "DELETE"]],
    ["../src/app/api/mail/drafts/sync/route.ts", ["POST"]],
    ["../src/app/api/mail/messages/read-state/route.ts", ["PATCH"]],
    ["../src/app/api/mail/messages/folder/route.ts", ["PATCH"]],
  ];
  for (const [file, methods] of specs) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const method of methods) {
      const begin = source.indexOf("export async function " + method + "(request: Request)");
      assert.ok(begin >= 0, file + " must have a " + method + " handler");
      const next = source.indexOf("export async function ", begin + 20);
      const handler = source.slice(begin, next < 0 ? undefined : next);
      assert.match(handler, /assertSameOrigin\(request\)/, file + ": " + method);
      assert.match(handler, /error: "invalid_origin"/, file + ": " + method);
      assert.ok(handler.indexOf("assertSameOrigin(request)") < handler.indexOf("await ensureDevSeed()"), file + ": reject before DB work");
    }
  }
});


test("agent management, policy, mailbox bindings and new chat writes also enforce first-party Origin", () => {
  const specs = [
    ["../src/app/api/agents/route.ts", ["POST"]],
    ["../src/app/api/agents/[id]/route.ts", ["PATCH", "DELETE"]],
    ["../src/app/api/agents/[id]/ai-settings/route.ts", ["PUT"]],
    ["../src/app/api/agents/[id]/channels/route.ts", ["PATCH"]],
    ["../src/app/api/agents/[id]/policy/route.ts", ["PATCH"]],
    ["../src/app/api/agents/[id]/deploy/route.ts", ["POST"]],
    ["../src/app/api/agents/[id]/versions/route.ts", ["POST"]],
    ["../src/app/api/chat/conversation/route.ts", ["POST"]],
  ];
  for (const [file, methods] of specs) {
    const source = readFileSync(new URL(file, import.meta.url), "utf8");
    for (const method of methods) {
      const begin = source.indexOf("export async function " + method + "(request: Request");
      assert.ok(begin >= 0, file + " must have a " + method + " handler");
      const next = source.indexOf("export async function ", begin + 20);
      const handler = source.slice(begin, next < 0 ? undefined : next);
      assert.match(handler, /assertSameOrigin\(request\)/, file + ": " + method);
      assert.match(handler, /error: "invalid_origin"/, file + ": " + method);
      assert.match(handler, /status: 403/);
      assert.ok(handler.indexOf("assertSameOrigin(request)") < handler.indexOf("await ensureDevSeed()"), file + ": no DB before origin gate");
    }
  }
});
