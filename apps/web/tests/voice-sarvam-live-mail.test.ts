import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { parseRollingMailSummaryRequest } from "../src/lib/mail/rolling-summary";

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), "utf8");
const voiceSession = read("../src/app/api/voice/session/route.ts");
const voiceTurn = read("../src/app/api/voice/turn/route.ts");
const workspace = read("../src/app/ai-voice/voice-workspace.tsx");
const clara = read("../../../packages/clara-core/src/runtime.ts");
const loop = read("../../../packages/email-agent-runtime/src/email-agent-loop.ts");
const relay = read("../../../infra/voice-relay/src/server.mjs");
const sarvamRelay = read("../../../infra/voice-relay/src/sarvam-relay.mjs");
const ttsRelay = read("../../../infra/voice-relay/src/sarvam-tts-relay.mjs");

describe("Sarvam live voice and grounded workspace mail", () => {
  it("keeps realtime STT and TTS on actual server-side WebSockets", () => {
    expect(relay).toContain('"/api/voice/sarvam/realtime"');
    expect(relay).toContain('"/api/voice/sarvam/tts-realtime"');
    expect(sarvamRelay).toContain("new WebSocket(upstreamUrl");
    expect(sarvamRelay).toContain('type: "transcript_final"');
    expect(ttsRelay).toContain("new WebSocket(upstreamUrl");
    expect(ttsRelay).toContain("api-subscription-key");
  });

  it("refuses Sarvam sessions without both the relay and an actual realtime descriptor", () => {
    expect(clara).toContain('if (available && provider === "elevenlabs")');
    expect(voiceSession).toContain('error: "sarvam_realtime_relay_required"');
    expect(voiceSession).toContain('error: "sarvam_realtime_unavailable"');
    expect(voiceSession).toContain('transport.transportMode !== "realtime"');
    expect(voiceSession).toContain('endVoiceSessionForOrganization(organizationId, String(persisted.id), "realtime_unavailable")');
    expect(workspace).toContain('payload.transport.transportMode === "pipeline" && payload.transport.realtimeProvider === "elevenlabs"');
    expect(workspace).toContain("No batch TTS fallback is allowed in a live voice conversation.");
  });

  it("waits for Saaras, Bulbul and microphone readiness before activating", () => {
    const body = workspace.slice(workspace.indexOf("async function connectProviderRealtime("), workspace.indexOf("async function connectSpeechPipeline("));
    expect(body).toContain("let sttReady = false;");
    expect(body).toContain('let ttsReady = provider !== "sarvam";');
    expect(body).toContain("let microphoneReady = false;");
    expect(body).toContain("if (!sttReady || !ttsReady || !microphoneReady || activationStartedRef.current) return;");
    expect(body).toContain("ttsReady = true;");
    expect(body).toContain("sttReady = true;");
    expect(body).toContain("microphoneReady = true;");
    expect(body).toContain('void reportUnexpectedTransportLoss("Sarvam Bulbul realtime speech socket closed.');
    expect(body).toContain('void patchSession({ action: "activate" })');
  });

  it("uses counted, permission-scoped local email evidence for natural last-24h voice questions", () => {
    expect(parseRollingMailSummaryRequest("Can you please let me know last 24 hours emails received in my workspace?"))
      .toEqual({ hours: 24, unreadOnly: false });
    expect(voiceTurn).toContain("parseRollingMailSummaryRequest(transcript)");
    expect(voiceTurn).toContain('subject.permissions.has("email.read")');
    expect(voiceTurn).toContain("createEmailToolRuntime(organizationId, agentId)");
    expect(voiceTurn).toContain('tool.name === "email.search" || tool.name === "email.messages.list"');
    expect(voiceTurn).toContain("m.organization_id=$1");
    expect(voiceTurn).toContain("bound_agent.organization_id=$1");
    expect(voiceTurn).toContain("b.role IN ('primary','read_only')");
    expect(voiceTurn).toContain("m.received_at >= $3::timestamptz");
    expect(voiceTurn).toContain("m.received_at <= $4::timestamptz");
    expect(voiceTurn).toContain("COUNT(*) OVER ()::integer AS total_count");
    expect(voiceTurn).toContain("formatRollingMailSummary(");
    expect(voiceTurn).toContain("LIMIT $8");
    expect(voiceTurn).toContain("rollingMail.unreadOnly, 5");
    expect(voiceTurn).toContain('mode: "verified-local-mail"');
    expect(voiceTurn).toContain('source: rollingMailDenied ? "permission_gate" : "local_mail_database"');
  });

  it("refuses model-produced mailbox claims without successful message/search retrieval", () => {
    expect(voiceTurn).toContain("requireEmailContentEvidence: requiresEmailContentEvidence");
    expect(loop).toContain("input.requireEmailContentEvidence && !summaries.some(");
    expect(loop).toContain('"email.search", "email.messages.list", "email.message.get", "email.thread.get"');
    expect(loop).toContain("No email summary is confirmed.");
    expect(voiceTurn).toContain("No email summary or action was confirmed.");
  });
});
