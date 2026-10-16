import { NextResponse } from "next/server";
import { PostgresAgentRepository, getVoiceSessionForOrganization, incrementVoiceSessionTurnForOrganization, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { runEmailAgentTurn } from "@ai-comms-agent/email-agent-runtime";

export const dynamic = "force-dynamic";

function text(value: unknown, max = 4000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for voice turns." }, { status: 503 });
    }

    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = text(body?.organizationId, 100);
    const agentId = text(body?.agentId, 100);
    const sessionId = text(body?.sessionId, 100);
    const transcript = text(body?.transcript);

    if (!organizationId || !agentId || !sessionId || !transcript) {
      return NextResponse.json(
        { error: "validation_error", message: "organizationId, agentId, sessionId and transcript are required." },
        { status: 422 },
      );
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found", message: "Agent was not found in this organization." }, { status: 404 });

    const session = await getVoiceSessionForOrganization(organizationId, sessionId);
    if (!session || session.user_id !== subject.user.id || session.agent_id !== agentId) {
      return NextResponse.json({ error: "not_found", message: "Voice session was not found for this user and agent." }, { status: 404 });
    }
    const transcriptBridgeOnly =
      session.status === "starting" &&
      (session.metadata as Record<string, unknown> | null)?.transportMode === "transcript_bridge";
    if ((session.status !== "active" && !transcriptBridgeOnly) || session.ended_at) {
      return NextResponse.json({ error: "session_not_active", message: "Voice turns require a connected session or an explicitly initialized transcript bridge." }, { status: 409 });
    }

    const runtimeSettings = await query<{ knowledge_base_id: string }>("SELECT knowledge_base_id FROM organization_ai_runtime_settings WHERE organization_id = $1", [organizationId]);
    // KB ID is OPTIONAL for voice turns. RAG features are skipped when no KB is configured.
    const kbId = runtimeSettings.rows[0]?.knowledge_base_id?.trim() || process.env.CLARA_KB_ID?.trim() || "default";

    const executionId = crypto.randomUUID();
    const role = subject.membership.role;
    const permissions = [...subject.permissions];
    const turn = await runEmailAgentTurn({
      organizationId,
      agentId,
      messages: [{ role: "user", content: transcript }],
      toolContext: {
        organization_id: organizationId,
        agent_id: agentId,
        user_id: subject.user.id,
        conversation_id: session.conversation_id ?? sessionId,
        turn_id: executionId,
        correlation_id: executionId,
        channel: "voice",
        auth_subject: {
          user_id: subject.user.id,
          role,
          permissions,
        },
      },
      maxRounds: 4,
      maxToolCalls: 8,
    });

    const turnRecorded = await incrementVoiceSessionTurnForOrganization(organizationId, sessionId, transcriptBridgeOnly);
    if (!turnRecorded) {
      return NextResponse.json({ error: "session_not_active", message: "Voice session ended before the turn could be recorded." }, { status: 409 });
    }
    return NextResponse.json({
      executionId,
      text: turn.text,
      toolCalls: turn.toolCalls,
      finishReason: turn.finishReason,
      actions: turn.toolCalls,
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
