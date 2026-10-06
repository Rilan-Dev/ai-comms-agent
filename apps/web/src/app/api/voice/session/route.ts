import { NextResponse } from "next/server";
import { PostgresAgentRepository, activateVoiceSessionForOrganization, createVoiceSession, endVoiceSessionForOrganization, getVoiceSessionForOrganization, incrementVoiceSessionTurnForOrganization, recordVoiceTelemetry } from "@ai-comms-agent/db";
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

    const kbId = process.env.CLARA_KB_ID?.trim();
    if (!kbId) return NextResponse.json({ error: "configuration_required", message: "CLARA_KB_ID is not configured." }, { status: 503 });

    const session = await claraRuntime.startRealtimeSession({ orgId: organizationId, agentId, kbId, userId: subject.user.id, sessionId: crypto.randomUUID(), surface: "voice" });
    const persisted = await createVoiceSession({ organizationId, agentId, userId: subject.user.id, conversationId, provider: session.provider, model: session.model, voiceId: session.voiceId, metadata: { sessionEndpoint: session.sessionEndpoint } });
    return NextResponse.json({ session: persisted, transport: session });
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
      await incrementVoiceSessionTurnForOrganization(organizationId, sessionId);
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
