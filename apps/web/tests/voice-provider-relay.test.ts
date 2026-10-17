import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const sessionHelper = readFileSync(resolve(__dirname, "../src/lib/voice/provider-relay-session.ts"), "utf8");
const relayAuth = readFileSync(resolve(__dirname, "../src/lib/voice/provider-relay.ts"), "utf8");
const relayInit = readFileSync(resolve(__dirname, "../src/lib/voice/provider-relay-init.ts"), "utf8");
const sarvamSession = readFileSync(resolve(__dirname, "../src/app/api/voice/sarvam/session/route.ts"), "utf8");
const elevenSession = readFileSync(resolve(__dirname, "../src/app/api/voice/elevenlabs/session/route.ts"), "utf8");
const relayServer = readFileSync(resolve(__dirname, "../../../infra/voice-relay/src/server.mjs"), "utf8");
const sarvamRelay = readFileSync(resolve(__dirname, "../../../infra/voice-relay/src/sarvam-relay.mjs"), "utf8");
const elevenRelay = readFileSync(resolve(__dirname, "../../../infra/voice-relay/src/elevenlabs-relay.mjs"), "utf8");
const sarvamTtsRelay = readFileSync(resolve(__dirname, "../../../infra/voice-relay/src/sarvam-tts-relay.mjs"), "utf8");

describe("provider realtime relay security and lifecycle", () => {
  it("mints short-lived relay tokens only after authenticated user/session checks", () => {
    expect(sessionHelper).toContain("await authorize(");
    expect(sessionHelper).toContain("session.user_id !== subject.user.id");
    expect(sessionHelper).toContain('session.status !== "starting"');
    expect(relayAuth).toContain("createHmac");
    expect(relayAuth).toContain("expiresAtMs = Date.now() + 5 * 60_000");
    expect(relayAuth).toContain("VOICE_RELAY_PUBLIC_URL");
    expect(sarvamSession).toContain('startVoiceRelaySession(request, "sarvam")');
    expect(elevenSession).toContain('startVoiceRelaySession(request, "elevenlabs")');
  });

  it("keeps provider keys server-side and rechecks the signed session in relay bootstrap", () => {
    expect(relayInit).toContain("verifyVoiceRelayRequest");
    expect(relayInit).toContain("getVoiceSessionForOrganization");
    expect(relayInit).toContain("session.user_id !== claims.userId");
    expect(relayInit).toContain("resolveVoiceProviderApiKey");
    expect(relayInit).toContain('selectedModel === "saaras:v4" || selectedModel === "saaras:v3-realtime"');
    expect(relayInit).toContain('sttModel: "scribe_v2_realtime"');
    expect(relayInit).toContain("apiKey,");
  });

  it("runs an origin-allowlisted relay and only exposes the required provider WebSocket paths", () => {
    expect(relayServer).toContain("VOICE_RELAY_ALLOWED_ORIGINS");
    expect(relayServer).toContain("/api/voice/sarvam/realtime");
    expect(relayServer).toContain("/api/voice/sarvam/tts-realtime");
    expect(relayServer).toContain("/api/voice/elevenlabs/realtime");
    expect(relayServer).toContain("/api/voice/elevenlabs/tts-realtime");
    expect(sarvamRelay).toContain("handleSarvamRealtimeConnection");
    expect(elevenRelay).toContain("handleElevenLabsRealtimeStt");
    expect(elevenRelay).toContain("handleElevenLabsRealtimeTts");
    expect(sarvamTtsRelay).toContain("handleSarvamTtsRealtimeConnection");
  });
});
