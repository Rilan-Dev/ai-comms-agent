import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { isTrustedRequestOrigin } from "../src/lib/identity/same-origin-policy.ts";

const source = readFileSync(new URL("../src/app/api/voice/turn/route.ts", import.meta.url), "utf8");

test("foreign browser Origin is denied before a voice turn, its increment, or any email tool", () => {
  const entry = source.slice(source.indexOf("export async function POST(request: Request)"));
  assert.ok(source.includes('import { assertSameOrigin } from "@/lib/identity/local-auth";'));
  assert.ok(entry.includes('try { assertSameOrigin(request); }'));
  assert.match(entry, /error: "invalid_origin"/);
  assert.match(entry, /status: 403/);
  assert.ok(entry.indexOf("assertSameOrigin(request)") < entry.indexOf("await ensureDevSeed()"));
  assert.ok(entry.indexOf("assertSameOrigin(request)") < entry.indexOf("incrementVoiceSessionTurnForOrganization("));
});

test("origin helper rejects a different Vercel project, preserving legitimate same-host voice", () => {
  const options = { expectedOrigin: "https://aca.vercel.app", host: "aca.starcitytechnical.com",
    forwardedProto: "https", production: true };
  assert.equal(isTrustedRequestOrigin({ ...options, origin: "https://evil.vercel.app" }), false);
  assert.equal(isTrustedRequestOrigin({ ...options, origin: "https://aca.starcitytechnical.com" }), true);
});

test("voice SSE errors never expose exception messages from tool/provider/DB failures", () => {
  const stream = source.slice(source.indexOf("const stream = new ReadableStream"));
  assert.match(stream, /emit\("error", \{ message: "Voice turn failed\. No further action was confirmed\. Review saved drafts and pending approvals before retrying\." \}\)/);
  assert.doesNotMatch(stream, /emit\("error", \{ message: error instanceof Error \? error\.message/);
});

test("host-verified email outcome and linked chat answer are unchanged", () => {
  assert.match(source, /verifiedEmailToolSummary\(result\.toolCalls\)/);
  assert.match(source, /await saveAnswer\(deliveredText\)/);
  assert.match(source, /await saveAnswer\(voiceAnswer\)/);
  assert.match(source, /pendingApprovals: result\.pendingApprovals/);
  assert.match(source, /runEmailAgentTurn\(/);
  assert.doesNotMatch(source, /\.sendDraft\(/);
});
