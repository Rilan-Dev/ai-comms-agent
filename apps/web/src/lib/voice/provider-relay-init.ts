import { NextResponse } from "next/server";
import { getVoiceSessionForOrganization, recordVoiceTelemetry } from "@ai-comms-agent/db";
import { decodeVoiceRelayClaims, resolveVoiceProviderApiKey, verifyVoiceRelayRequest, type RelayProvider } from "./provider-relay";

function bounded(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function voiceRelayInit(request: Request, provider: RelayProvider) {
  const relayName = provider === "sarvam" ? "sarvam-relay-v1" : "elevenlabs-relay-v1";
  const headerName = provider === "sarvam" ? "x-sarvam-relay" : "x-elevenlabs-relay";
  if (!verifyVoiceRelayRequest(request, headerName, relayName)) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const organizationId = bounded(body?.orgId, 100);
  const claims = decodeVoiceRelayClaims(body?.kbId);
  if (!organizationId || !claims) return NextResponse.json({ error: "invalid_relay_claims" }, { status: 400 });

  try {
    const session = await getVoiceSessionForOrganization(organizationId, claims.sessionId);
    if (!session || session.agent_id !== claims.agentId || session.user_id !== claims.userId ||
        session.ended_at || (session.status !== "starting" && session.status !== "active") ||
        String(session.provider ?? "").toLowerCase() !== provider) {
      return NextResponse.json({ error: "session_not_authorized" }, { status: 403 });
    }
    // The host stores a model only after the authenticated /api/voice/session
    // negotiation. Re-validate it here before sending an upstream relay URL.
    const selectedModel = bounded(session.model, 100);
    const apiKey = await resolveVoiceProviderApiKey(organizationId, provider);
    if (!apiKey) return NextResponse.json({ error: "provider_not_configured" }, { status: 503 });

    if (provider === "sarvam") {
      const allowedSpeakers = new Set(["shubh","aditya","ritu","priya","neha","rahul","pooja","rohan","simran","kavya","amit","dev","ishita","shreya","ratan","varun","manan","sumit","roopa","kabir","aayan","ashutosh","advait","anand","tanya","tarun","sunny","mani","gokul","vijay","shruti","suhani","mohit","kavitha","rehan","soham","rupali"]);
      const configuredSpeaker = bounded(session.voice_id, 100);
      return NextResponse.json({
        apiKey,
        baseUrl: "https://api.sarvam.ai",
        sttModel: selectedModel === "saaras:v4" || selectedModel === "saaras:v3-realtime"
          ? selectedModel : "saaras:v3-realtime",
        languageCode: claims.languageCode,
        sampleRate: 16000,
        vad: { silenceDurationMs: 750, speechThreshold: 0.025 },
        orgId: organizationId,
        agentId: claims.agentId,
        tts: {
          model: "bulbul:v3",
          speaker: allowedSpeakers.has(configuredSpeaker) ? configuredSpeaker : "shubh",
          language: claims.languageCode,
          sampleRate: 22050,
          pace: 1,
        },
      }, { headers: { "cache-control": "no-store" } });
    }

    const voiceId = bounded(session.voice_id || process.env.ELEVENLABS_VOICE_ID, 100);
    if (!voiceId) return NextResponse.json({ error: "voice_not_configured" }, { status: 503 });
    return NextResponse.json({
      apiKey,
      baseUrl: "https://api.elevenlabs.io",
      sttModel: "scribe_v2_realtime", // Only realtime STT model the current ElevenLabs relay accepts.
      languageCode: null,
      audioFormat: "pcm_16000",
      sampleRate: 16000,
      orgId: organizationId,
      agentId: claims.agentId,
      tts: {
        model: process.env.ELEVENLABS_REALTIME_TTS_MODEL?.trim() || "eleven_turbo_v2_5",
        voiceId,
        outputFormat: "pcm_16000",
        sampleRate: 16000,
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "relay_bootstrap_failed" }, { status: 500 });
  }
}

export async function meterVoiceRelay(request: Request, provider: RelayProvider) {
  const relayName = provider === "sarvam" ? "sarvam-relay-v1" : "elevenlabs-relay-v1";
  const headerName = provider === "sarvam" ? "x-sarvam-relay" : "x-elevenlabs-relay";
  if (!verifyVoiceRelayRequest(request, headerName, relayName)) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  const organizationId = bounded(body?.orgId, 100);
  const claims = decodeVoiceRelayClaims(body?.kbId);
  const kind = body?.kind === "tts" ? "tts" : "stt";
  const amount = Number(kind === "tts" ? body?.characters : body?.audioSeconds);
  const model = bounded(body?.model, 100);
  if (!organizationId || !claims || !Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "invalid_meter_payload" }, { status: 400 });
  }
  try {
    const session = await getVoiceSessionForOrganization(organizationId, claims.sessionId);
    if (!session || session.agent_id !== claims.agentId || session.user_id !== claims.userId ||
        session.ended_at || String(session.provider ?? "").toLowerCase() !== provider) {
      return NextResponse.json({ error: "session_not_authorized" }, { status: 403 });
    }
    await recordVoiceTelemetry({
      organizationId,
      voiceSessionId: claims.sessionId,
      metricName: kind === "tts" ? "provider_tts_characters" : "provider_stt_audio_seconds",
      metricValue: amount,
      unit: kind === "tts" ? "characters" : "seconds",
      stage: `${provider}_${kind}`,
      correlationId: claims.sessionId,
      metadata: { provider, model, languageCode: bounded(body?.languageCode, 20) || claims.languageCode, agentId: claims.agentId },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "metering_failed" }, { status: 500 });
  }
}
