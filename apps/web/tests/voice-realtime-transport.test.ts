import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const realtimeRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/realtime/route.ts"), "utf8");
const geminiSessionRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/gemini/session/route.ts"), "utf8");
const speechTranscribeRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/speech/transcribe/route.ts"), "utf8");
const speechSpeakRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/speech/speak/route.ts"), "utf8");
const sessionRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/session/route.ts"), "utf8");
const workspace = readFileSync(resolve(__dirname, "../src/app/ai-voice/voice-workspace.tsx"), "utf8");
const turnRoute = readFileSync(resolve(__dirname, "../src/app/api/voice/turn/route.ts"), "utf8");

describe("Clara realtime voice transport", () => {
  it("negotiates WebRTC SDP only after host authorization and session ownership checks", () => {
    expect(realtimeRoute).toContain("await authorize(");
    expect(realtimeRoute).toContain("new PostgresAgentRepository().get(organizationId, agentId)");
    expect(realtimeRoute).toContain("session.user_id !== subject.user.id");
    expect(realtimeRoute).toContain("session.agent_id !== agentId");
    expect(realtimeRoute).toContain('session.status !== "starting"');
    expect(realtimeRoute).toContain("https://api.openai.com/v1/realtime/calls");
    expect(realtimeRoute).toContain('headers: { authorization: `Bearer ${apiKey}` }');
    expect(realtimeRoute).toContain('content-type": "application/sdp');
  });

  it("mints a constrained single-use Gemini Live token only for an authorized starting session", () => {
    expect(geminiSessionRoute).toContain("await authorize(");
    expect(geminiSessionRoute).toContain("session.user_id !== subject.user.id");
    expect(geminiSessionRoute).toContain('session.status !== "starting"');
    expect(geminiSessionRoute).toContain('uses: 1');
    expect(geminiSessionRoute).toContain("liveConnectConstraints");
    expect(geminiSessionRoute).toContain("inputAudioTranscription");
    expect(geminiSessionRoute).toContain("x-goog-api-key");
    expect(geminiSessionRoute).not.toContain("return NextResponse.json({ apiKey");
    expect(workspace).toContain("connectGeminiRealtime");
    expect(workspace).toContain("audio/pcm;rate=16000");
    expect(workspace).toContain("Gemini Live WebSocket");
  });

  it("does not expose the long-lived provider credential to the browser", () => {
    expect(realtimeRoute).toContain("process.env.OPENAI_API_KEY");
    expect(realtimeRoute).toContain("purpose IN ('realtime'");
    expect(realtimeRoute).toContain("decryptCredential");
    expect(realtimeRoute).not.toContain("return NextResponse.json({ apiKey");
    expect(workspace).not.toContain("OPENAI_API_KEY");
    expect(workspace).toContain('body: JSON.stringify({ organizationId, agentId: agent?.id, sessionId: current.id, sdp })');
  });

  it("uses real microphone, peer connection and data channel lifecycle events", () => {
    expect(workspace).toContain("navigator.mediaDevices.getUserMedia");
    expect(workspace).toContain("new RTCPeerConnection()");
    expect(workspace).toContain("Realtime session readiness timed out");
    expect(workspace).toContain('pc.createDataChannel("oai-events")');
    expect(workspace).toContain("pc.ontrack");
    expect(workspace).toContain('type === "session.created"');
    expect(workspace).toContain('channel.readyState !== "open"');
    expect(workspace).toContain('await patchSession({ action: "activate"');
  });

  it("routes final speech transcripts through the host-authorized turn route before speaking answers", () => {
    expect(workspace).toContain('type === "conversation.item.input_audio_transcription.completed"');
    expect(workspace).toContain('fetch("/api/voice/turn"');
    expect(workspace).toContain('type: "response.create"');
    expect(turnRoute).toContain("await authorize(");
    expect(turnRoute).toContain("session.user_id !== subject.user.id || session.agent_id !== agentId");
    expect(turnRoute).toContain("runEmailAgentTurn");
    expect(turnRoute).toContain("toolContext: {");
    expect(turnRoute).toContain('channel: "voice"');
    expect(turnRoute).toContain("permissions,");
    // The voice turn route uses runEmailAgentTurn as the primary path.
    // A fallback to claraRuntime.createChatTurn exists for agents without
    // email tools enabled — this is a valid code path, not a regression.
  });

  it("uses the same shared authorized email runtime for spoken and typed turns", () => {
    expect(turnRoute).toContain('import { runEmailAgentTurn } from "@ai-comms-agent/email-agent-runtime"');
    expect(turnRoute).toContain("if (!subject.membership)");
    expect(turnRoute).toContain("subject.membership.role");
    expect(turnRoute).toContain('conversation_id: typeof session.conversation_id === "string"');
    expect(turnRoute).toContain("[...subject.permissions]");
    expect(turnRoute).toContain("maxRounds: 4");
    expect(turnRoute).toContain("maxToolCalls: 8");
  });

  it("uses provider-specific Sarvam and ElevenLabs speech services behind the host", () => {
    expect(speechTranscribeRoute).toContain("await authorize(");
    expect(speechTranscribeRoute).toContain('session.status !== "active"');
    expect(speechTranscribeRoute).toContain("api-subscription-key");
    expect(speechTranscribeRoute).toContain("xi-api-key");
    expect(speechTranscribeRoute).toContain("scribe_v2");
    expect(speechTranscribeRoute).toContain("saaras:v4");
    expect(speechSpeakRoute).toContain("await authorize(");
    expect(speechSpeakRoute).toContain("bulbul:v3");
    expect(speechSpeakRoute).toContain("eleven_turbo_v2_5");
    expect(workspace).toContain("connectSpeechPipeline");
    expect(workspace).toContain("submitPipelineUtterance");
    expect(workspace).toContain("Sarvam STT/TTS pipeline");
    expect(workspace).toContain("ElevenLabs STT/TTS pipeline");
  });

  it("reuses one generation identifier for provider TTS fallback playback", () => {
    const providerSpeechBranch = workspace.slice(
      workspace.indexOf('if (realtimeProviderRef.current === "sarvam" || realtimeProviderRef.current === "elevenlabs")'),
      workspace.indexOf('if (realtimeProviderRef.current === "gemini")'),
    );
    expect(providerSpeechBranch.match(/const generationId =/g)).toHaveLength(1);
    expect(providerSpeechBranch).toContain("ttsGenerationRef.current = generationId;");
  });

  it("guards missing indexed audio samples during PCM16 resampling", () => {
    const resampler = workspace.slice(
      workspace.indexOf("function downsampleTo16k("),
      workspace.indexOf("function pcm16ToWav("),
    );
    expect(resampler).toContain("const sample = input[i] ?? 0;");
    expect(resampler).toContain("sum += input[j] ?? 0;");
    expect(workspace).toContain("samples[i] ?? 0, true);");
    expect(workspace).toContain("(samples[i] ?? 0) / 32768");
    expect(workspace).toContain("const sample = input[i] ?? 0; energy += sample * sample;");
  });

  it("keeps the OpenAI SDP endpoint provider-specific and refuses unsupported negotiation", () => {
    expect(realtimeRoute).toContain("provider_transport_unsupported");
    expect(workspace).toContain("This provider has not completed its native realtime transport integration");
  });
  it("keeps Gemini Live microphone transmission muted after React state changes", () => {
    const gemini = workspace.slice(workspace.indexOf("async function connectGeminiRealtime("), workspace.indexOf("async function connectRealtime("));
    const audioHandler = gemini.slice(gemini.indexOf("processor.onaudioprocess ="), gemini.indexOf("socket.onopen ="));
    const toggle = workspace.slice(workspace.indexOf("function toggleMute()"), workspace.indexOf("function interrupt()"));
    expect(toggle).toContain("micMutedRef.current = next;");
    expect(audioHandler).toContain("if (micMutedRef.current || ttsGenerationRef.current || socket.readyState !== WebSocket.OPEN) return;");
    expect(audioHandler).not.toContain("if (micMuted ||");
  });

});
