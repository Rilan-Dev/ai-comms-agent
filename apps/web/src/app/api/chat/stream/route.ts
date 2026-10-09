import { NextResponse } from "next/server";
import { appendConversationMessage, getChatConversation, getOrCreateChatConversation, listChatMessages, PostgresAgentRepository, query } from "@ai-comms-agent/db";
import { claraRuntime } from "@ai-comms-agent/clara-core";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for chat." }, { status: 503 });
    }

    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const agentId = typeof body?.agentId === "string" ? body.agentId : "";
    const content = typeof body?.message === "string" ? body.message.trim() : "";
    if (!organizationId || !agentId || !content) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, agentId and message are required." }, { status: 422 });
    }

    const subject = await authorize(request, {
      organizationId: asOrganizationId(organizationId),
      permission: "organization.read",
    }, getIdentityAdapter(), getIdentityRepository());

    const agent = await new PostgresAgentRepository().get(organizationId, agentId);
    if (!agent) {
      return NextResponse.json({ error: "not_found", message: "Agent was not found in this organization." }, { status: 404 });
    }

    const runtimeSettings = await query<{ knowledge_base_id: string }>("SELECT knowledge_base_id FROM organization_ai_runtime_settings WHERE organization_id = $1", [organizationId]);
    const kbId = runtimeSettings.rows[0]?.knowledge_base_id?.trim() || process.env.CLARA_KB_ID?.trim();
    if (!kbId) {
      return NextResponse.json({ error: "configuration_required", message: "CLARA_KB_ID is not configured." }, { status: 503 });
    }

    const requestedConversationId = typeof body?.conversationId === "string" ? body.conversationId.trim() : "";
    const conversation = requestedConversationId
      ? await getChatConversation(organizationId, requestedConversationId, agentId)
      : await getOrCreateChatConversation(organizationId, agentId);
    if (!conversation) {
      return NextResponse.json({ error: "not_found", message: "Conversation was not found for this organization and agent." }, { status: 404 });
    }

    const history = await listChatMessages(organizationId, conversation.id, 40);
    await appendConversationMessage({ organizationId, conversationId: conversation.id, role: "user", content });

    const messages = [
      ...history.filter((message) => message.role === "user" || message.role === "assistant" || message.role === "system").map((message) => ({ role: message.role as "user" | "assistant" | "system", content: message.content })),
      { role: "user" as const, content },
    ];

    const turn = await claraRuntime.createChatTurn({
      orgId: organizationId,
      agentId,
      kbId,
      userId: subject.user.id,
      sessionId: conversation.id,
      surface: "chat",
      ragMode: "hybrid",
      messages,
    });

    const encoder = new TextEncoder();
    let assistantOutput = "";
    const stream = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(encoder.encode("event: conversation\ndata: " + JSON.stringify({ conversationId: conversation.id }) + "\n\n"));
          for await (const chunk of turn.stream) {
            assistantOutput += chunk;
            controller.enqueue(encoder.encode("data: " + JSON.stringify({ text: chunk }) + "\n\n"));
          }
          await appendConversationMessage({ organizationId, conversationId: conversation.id, role: "assistant", content: assistantOutput });
          controller.enqueue(encoder.encode("event: done\ndata: " + JSON.stringify({ conversationId: conversation.id, provider: turn.providerName, model: turn.model }) + "\n\n"));
          controller.close();
        } catch (error) {
          controller.enqueue(encoder.encode("event: error\ndata: " + JSON.stringify({ message: error instanceof Error ? error.message : "Chat execution failed" }) + "\n\n"));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache, no-transform",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
