import { NextResponse } from "next/server";
import { PostgresAgentRepository, activateVoiceSessionForOrganization, configureStartingVoiceSessionForOrganization, createVoiceSession, getChatConversation, getOrCreateChatConversation, endVoiceSessionForOrganization, getVoiceSessionForOrganization, getAgentAiSettings, incrementVoiceSessionTurnForOrganization, query, recordVoiceTelemetry } from "@ai-comms-agent/db";
import { resolveAgentRealtimeVoiceProvider } from "@/lib/voice/resolve-agent-realtime-provider";
import { resolveProviderVoiceConfig } from "@/lib/voice/resolve-provider-voice-config";
import { agentRuntime } from "@ai-comms-agent/agent-core";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for voice sessions." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const agentId = typeof body?.agentId === "string" ? body.agentId : "";
    const conversationId = typeof body?.conversationId === "string" ? body.conversationId : null;
    if (!organizationId || !agentId) return NextResponse.json({ error: "validation_error", message: "organizationId and agentId are required." }, { status: 422 });

    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found", message: "Agent was not found in this organization." }, { status: 404 });

    // Attach the voice session to the same authorized agent conversation as
    // Chat. Never accept an arbitrary caller-supplied conversation foreign key.
    const scopedConversation = conversationId
      ? await getChatConversation(organizationId, conversationId, agentId)
      : await getOrCreateChatConversation(organizationId, agentId);
    if (!scopedConversation) {
      return NextResponse.json({ error: "conversation_not_found" }, { status: 404 });
    }
    const safeConversationId = scopedConversation.id;

    // Read per-agent voice config (falls back to org-level settings when not set)
    const agentVoice = await query<{ voice_provider: string | null; voice_model: string | null; voice_id: string | null }>(
      "SELECT voice_provider, voice_model, voice_id FROM agents WHERE id = $1 AND organization_id = $2",
      [agentId, organizationId],
    );
    const agentVoiceRow = agentVoice.rows[0];
    // AI Settings writes these per-agent overrides into agent_ai_settings,
    // NOT the older agents.voice_provider columns.
    const agentAiSettings = await getAgentAiSettings(organizationId, agentId);

    const runtimeSettings = await query<{ knowledge_base_id: string; realtime_voice_provider: string; realtime_voice_model: string; voice_id: string }>(
      "SELECT knowledge_base_id, realtime_voice_provider, realtime_voice_model, voice_id FROM organization_ai_runtime_settings WHERE organization_id = $1",
      [organizationId],
    );
    const orgSettings = runtimeSettings.rows[0];

    // KB ID is OPTIONAL for voice. RAG features are skipped when no KB is configured.
    const kbId = orgSettings?.knowledge_base_id?.trim() || process.env.AGENT_KB_ID?.trim() || "default";

    // The selected agent's saved AI override wins. A modern NULL override
    // means inherit the organization default; never use stale legacy agent
    // fields to override that explicit inheritance.
    const voiceProvider = resolveAgentRealtimeVoiceProvider({
      agentSettings: agentAiSettings,
      legacyAgentVoiceProvider: agentVoiceRow?.voice_provider,
      organizationRealtimeVoiceProvider: orgSettings?.realtime_voice_provider,
      environmentRealtimeVoiceProvider: process.env.REALTIME_VOICE_PROVIDER,
    });
    if (!["openai", "gemini", "sarvam", "elevenlabs"].includes(voiceProvider)) {
      return NextResponse.json({
        error: "voice_provider_unsupported",
        message: "The saved realtime voice provider is not supported. Choose a supported provider in Agent AI Settings.",
      }, { status: 422 });
    }
    // The provider model is resolved only after the provider is selected.
    // In particular, an inherited OpenAI org model must not be sent as a
    // Sarvam/ElevenLabs agent's STT model.
    const providerModelResult = await query<{ model: string | null }>(
      "SELECT model FROM ai_provider_configs WHERE organization_id=$1 AND provider=$2 AND purpose='realtime' AND enabled=true LIMIT 1",
      [organizationId, voiceProvider],
    );
    const providerModel = providerModelResult.rows[0]?.model?.trim() || "";
    const orgVoiceProvider = orgSettings?.realtime_voice_provider?.trim()?.toLowerCase() || "";
    const organizationModel = orgVoiceProvider === voiceProvider
      ? orgSettings?.realtime_voice_model?.trim() || "" : "";
    const legacyModel = agentAiSettings === null ? agentVoiceRow?.voice_model?.trim() || "" : "";
    // The selected provider is authoritative for every inherited model/voice.
    // Never send OpenAI org settings to a Sarvam/ElevenLabs/Gemini session.
    const { model: voiceModel, voiceId } = resolveProviderVoiceConfig({
      provider: voiceProvider,
      hasModernAgentSettings: agentAiSettings !== null,
      agentSttModel: agentAiSettings?.realtimeSttModel?.trim(),
      agentVoiceId: agentAiSettings?.realtimeVoiceIdOverride?.trim(),
      legacyAgentProvider: agentVoiceRow?.voice_provider,
      legacyAgentModel: legacyModel,
      legacyAgentVoiceId: agentAiSettings === null ? agentVoiceRow?.voice_id?.trim() : "",
      organizationProvider: orgVoiceProvider,
      organizationModel,
      organizationVoiceId: orgSettings?.voice_id,
      providerModel,
      openAiDefaultModel: process.env.OPENAI_REALTIME_MODEL,
      openAiDefaultVoice: process.env.OPENAI_DEFAULT_VOICE,
      sarvamDefaultVoice: process.env.SARVAM_DEFAULT_VOICE,
      elevenLabsDefaultVoice: process.env.ELEVENLABS_VOICE_ID,
      geminiDefaultVoice: process.env.GEMINI_VOICE_ID,
    });
    if (voiceProvider === "elevenlabs" && !voiceId) {
      return NextResponse.json({ error: "voice_not_configured", message: "Choose an ElevenLabs voice ID in the agent voice settings before starting a voice session." }, { status: 503 });
    }

    // This is the realtime conversation surface, not the one-shot Voice Chat
    // STT/TTS feature. Sarvam must have its dedicated authenticated WebSocket
    // relay available; never silently activate an ordinary REST speech pipeline.
    if (voiceProvider === "sarvam" && (!process.env.VOICE_RELAY_PUBLIC_URL?.trim()
      || (process.env.AUTH_SECRET?.trim().length ?? 0) < 32)) {
      return NextResponse.json({
        error: "sarvam_realtime_relay_required",
        message: "Sarvam live conversation needs the secure voice WebSocket relay. Ask the workspace operator to connect the voice relay; batch speech-to-text/text-to-speech is not a live conversation.",
      }, { status: 503 });
    }

    // Persist the lifecycle record before requesting realtime transport details,
    // so failures cannot leave an untracked session that the UI believes started.
    const persisted = await createVoiceSession({ organizationId, agentId, userId: subject.user.id, conversationId: safeConversationId });
    try {
      const transport = await agentRuntime.startRealtimeSession({
        orgId: organizationId,
        agentId,
        kbId,
        userId: subject.user.id,
        sessionId: String(persisted.id),
        voiceOverride: { provider: voiceProvider, model: voiceModel, voiceId },
      });
      if (voiceProvider === "sarvam" &&
          (transport.transportMode !== "realtime" || transport.realtimeProvider !== "sarvam")) {
        await endVoiceSessionForOrganization(organizationId, String(persisted.id), "realtime_unavailable");
        return NextResponse.json({
          error: "sarvam_realtime_unavailable",
          message: "Sarvam realtime speech is not ready for this agent. Verify the connected Sarvam provider credential and WebSocket relay configuration.",
        }, { status: 503 });
      }
      const configured = await configureStartingVoiceSessionForOrganization({
        organizationId,
        sessionId: String(persisted.id),
        provider: transport.realtimeProvider,
        model: transport.model,
        voiceId: transport.voiceId,
        metadata: { transportMode: transport.transportMode, sessionEndpoint: "sessionEndpoint" in transport ? transport.sessionEndpoint : null, turnEndpoint: transport.turnEndpoint },
      });
      if (!configured) {
        await endVoiceSessionForOrganization(organizationId, String(persisted.id), "error");
        return NextResponse.json({ error: "session_start_failed", message: "Voice session could not be initialized." }, { status: 409 });
      }
      return NextResponse.json({ session: configured, transport });
    } catch (error) {
      try {
        await endVoiceSessionForOrganization(organizationId, String(persisted.id), "error");
      } catch (cleanupError) {
        console.error("[voice/session] failed to close an unsuccessful start", cleanupError);
      }
      throw error;
    }
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}


