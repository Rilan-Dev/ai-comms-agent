import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const route = () => readFileSync(new URL("../src/app/api/chat/mail-compose/route.ts", import.meta.url), "utf8");
const chat = () => readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
const voice = () => readFileSync(new URL("../src/app/ai-voice/voice-workspace.tsx", import.meta.url), "utf8");

test("compose lists only connected primary bound mailboxes in the authenticated tenant", () => {
  const s=route();
  assert.match(s, /authorize\(request,\s*\{ organizationId: asOrganizationId\(organizationId\)/);
  assert.match(s, /g\.organization_id=\$1/);
  assert.match(s, /a\.organization_id=\$1/);
  assert.match(s, /b\.role='primary'/);
  assert.match(s, /a\.status='connected'/);
  assert.match(s, /a\.deleted_at IS NULL/);
});

test("draft and send requests go through registered policy, permission and audited tool executor", () => {
  const s=route();
  assert.match(s, /createEmailToolRuntime\(organizationId, agentId\)/);
  assert.match(s, /invokeEmailReadTool\(/);
  assert.match(s, /auth_subject:/);
  assert.match(s, /"email.draft.create"/);
  assert.match(s, /"email.send.request"/);
  assert.match(s, /subject\.membership/);
  assert.doesNotMatch(s, /decideEmailAction|sendDraft\(|\.send\(/);
});

test("chat compose requires explicit draft save and separate send approval request", () => {
  const s=chat();
  assert.match(s, /Save email draft/);
  assert.match(s, /Request send approval/);
  assert.match(s, /pending_approval/);
  assert.match(s, /\/api\/chat\/mail-compose/);
  assert.match(s, /window\.confirm\(/);
  assert.match(s, /\/mail\/approvals/);
});

test("realtime and transcript voice continue through host-authorized turn and expose compose handoff", () => {
  assert.match(voice(), /\/chat\?/);
  const turn=readFileSync(new URL("../src/app/api/voice/turn/route.ts",import.meta.url),"utf8");
  assert.match(turn, /runEmailAgentTurn\(/);
  assert.match(turn, /toolContext:/);
  const realtime=readFileSync(new URL("../src/app/api/voice/realtime/route.ts",import.meta.url),"utf8");
  assert.match(realtime, /authenticated host turn endpoint/);
});
