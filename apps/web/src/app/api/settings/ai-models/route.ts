import { NextResponse } from "next/server";
import { getDecryptedProviderConfig, getProviderConfig } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getAuthenticatedAppContext, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { documentedRealtimeModels, documentedSarvamVoiceModels, fetchLiveModelCatalog, hasDocumentedRealtimeModels, hasDocumentedSarvamVoiceModels, supportsLiveCatalog, type LiveModelProvider, type LiveModelPurpose } from "@/lib/ai/live-model-catalog";

export const dynamic = "force-dynamic";

/**
 * GET /api/settings/ai-models?organizationId=...&provider=openai&purpose=chat
 *
 * Credentials are loaded exclusively from the requesting organization's
 * encrypted, enabled provider configuration. No static catalogue, env-wide
 * key, or untrusted base URL is used. Unsupported vendor catalogues are
 * reported, not fabricated.
 */
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    const context = await getAuthenticatedAppContext(request);
    const organizationId = params.get("organizationId")?.trim() || context?.organizationId || "";
    const provider = params.get("provider")?.trim().toLowerCase() || "";
    const purpose = params.get("purpose")?.trim().toLowerCase() || "chat";

    if (!organizationId) {
      return NextResponse.json({ error: "validation_error", message: "An organization context is required." }, { status: 422 });
    }
    // Do not disclose provider credentials, or even catalogue availability,
    // to unauthenticated or cross-organization callers.
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    if (!supportsLiveCatalog(provider, purpose) && !hasDocumentedRealtimeModels(provider, purpose) && !hasDocumentedSarvamVoiceModels(provider, purpose)) {
      return NextResponse.json({
        error: "catalog_unsupported",
        message: "This provider does not publish a live model listing for this capability. No static model list is substituted.",
        models: [],
      }, { status: 422 });
    }
    const saved = await getDecryptedProviderConfig(organizationId, provider, purpose as LiveModelPurpose);
    if (!saved?.enabled || !saved.apiKey) {
      // A Realtime key does not automatically configure the separate TTS and
      // STT capability rows. Offer an explicit, authenticated reuse path
      // instead of silently sharing credentials across purposes.
      const voiceCapability = provider === "elevenlabs" && (purpose === "tts" || purpose === "stt");
      const realtime = voiceCapability && !saved?.hasApiKey && saved?.enabled !== false
        ? await getProviderConfig(organizationId, "elevenlabs", "realtime")
        : null;
      const reusable = Boolean(realtime?.enabled && realtime.hasApiKey);
      const unavailableStoredKey = Boolean(saved?.enabled && saved.hasApiKey && !saved.apiKey);
      return NextResponse.json({
        error: unavailableStoredKey ? "provider_credentials_unavailable" : "provider_configuration_required",
        message: unavailableStoredKey
          ? "An encrypted API key is saved, but the server could not read it. Ask an administrator to check the credentials encryption configuration."
          : saved && !saved.enabled
            ? "This provider is disabled for this capability. Enable it in AI Provider Setup before loading models."
            : reusable
              ? "An ElevenLabs Realtime key is enabled, but TTS/STT keys are configured separately. In AI Provider Setup → Voice Chat, choose 'Use saved Realtime key for missing TTS/STT'."
              : "Save and enable this provider's API key for this capability before loading live models.",
        models: [],
        ...(reusable ? { canReuseRealtimeKey: true } : {}),
      }, { status: unavailableStoredKey ? 503 : 409, headers: { "Cache-Control": "private, no-store" } });
    }

    // Sarvam speech TTS/STT use vendor-documented IDs, not the unrelated
    // Sarvam /v2/models CHAT catalogue. Verify the exact organization/purpose
    // saved credential first; never leak a catalogue for a disabled key.
    if (hasDocumentedSarvamVoiceModels(provider, purpose)) {
      return NextResponse.json({
        models: documentedSarvamVoiceModels(provider, purpose),
        provider,
        purpose,
        source: "documented",
        capability: purpose,
        message: "These are Sarvam-documented speech models supported by this app\'s current voice pipeline, not a live per-key model list. Actual provider access is checked when speech runs.",
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    // Sarvam and ElevenLabs realtime voice on this host are streaming
    // speech-recognition + host-authorized response/TTS pipelines, not vendor
    // conversational agents. Their websocket model choices are documented by
    // the vendors but NOT exposed through a live REST models endpoint.
    // Only show these after the same authenticated per-org enabled-key check.
    if (hasDocumentedRealtimeModels(provider, purpose)) {
      return NextResponse.json({
        models: documentedRealtimeModels(provider, purpose),
        provider,
        purpose,
        source: "documented",
        capability: "streaming_stt",
        message: "These are vendor-documented streaming speech-recognition models for this app's voice relay, not account-verified live model listings or ElevenLabs Conversational AI agents.",
      }, { headers: { "Cache-Control": "private, no-store" } });
    }

    try {
      const models = await fetchLiveModelCatalog(provider as LiveModelProvider, purpose as LiveModelPurpose, saved.apiKey);
      return NextResponse.json({ models, provider, purpose, source: "live" }, {
        headers: { "Cache-Control": "private, no-store" },
      });
    } catch {
      return NextResponse.json({
        error: "model_catalog_unavailable",
        message: "The provider model catalogue is unavailable. Retry after checking provider access; no static models will be shown.",
        models: [],
      }, { status: 502 });
    }
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
