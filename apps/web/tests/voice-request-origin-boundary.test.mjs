import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { isTrustedRequestOrigin } from "../src/lib/identity/same-origin-policy.ts";

const read = (file) => readFileSync(new URL(file, import.meta.url), "utf8");
const expectedOrigin = "https://aca.starcitytechnical.com";
const host = "aca.starcitytechnical.com";

test("same-origin browser voice commands reject foreign explicit Origins", () => {
  for (const origin of ["https://attacker.example", "https://unrelated.vercel.app", "http://aca.starcitytechnical.com", "null"]) {
    assert.equal(isTrustedRequestOrigin({ origin, expectedOrigin, host, forwardedProto: "https", production: true }), false, origin);
  }
  assert.equal(isTrustedRequestOrigin({ origin: expectedOrigin, expectedOrigin, host, forwardedProto: "https", production: true }), true);
  // Legacy authenticated non-browser clients retain compatibility.
  assert.equal(isTrustedRequestOrigin({ origin: null, expectedOrigin, host, forwardedProto: "https", production: true }), true);
});

test("voice session creation, activation and termination reject foreign origins before DB work", () => {
  const route = read("../src/app/api/voice/session/route.ts");
  assert.match(route, /import \{ assertSameOrigin \} from "@\/lib\/identity\/local-auth"/);
  for (const method of ["POST", "PATCH", "DELETE"]) {
    const start = route.indexOf(`export async function ${method}(request: Request)`);
    assert.ok(start >= 0, method);
    const end = route.indexOf("export async function ", start + 24);
    const handler = route.slice(start, end < 0 ? undefined : end);
    assert.match(handler, /assertSameOrigin\(request\)/);
    assert.match(handler, /error: "invalid_origin"/);
    assert.match(handler, /status: 403/);
    assert.ok(handler.indexOf("assertSameOrigin(request)") < handler.indexOf("await ensureDevSeed()"));
  }
});

test("voice browser provider negotiation, speech endpoints and host turns share the same boundary", () => {
  for (const path of [
    "../src/app/api/voice/realtime/route.ts",
    "../src/app/api/voice/gemini/session/route.ts",
    "../src/app/api/voice/speech/transcribe/route.ts",
    "../src/app/api/voice/speech/speak/route.ts",
    "../src/app/api/voice/turn/route.ts",
  ]) {
    const route = read(path);
    assert.match(route, /import \{ assertSameOrigin \} from "@\/lib\/identity\/local-auth"/, path);
    const start = route.indexOf("export async function POST(request: Request)");
    assert.ok(start >= 0, path);
    const post = route.slice(start);
    assert.match(post, /assertSameOrigin\(request\)/, path);
    assert.match(post, /error: "invalid_origin"/, path);
    assert.match(post, /status: 403/);
    assert.ok(post.indexOf("assertSameOrigin(request)") < post.indexOf("await ensureDevSeed()"));
  }
});

test("both Sarvam and ElevenLabs browser relay sessions check the origin at the shared entry", () => {
  const helper = read("../src/lib/voice/provider-relay-session.ts");
  assert.match(helper, /import \{ assertSameOrigin \} from "@\/lib\/identity\/local-auth"/);
  const start = helper.indexOf("export async function startVoiceRelaySession(request: Request");
  const route = helper.slice(start);
  assert.match(route, /assertSameOrigin\(request\)/);
  assert.match(route, /error: "invalid_origin"/);
  assert.ok(route.indexOf("assertSameOrigin(request)") < route.indexOf("await ensureDevSeed()"));
  for (const provider of ["sarvam", "elevenlabs"]) {
    const route = read(`../src/app/api/voice/${provider}/session/route.ts`);
    assert.match(route, /startVoiceRelaySession\(request, /);
  }
});

test("signed server-to-server relay bootstrap stays on signature authentication, not browser Origin", () => {
  const shared = read("../src/lib/voice/provider-relay-init.ts");
  assert.match(shared, /verifyVoiceRelayRequest\(request, headerName, relayName\)/);
  assert.match(shared, /decodeVoiceRelayClaims\(body\?\.kbId\)/);
  assert.doesNotMatch(shared, /assertSameOrigin\(request\)/);
  for (const provider of ["sarvam", "elevenlabs"]) {
    const route = read(`../src/app/api/voice/${provider}/realtime-init/route.ts`);
    assert.match(route, /voiceRelayInit\(request, /);
  }
});

test("voice tool session ownership and human send approvals remain enforced", () => {
  const voice = read("../src/app/api/voice/turn/route.ts");
  const session = read("../src/app/api/voice/session/route.ts");
  const relay = read("../src/lib/voice/provider-relay-session.ts");
  assert.match(voice, /session\.user_id !== subject\.user\.id/);
  assert.match(voice, /runEmailAgentTurn\(/);
  assert.match(voice, /pendingApprovals:/);
  assert.match(session, /session\.user_id !== subject\.user\.id/);
  assert.match(relay, /session\.user_id !== subject\.user\.id/);
});
