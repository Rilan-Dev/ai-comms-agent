import { NextResponse } from "next/server";
import { decryptCredential, parseCredentialsMasterKey, PostgresAgentRepository, getVoiceSessionForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

async function providerKey(organizationId: string, provider: "sarvam" | "elevenlabs"): Promise<string | null> {
  const result = await query<{ encrypted_api_key: Buffer | null; enabled: boolean }>(
    "SELECT encrypted_api_key, enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose IN ('voice_chat','realtime','chat') ORDER BY CASE WHEN purpose='voice_chat' THEN 0 WHEN purpose='realtime' THEN 1 ELSE 2 END LIMIT 1",
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
    const form = await request.formData();
    const organizationId = text(form.get("organizationId"), 100);
    const agentId = text(form.get("agentId"), 100);
    const sessionId = text(form.get("sessionId"), 100);
    const languageCode = text(form.get("languageCode"), 20) || "en-IN";
    const audio = form.get("audio");
    if (!organizationId || !agentId || !sessionId || !(audio instanceof File) || audio.size === 0 || audio.size > 12 * 1024 * 1024) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, agentId, sessionId and a non-empty audio file under 12 MB are required." }, { status: 422 });
    }

    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    if (!await new PostgresAgentRepository().get(organizationId, agentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId || session.ended_at || session.status !== "active") {
      return NextResponse.json({ error: "session_not_active", message: "Speech transcription requires this user's active voice session." }, { status: 409 });
    }
    const provider = String(session.provider ?? "").toLowerCase();
    if (provider !== "sarvam" && provider !== "elevenlabs") {
      return NextResponse.json({ error: "provider_not_supported", message: "This speech pipeline is only for Sarvam and ElevenLabs sessions." }, { status: 409 });
    }
    const apiKey = await providerKey(organizationId, provider);
    if (!apiKey) return NextResponse.json({ error: "provider_not_configured", message: `${provider} speech recognition is not configured for this organization.` }, { status: 503 });

    const upstreamForm = new FormData();
    upstreamForm.append("file", new Blob([await audio.arrayBuffer()], { type: audio.type || "audio/wav" }), audio.name || "voice-utterance.wav");
    let upstream: Response;
    if (provider === "sarvam") {
      upstreamForm.append("model", "saaras:v4");
      upstreamForm.append("mode", "transcribe");
      upstreamForm.append("language_code", languageCode);
      upstream = await fetch("https://api.sarvam.ai/speech-to-text", {
        method: "POST",
        headers: { "api-subscription-key": apiKey },
        body: upstreamForm,
        signal: AbortSignal.timeout(25_000),
      });
    } else {
      upstreamForm.append("model_id", "scribe_v2");
      upstreamForm.append("tag_audio_events", "false");
      upstreamForm.append("diarize", "false");
      upstream = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
        method: "POST",
        headers: { "xi-api-key": apiKey },
        body: upstreamForm,
        signal: AbortSignal.timeout(25_000),
      });
    }
    const payload = await upstream.json().catch(() => ({})) as { transcript?: string; text?: string };
    if (!upstream.ok) {
      return NextResponse.json({ error: "transcription_failed", message: `${provider} could not transcribe this utterance (HTTP ${upstream.status}).` }, { status: 502 });
    }
    const transcript = text(payload.transcript ?? payload.text, 4000);
    return NextResponse.json({ provider, transcript }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
