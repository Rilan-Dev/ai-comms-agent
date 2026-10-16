import { NextResponse } from "next/server";
import { PostgresAgentRepository, activateVoiceSessionForOrganization, configureStartingVoiceSessionForOrganization, createVoiceSession, endVoiceSessionForOrganization, getVoiceSessionForOrganization, incrementVoiceSessionTurnForOrganization, query, recordVoiceTelemetry } from "@ai-comms-agent/db";
import { claraRuntime } from "@ai-comms-agent/clara-core";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
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

    // Read per-agent voice config (falls back to org-level settings when not set)
    const agentVoice = await query<{ voice_provider: string | null; voice_model: string | null; voice_id: string | null }>(
      "SELECT voice_provider, voice_model, voice_id FROM agents WHERE id = $1 AND organization_id = $2",
      [agentId, organizationId],
    );
    const agentVoiceRow = agentVoice.rows[0];

    const runtimeSettings = await query<{ knowledge_base_id: string; realtime_voice_provider: string; realtime_voice_model: string; voice_id: string }>(
      "SELECT knowledge_base_id, realtime_voice_provider, realtime_voice_model, voice_id FROM organization_ai_runtime_settings WHERE organization_id = $1",
      [organizationId],
    );
    const orgSettings = runtimeSettings.rows[0];

    // KB ID is OPTIONAL for voice. RAG features are skipped when no KB is configured.
    const kbId = orgSettings?.knowledge_base_id?.trim() || process.env.CLARA_KB_ID?.trim() || "default";

    // Per-agent voice config takes priority over org-level settings.
    // If the agent has voice_provider/voice_model/voice_id set, use those.
    // Otherwise fall back to org-level realtime_voice_provider/model/voice_id.
    const voiceProvider = agentVoiceRow?.voice_provider?.trim() || orgSettings?.realtime_voice_provider?.trim() || process.env.REALTIME_VOICE_PROVIDER || "openai";
    const voiceModel = agentVoiceRow?.voice_model?.trim() || orgSettings?.realtime_voice_model?.trim() || process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-2.1-mini";
    const rawConfiguredVoiceId = agentVoiceRow?.voice_id?.trim() || orgSettings?.voice_id?.trim();
    const configuredVoiceId = rawConfiguredVoiceId && !(voiceProvider !== "openai" && rawConfiguredVoiceId === "alloy") ? rawConfiguredVoiceId : undefined;
    const voiceId = configuredVoiceId || (
      voiceProvider === "sarvam" ? process.env.SARVAM_DEFAULT_VOICE?.trim() || "anushka" :
      voiceProvider === "elevenlabs" ? process.env.ELEVENLABS_VOICE_ID?.trim() || "" :
      process.env.OPENAI_DEFAULT_VOICE?.trim() || "alloy"
    );

    // Persist the lifecycle record before requesting realtime transport details,
    // so failures cannot leave an untracked session that the UI believes started.
    const persisted = await createVoiceSession({ organizationId, agentId, userId: subject.user.id, conversationId });
    try {
      const transport = await claraRuntime.startRealtimeSession({
        orgId: organizationId,
        agentId,
        kbId,
        userId: subject.user.id,
        sessionId: String(persisted.id),
        voiceOverride: { provider: voiceProvider, model: voiceModel, voiceId },
      });
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
