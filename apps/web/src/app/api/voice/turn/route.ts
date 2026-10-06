import { NextResponse } from "next/server";
import { PostgresAgentRepository, incrementVoiceSessionTurnForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { dispatchAgentExecution } from "@/lib/agent/dispatch";

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

    const result = await dispatchAgentExecution({
      executionId: crypto.randomUUID(),
      organizationId,
      agentId,
      source: "user",
      intent: "general_qa",
      params: {
        transcript,
        voiceSessionId: sessionId,
        requestedBy: subject.user.id,
      },
      requestedAt: new Date().toISOString(),
    });

    if (result.status === "configuration_required") {
      return NextResponse.json(
        { error: "configuration_required", message: result.reason, executionId: result.executionId },
        { status: 503 },
      );
    }

    await incrementVoiceSessionTurnForOrganization(organizationId, sessionId);
    return NextResponse.json({
      executionId: result.executionId,
      text: result.output ?? "",
      provider: result.provider ?? null,
      model: result.model ?? null,
      actions: result.actions ?? [],
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
