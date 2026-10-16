import { NextResponse } from "next/server";
import { PostgresAgentRepository, getVoiceSessionForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { buildVoiceRelayUrl, mintVoiceRelayToken, type RelayProvider } from "./provider-relay";

function boundedText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function startVoiceRelaySession(request: Request, provider: RelayProvider) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = boundedText(body?.organizationId, 100);
    const agentId = boundedText(body?.agentId, 100);
    const sessionId = boundedText(body?.sessionId, 100);
    const languageCode = boundedText(body?.languageCode, 20) || "en-IN";
    if (!organizationId || !agentId || !sessionId) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, agentId and sessionId are required." }, { status: 422 });
    }

    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    if (!await new PostgresAgentRepository().get(organizationId, agentId)) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId || session.ended_at) {
      return NextResponse.json({ error: "not_found", message: "Voice session was not found for this user and agent." }, { status: 404 });
    }
    if (session.status !== "starting" || String(session.provider ?? "").toLowerCase() !== provider) {
      return NextResponse.json({ error: "session_not_starting", message: "A provider relay token can only be issued for a matching session that is starting." }, { status: 409 });
    }
    if (provider === "elevenlabs" && !(session.voice_id || process.env.ELEVENLABS_VOICE_ID)) {
      return NextResponse.json({ error: "voice_not_configured", message: "Configure an ElevenLabs voice ID before starting realtime voice." }, { status: 503 });
    }

    const token = mintVoiceRelayToken({ organizationId, agentId, sessionId, userId: subject.user.id, languageCode });
    const sttPath = provider === "sarvam" ? "/api/voice/sarvam/realtime" : "/api/voice/elevenlabs/realtime";
    const relayUrl = buildVoiceRelayUrl(sttPath, token.token);
    if (!relayUrl) {
      return NextResponse.json({ error: "voice_relay_not_configured", message: "VOICE_RELAY_PUBLIC_URL is not configured; this provider can use the utterance pipeline instead." }, { status: 503 });
    }
    const ttsPath = provider === "sarvam" ? "/api/voice/sarvam/tts-realtime" : "/api/voice/elevenlabs/tts-realtime";
    const ttsRelayUrl = buildVoiceRelayUrl(ttsPath, token.token);
    return NextResponse.json({
      provider,
      transportMode: "realtime",
      relayUrl,
      ttsRelayUrl,
      languageCode,
      expiresAt: token.expiresAt,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
