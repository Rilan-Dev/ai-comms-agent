import { NextResponse } from "next/server";
import { listMailAttachmentsForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for attachments." }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const messageId = url.searchParams.get("messageId") ?? "";
    if (!organizationId || !messageId) return NextResponse.json({ error: "validation_error", message: "organizationId and messageId are required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const attachments = await listMailAttachmentsForOrganization(organizationId, messageId);
    return NextResponse.json({ attachments: attachments.map(a => ({ ...a, download_available: a.scan_status === "clean" && Boolean(a.storage_bucket && a.storage_path) })) });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
