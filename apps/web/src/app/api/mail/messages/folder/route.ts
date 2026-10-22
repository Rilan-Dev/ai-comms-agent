import { NextResponse } from "next/server";
import {
  archiveMailMessagesForOrganization,
  listMailFoldersForOrganization,
  moveMailMessagesForOrganization,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { isValidFolderBatchIds, isValidFolderId } from "@/lib/mail/folder-batch-validation";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const accountId = url.searchParams.get("accountId") ?? undefined;
    if (!organizationId) return NextResponse.json({ error: "validation_error", fieldErrors: { organizationId: "Organization is required." } }, { status: 400 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "email.read" }, getIdentityAdapter(), getIdentityRepository());
    return NextResponse.json({ folders: await listMailFoldersForOrganization(organizationId, accountId) });
  } catch (error) { return authorizationErrorToResponse(error); }
}

export async function PATCH(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const messageIds: unknown = body?.messageIds;
    const action = body?.action;
    if (!isValidFolderId(organizationId) || !isValidFolderBatchIds(messageIds) || !["archive", "move"].includes(action)) {
      return NextResponse.json({ error: "validation_error", message: "A valid organization, 1–100 unique message UUIDs, and a supported action are required." }, { status: 400 });
    }
    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    let updated = 0;
    if (action === "archive") {
      updated = await archiveMailMessagesForOrganization(organizationId, messageIds);
    } else {
      const folderId = typeof body?.folderId === "string" ? body.folderId.trim() : "";
      if (!isValidFolderId(folderId)) return NextResponse.json({ error: "validation_error", message: "A valid folder UUID is required for move." }, { status: 400 });
      updated = await moveMailMessagesForOrganization(organizationId, messageIds, folderId);
    }
    if (updated !== messageIds.length) return NextResponse.json({ error: "not_found", message: "One or more messages are not accessible in this organization or the requested folder is invalid.", updated }, { status: 404 });
    return NextResponse.json({ updated, action, requestedBy: subject.user.id });
  } catch (error) { return authorizationErrorToResponse(error); }
}
