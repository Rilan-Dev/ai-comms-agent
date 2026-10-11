import { NextResponse } from "next/server";
import { getMailMessageForOrganization, listInboxMessages } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for the mail workspace." }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    if (!organizationId) return NextResponse.json({ error: "validation_error", message: "Organization is required." }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const messageId = url.searchParams.get("messageId");
    if (messageId) {
      const message = await getMailMessageForOrganization(organizationId, messageId);
      return message ? NextResponse.json({ message }) : NextResponse.json({ error: "not_found", message: "Message was not found." }, { status: 404 });
    }
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const offset = Number(url.searchParams.get("offset") ?? 0);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) return NextResponse.json({ error: "validation_error", message: "Invalid pagination." }, { status: 422 });
    const messages = await listInboxMessages(organizationId, {
      accountId: url.searchParams.get("accountId") ?? undefined,
      query: url.searchParams.get("q") ?? undefined,
      unreadOnly: url.searchParams.get("unread") === "true",
      actionRequired: url.searchParams.get("action") === "true",
      limit, offset,
    });
    return NextResponse.json({ messages, limit, offset });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
