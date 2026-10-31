import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { WHATSAPP_POLICY_CHOICES, whatsappPolicyReadiness } from "../src/lib/agents/whatsapp-permission-choices.ts";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

test("only existing WhatsApp host tools are offered with sending-mode guidance", () => {
  assert.deepEqual(WHATSAPP_POLICY_CHOICES.map(item => item.name), ["whatsapp.history", "whatsapp.send"]);
  assert.equal(WHATSAPP_POLICY_CHOICES[0].group, "read");
  assert.equal(WHATSAPP_POLICY_CHOICES[1].group, "approval");
  assert.match(WHATSAPP_POLICY_CHOICES[1].detail, /sending mode/i);
  assert.match(WHATSAPP_POLICY_CHOICES[1].detail, /sending permission.*assigned connected phone/i);
});

test("WhatsApp setup explains independent saved policy, binding and account connection", () => {
  assert.deepEqual(whatsappPolicyReadiness({
    allowedTools: [], bound: false, connected: false,
  }), { canRead: false, canRequestSend: false, blockers: ["No WhatsApp account bound", "No connected WhatsApp account", "WhatsApp send approval tool not enabled"] });
  assert.equal(whatsappPolicyReadiness({
    allowedTools: ["whatsapp.send"], bound: true, connected: true,
  }).canRequestSend, true);
  assert.equal(whatsappPolicyReadiness({
    allowedTools: ["whatsapp.send"], bound: true, connected: false,
  }).canRequestSend, false);
  assert.equal(whatsappPolicyReadiness({
    allowedTools: ["whatsapp.history"], bound: true, connected: true,
  }).canRequestSend, false);
});

test("Agent Policy displays explicitly toggleable WhatsApp tools without implicitly persisting them", () => {
  const ui = read("../src/app/agents/[id]/agent-detail-client.tsx");
  assert.match(ui, /WHATSAPP_POLICY_CHOICES\.map\(\(choice\) =>/);
  assert.match(ui, /selectedTools\.includes\(choice\.name\)/);
  assert.match(ui, /togglePolicyTool\(choice\.name, event\.target\.checked\)/);
  assert.match(ui, /WhatsApp permissions/);
  assert.equal(WHATSAPP_POLICY_CHOICES[1].label,'Prepare WhatsApp sends');
  assert.match(ui, /onSubmit=\{savePolicy\}/);
  assert.match(ui, /window\.confirm\(confirmation/);
  assert.match(ui, /role="status"/);
});

test("connected account selection stays independently administrator-confirmed", () => {
  const ui = read("../src/app/agents/[id]/agent-detail-client.tsx");
  assert.match(ui, /account\.status !== "connected"/);
  assert.match(ui, /whatsappAccountId/);
  assert.match(ui, /Save channels/);
  assert.match(ui, /\/api\/agents\/\$\{agent\.id\}\/channels/);
  assert.match(read("../src/app/api/agents/[id]/channels/route.ts"), /role: "admin"/);
});

test("host executor requires current WhatsApp scope and explicit policy or human approval", () => {
  const runtime = read("../../../apps/worker/src/agent/whatsapp-tool-runtime.ts");
  assert.match(runtime, /name: "whatsapp.send"/);
  assert.match(runtime, /required_permission: "whatsapp.send"/);
  assert.match(runtime, /currentPolicy\?\.allowedTools\.includes\(tool\.name\)/);
  assert.match(runtime, /agent_whatsapp_accounts/);
  assert.match(runtime, /status: String\(action\.status\)/);
  assert.match(runtime, /INSERT INTO whatsapp_send_actions/);
  assert.match(runtime, /if \(!isAutonomousSendEnabled\(policy\?\.securityPolicy\)\) return \{ kind: "skipped" \}/);
  assert.match(runtime, /if\(args\.requireHumanApproval\)return \{kind:"skipped"\}/);
  assert.ok(runtime.indexOf("if(args.requireHumanApproval)") < runtime.indexOf("const messageId = await queueWhatsAppOutboundMessage"));
  const roles = read("../../../packages/shared/src/identity/types.ts");
  assert.match(roles, /"whatsapp.send"/);
  const decision = read("../src/app/api/whatsapp/send-actions/decision/route.ts");
  assert.match(decision, /decision !== "approve" && decision !== "reject"/);
});
