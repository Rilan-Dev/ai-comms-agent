import { NextResponse } from "next/server";
import { decryptCredential, parseCredentialsMasterKey, PostgresAgentRepository, getVoiceSessionForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function boundedText(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Mint a single-use, short-lived Gemini Live transcription token.
 * The organization API key remains server-side; the browser only receives
 * the constrained ephemeral token needed for one Live WebSocket session.
 */
export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = boundedText(body?.organizationId, 100);
    const agentId = boundedText(body?.agentId, 100);
    const sessionId = boundedText(body?.sessionId, 100);
    if (!organizationId || !agentId || !sessionId) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, agentId and sessionId are required." }, { status: 422 });
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId || session.ended_at) {
      return NextResponse.json({ error: "not_found", message: "Voice session was not found for this user and agent." }, { status: 404 });
    }
    if (session.status !== "starting" || String(session.provider ?? "").toLowerCase() !== "gemini") {
      return NextResponse.json({ error: "session_not_starting", message: "Gemini Live credentials can only be issued for a Gemini session that is starting." }, { status: 409 });
    }

    const credentials = await query<{ encrypted_api_key: Buffer | null; enabled: boolean }>(
      "SELECT encrypted_api_key, enabled FROM ai_provider_configs WHERE organization_id=$1 AND provider='gemini' AND purpose IN ('realtime','stt','tts','chat','general') AND enabled=true AND encrypted_api_key IS NOT NULL ORDER BY CASE WHEN purpose='realtime' THEN 0 WHEN purpose='stt' THEN 1 WHEN purpose='tts' THEN 2 WHEN purpose='chat' THEN 3 ELSE 4 END LIMIT 1",
      [organizationId],
    );
    let apiKey: string | undefined;
    const saved = credentials.rows[0];
    if (saved?.enabled && saved.encrypted_api_key?.length) {
      const masterKey = process.env.CREDENTIALS_MASTER_KEY?.trim();
      if (!masterKey) throw new Error("CREDENTIALS_MASTER_KEY is required to decrypt the organization's Gemini credential.");
      apiKey = decryptCredential(Buffer.from(saved.encrypted_api_key), parseCredentialsMasterKey(masterKey)).toString("utf8");
    }
    apiKey ||= process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) return NextResponse.json({ error: "realtime_not_configured", message: "Gemini Live is not configured for this organization or on the server." }, { status: 503 });

    const model = "models/gemini-3.5-transcribe-live";
    const expiresAt = new Date(Date.now() + 30 * 60_000).toISOString();
    const newSessionExpiresAt = new Date(Date.now() + 60_000).toISOString();
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/auth_tokens", {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        uses: 1,
        expireTime: expiresAt,
        newSessionExpireTime: newSessionExpiresAt,
        liveConnectConstraints: {
          model,
          config: {
            responseModalities: ["TEXT"],
            inputAudioTranscription: {},
          },
        },
      }),
      signal: AbortSignal.timeout(12_000),
    });
    const tokenPayload = await response.json().catch(() => ({})) as { name?: string; error?: { message?: string } };
    if (!response.ok || !tokenPayload.name) {
      return NextResponse.json({
        error: "gemini_token_mint_failed",
        message: "Gemini Live could not issue a short-lived voice token. Check the organization's Gemini Live access and model availability.",
      }, { status: response.status >= 500 ? 502 : 503 });
    }
    return NextResponse.json({
      provider: "gemini",
      model,
      ephemeralToken: tokenPayload.name,
      websocketUrl: "wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained",
      expiresAt,
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
