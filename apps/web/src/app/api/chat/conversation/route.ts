import { NextResponse } from "next/server";
import { getOrCreateChatConversation, listChatMessages } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const agentId = url.searchParams.get("agentId") ?? "";
    if (!organizationId || !agentId) return NextResponse.json({ error: "validation_error", message: "organizationId and agentId are required." }, { status: 422 });

    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const conversation = await getOrCreateChatConversation(organizationId, agentId);
    const messages = await listChatMessages(organizationId, conversation.id, 100);
    return NextResponse.json({ conversation, messages });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
