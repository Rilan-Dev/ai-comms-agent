import { NextResponse } from "next/server";
import {
  getDecryptedProviderConfig,
  listProviderConfigs,
  recordAuditEvent,
  reuseElevenLabsRealtimeKeyForVoiceChat,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

/**
 * Explicitly copy an existing, enabled, organization-local ElevenLabs
 * Realtime secret into missing voice-chat TTS/STT credential slots.
 *
 * This is NOT automatic fallback in model discovery. An administrator must
 * initiate it. Ciphertext copying stays in PostgreSQL; the key is validated\n * server-side but no secret enters a response.
 * Existing saved keys, model choices and disabled capabilities are preserved.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null) as { organizationId?: unknown; provider?: unknown } | null;
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId || body?.provider !== "elevenlabs") {
      return NextResponse.json({
        error: "validation_error",
        message: "An organization and the ElevenLabs provider are required.",
      }, { status: 422 });
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.update" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const source = await getDecryptedProviderConfig(organizationId, "elevenlabs", "realtime");
    if (!source?.enabled || !source.hasApiKey) {
      return NextResponse.json({
        error: "source_configuration_required",
        message: "Save and enable an ElevenLabs Realtime API key in this organization before reusing it for voice chat.",
      }, { status: 409 });
    }

    // Validate server-side decryptability before duplicating an encrypted blob.
    // Do not include plaintext in the HTTP response or audit record.
    if (!source.apiKey) {
      return NextResponse.json({
        error: "provider_credentials_unavailable",
        message: "The saved Realtime credential cannot be decrypted. Ask an administrator to check the server encryption key.",
      }, { status: 503 });
    }

    const copied = await reuseElevenLabsRealtimeKeyForVoiceChat(organizationId);
    const all = await listProviderConfigs(organizationId);
    const voiceConfigs = all.filter((config) =>
      config.provider === "elevenlabs" && (config.purpose === "tts" || config.purpose === "stt"));
    await recordAuditEvent({
      organizationId,
      actorUserId: subject.user.id,
      eventType: "ai.provider_credential_reused",
      targetType: "ai_provider_config",
      action: "copy_missing_voice_credentials",
      decision: "allowed",
      metadata: { provider: "elevenlabs", sourcePurpose: "realtime", copiedPurposes: copied },
    });

    return NextResponse.json({
      ok: true,
      copiedPurposes: copied,
      capabilities: voiceConfigs.map((config) => ({
        purpose: config.purpose,
        enabled: config.enabled,
        hasApiKey: config.hasApiKey,
      })),
      message: copied.length
        ? "Existing ElevenLabs key reused for missing voice capabilities. Choose and save TTS/STT models separately."
        : "No missing enabled voice credentials were changed. Review disabled or already configured capabilities.",
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