export async function PATCH(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    const action = typeof body?.action === "string" ? body.action : "";
    if (!organizationId || !sessionId || !action) return NextResponse.json({ error: "validation_error", message: "organizationId, sessionId and action are required." }, { status: 422 });
    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });

    if (action === "activate") {
      const updated = await activateVoiceSessionForOrganization(organizationId, sessionId, typeof body?.providerSessionId === "string" ? body.providerSessionId.slice(0, 500) : null);
      if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
      return NextResponse.json({ session: updated });
    }
    if (action === "turn") {
      if (session.status !== "active") {
        return NextResponse.json({ error: "session_not_active", message: "Voice turns require an active voice session." }, { status: 409 });
      }
      const incremented = await incrementVoiceSessionTurnForOrganization(organizationId, sessionId);
      if (!incremented) {
        return NextResponse.json({ error: "session_not_active", message: "Voice session ended before the turn could be recorded." }, { status: 409 });
      }
      return NextResponse.json({ ok: true });
    }
    if (action === "telemetry") {
      const metricName = typeof body?.metricName === "string" ? body.metricName.slice(0, 100) : "";
      const metricValue = typeof body?.metricValue === "number" && Number.isFinite(body.metricValue) ? body.metricValue : NaN;
      if (!metricName || !Number.isFinite(metricValue)) return NextResponse.json({ error: "validation_error", message: "metricName and finite metricValue are required." }, { status: 422 });
      await recordVoiceTelemetry({ organizationId, voiceSessionId: sessionId, metricName, metricValue, unit: typeof body?.unit === "string" ? body.unit.slice(0, 32) : null, stage: typeof body?.stage === "string" ? body.stage.slice(0, 100) : null, correlationId: typeof body?.correlationId === "string" ? body.correlationId.slice(0, 100) : null, metadata: body?.metadata && typeof body.metadata === "object" ? body.metadata : {} });
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: "unsupported_action" }, { status: 422 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function DELETE(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
    if (!organizationId || !sessionId) return NextResponse.json({ error: "validation_error", message: "organizationId and sessionId are required." }, { status: 422 });
    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id) return NextResponse.json({ error: "not_found" }, { status: 404 });
    const ended = await endVoiceSessionForOrganization(organizationId, sessionId, typeof body?.reason === "string" ? body.reason.slice(0, 200) : null);
    if (!ended) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ session: ended });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
