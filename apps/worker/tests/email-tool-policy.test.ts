import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { canUseEmailAccountBinding, hasEmailToolCapabilities, isEmailToolAllowedByPolicy } from "../src/agent/email-tool-policy";

test("execution-time policy checks observe allowlist revocation between invocations", () => {
  let currentPolicy: { allowedTools: string[] } | null = { allowedTools: ["email.messages.list"] };
  const authorize = () => isEmailToolAllowedByPolicy(currentPolicy, "email.messages.list");
  assert.equal(authorize(), true);
  currentPolicy = { allowedTools: [] };
  assert.equal(authorize(), false);
  currentPolicy = null;
  assert.equal(authorize(), false);
});

test("multi-capability authorization requires every required capability", () => {
  const descriptor = { required_capabilities: ["threads", "labels"], any_capabilities: [] } as const;
  assert.equal(hasEmailToolCapabilities(descriptor, { threads: true, labels: true }), true);
  assert.equal(hasEmailToolCapabilities(descriptor, { threads: true, labels: false }), false);
});

test("multi-capability authorization requires at least one alternative capability", () => {
  const descriptor = { required_capabilities: ["read"], any_capabilities: ["search", "list"] } as const;
  assert.equal(hasEmailToolCapabilities(descriptor, { read: true, search: false, list: false }), false);
  assert.equal(hasEmailToolCapabilities(descriptor, { read: true, search: false, list: true }), true);
  assert.equal(hasEmailToolCapabilities(descriptor, { read: false, search: true, list: true }), false);
});

test("mailbox binding roles enforce read/write boundaries without implicit promotion", () => {
  const expected = [
    { role: "primary", read: true, write: true },
    { role: "read_only", read: true, write: false },
    { role: "send_only", read: false, write: true },
    { role: "unexpected", read: false, write: false },
    { role: "", read: false, write: false },
    { role: null, read: false, write: false },
  ];
  for (const { role, read, write } of expected) {
    assert.equal(canUseEmailAccountBinding(role, "email.read"), read, String(role) + " cannot bypass read policy");
    assert.equal(canUseEmailAccountBinding(role, "email.write"), write, String(role) + " cannot bypass write policy");
  }
  assert.equal(canUseEmailAccountBinding("primary", "organization.read"), false);
  assert.equal(canUseEmailAccountBinding("read_only", "email.unknown"), false);
});

test("all email runtime, read and write tool boundaries enforce the same mailbox role policy", () => {
  const runtime = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-tool-runtime.ts", import.meta.url), "utf8");
  const read = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-read-tools.ts", import.meta.url), "utf8");
  const write = readFileSync(new URL("../../../packages/email-agent-runtime/src/email-write-tools.ts", import.meta.url), "utf8");
  assert.match(runtime, /canUseEmailAccountBinding\(role, tool\.required_permission\)/);
  assert.match(read, /canUseEmailAccountBinding\(role, "email\.read"\)/);
  assert.match(read, /canUseEmailAccountBinding\(binding\.role, "email\.read"\)/);
  assert.match(write, /canUseEmailAccountBinding\(role, "email\.write"\)/);
  // Drafts still require primary; send_only is for explicit send requests.
  assert.match(write, /allowSendOnly \|\| role === "primary"/);
});
