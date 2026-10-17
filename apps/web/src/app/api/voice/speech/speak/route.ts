import { NextResponse } from "next/server";
import { decryptCredential, parseCredentialsMasterKey, PostgresAgentRepository, getVoiceSessionForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function providerKey(organizationId: string, provider: "sarvam" | "elevenlabs"): Promise<string | null> {
  const result = await query<{ encrypted_api_key: Buffer | null; enabled: boolean }>(
    "SELECT encrypted_api_key, enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose IN ('tts','realtime','stt','chat','general') AND enabled=true AND encrypted_api_key IS NOT NULL ORDER BY CASE WHEN purpose='tts' THEN 0 WHEN purpose='realtime' THEN 1 WHEN purpose='stt' THEN 2 WHEN purpose='chat' THEN 3 ELSE 4 END LIMIT 1",
    [organizationId, provider],
  );
  const saved = result.rows[0];
  if (saved?.enabled && saved.encrypted_api_key?.length) {
    const masterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
    if (!masterKey) throw new Error("CREDENTIALS_MASTER_KEY is required to decrypt the organization's voice credential.");
    return decryptCredential(Buffer.from(saved.encrypted_api_key), parseCredentialsMasterKey(masterKey)).toString("utf8");
  }
  return provider === "sarvam" ? process.env.SARVAM_API_KEY?.trim() || null : process.env.ELEVENLABS_API_KEY?.trim() || null;
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = text(body?.organizationId, 100);
    const agentId = text(body?.agentId, 100);
    const sessionId = text(body?.sessionId, 100);
    const answer = text(body?.text, 4000);
    const languageCode = text(body?.languageCode, 20) || "en-IN";
    if (!organizationId || !agentId || !sessionId || !answer) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, agentId, sessionId and text are required." }, { status: 422 });
    }

    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    if (!await new PostgresAgentRepository().get(organizationId, agentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId || session.ended_at || session.status !== "active") {
      return NextResponse.json({ error: "session_not_active", message: "Speech synthesis requires this user's active voice session." }, { status: 409 });
    }
    const provider = String(session.provider ?? "").toLowerCase();
    if (provider !== "sarvam" && provider !== "elevenlabs") {
      return NextResponse.json({ error: "provider_not_supported", message: "This speech pipeline is only for Sarvam and ElevenLabs sessions." }, { status: 409 });
    }
    const apiKey = await providerKey(organizationId, provider);
    if (!apiKey) return NextResponse.json({ error: "provider_not_configured", message: `${provider} speech synthesis is not configured for this organization.` }, { status: 503 });

    if (provider === "sarvam") {
      const configuredVoice = text(session.voice_id, 100);
      const sarvamV3Speakers = new Set(["shubh","aditya","ritu","priya","neha","rahul","pooja","rohan","simran","kavya","amit","dev","ishita","shreya","ratan","varun","manan","sumit","roopa","kabir","aayan","ashutosh","advait","anand","tanya","tarun","sunny","mani","gokul","vijay","shruti","suhani","mohit","kavitha","rehan","soham","rupali"]);
      const speaker = sarvamV3Speakers.has(configuredVoice) ? configuredVoice : "shubh";
      const upstream = await fetch("https://api.sarvam.ai/text-to-speech", {
        method: "POST",
        headers: { "content-type": "application/json", "api-subscription-key": apiKey },
        body: JSON.stringify({
          text: answer,
          model: "bulbul:v3",
          language_code: languageCode,
          speaker,
          speech_sample_rate: 22050,
          output_audio_codec: "wav",
        }),
        signal: AbortSignal.timeout(25_000),
      });
      const payload = await upstream.json().catch(() => ({})) as { audios?: string[] };
      const encodedAudio = payload.audios?.[0];
      if (!upstream.ok || typeof encodedAudio !== "string") {
        return NextResponse.json({ error: "synthesis_failed", message: `Sarvam could not synthesize this answer (HTTP ${upstream.status}).` }, { status: 502 });
      }
      const audio = Buffer.from(encodedAudio, "base64");
      return new Response(audio, { headers: { "content-type": "audio/wav", "cache-control": "no-store" } });
    }

    const configuredVoice = text(session.voice_id, 100);
    const voiceId = configuredVoice && configuredVoice !== "alloy" ? configuredVoice : process.env.ELEVENLABS_VOICE_ID?.trim() || "";
    if (!voiceId || !/^[a-zA-Z0-9_-]{5,100}$/.test(voiceId)) {
      return NextResponse.json({ error: "voice_not_configured", message: "Choose a valid ElevenLabs voice ID in the agent voice settings before using this provider." }, { status: 503 });
    }
    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream?output_format=mp3_44100_128`, {
      method: "POST",
      headers: { "content-type": "application/json", "xi-api-key": apiKey },
      body: JSON.stringify({ text: answer, model_id: "eleven_turbo_v2_5" }),
      signal: AbortSignal.timeout(25_000),
    });
    if (!upstream.ok || !upstream.body) {
      return NextResponse.json({ error: "synthesis_failed", message: `ElevenLabs could not synthesize this answer (HTTP ${upstream.status}).` }, { status: 502 });
    }
    return new Response(upstream.body, { headers: { "content-type": upstream.headers.get("content-type") || "audio/mpeg", "cache-control": "no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
