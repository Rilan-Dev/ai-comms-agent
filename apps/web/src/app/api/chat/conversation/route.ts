import { NextResponse } from "next/server";
import { createChatConversation, getChatConversation, getOrCreateChatConversation, listChatConversations, listChatMessages, PostgresAgentRepository } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";

export const dynamic = "force-dynamic";

async function authorizeChatAccess(request: Request, organizationId: string, agentId: string) {
  await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
    getIdentityAdapter(), getIdentityRepository());
  return new PostgresAgentRepository().get(organizationId, agentId);
}

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const agentId = url.searchParams.get("agentId") ?? "";
    const requestedConversationId = url.searchParams.get("conversationId") ?? "";
    if (!organizationId || !agentId) return NextResponse.json({ error: "validation_error", message: "organizationId and agentId are required." }, { status: 422 });

    const agent = await authorizeChatAccess(request, organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found", message: "Agent not found in this organization." }, { status: 404 });

    const conversation = requestedConversationId
      ? await getChatConversation(organizationId, requestedConversationId, agentId)
      : await getOrCreateChatConversation(organizationId, agentId);
    if (!conversation) return NextResponse.json({ error: "not_found", message: "Chat session not found for this agent." }, { status: 404 });

    const [messages, conversations] = await Promise.all([
      listChatMessages(organizationId, conversation.id, 100),
      listChatConversations(organizationId, agentId, 40),
    ]);
    return NextResponse.json({ conversation, messages, conversations });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

/** Explicit user action: start empty history without archiving or deleting old chats. */
export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const agentId = typeof body?.agentId === "string" ? body.agentId : "";
    if (!organizationId || !agentId) return NextResponse.json({ error: "validation_error", message: "organizationId and agentId are required." }, { status: 422 });

    const agent = await authorizeChatAccess(request, organizationId, agentId);
    if (!agent) return NextResponse.json({ error: "not_found", message: "Agent not found in this organization." }, { status: 404 });

    const conversation = await createChatConversation(organizationId, agentId);
    const conversations = await listChatConversations(organizationId, agentId, 40);
    return NextResponse.json({ conversation, messages: [], conversations }, { status: 201 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
