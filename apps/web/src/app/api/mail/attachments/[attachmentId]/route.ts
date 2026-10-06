import { NextResponse } from "next/server";
import { createReadStream } from "node:fs";
import { stat, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { createHash } from "node:crypto";
import { getMailAttachmentForOrganization } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ attachmentId: string }> }) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for attachments." }, { status: 503 });
    const storageRoot = process.env.ATTACHMENT_STORAGE_ROOT;
    if (!storageRoot) return NextResponse.json({ error: "storage_not_configured", message: "Attachment storage is not configured on the server." }, { status: 503 });
    await ensureDevSeed();
    const { attachmentId } = await params;
    const organizationId = new URL(request.url).searchParams.get("organizationId") ?? "";
    if (!organizationId || !attachmentId) return NextResponse.json({ error: "validation_error", message: "organizationId and attachmentId are required." }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const attachment = await getMailAttachmentForOrganization(organizationId, attachmentId);
    if (!attachment) return NextResponse.json({ error: "not_found", message: "Attachment was not found in this organization." }, { status: 404 });
    if (attachment.scan_status !== "clean") return NextResponse.json({ error: "attachment_not_safe", message: "This attachment has not passed security scanning." }, { status: 409 });
    if (!attachment.storage_path) return NextResponse.json({ error: "storage_object_missing", message: "This attachment is not available in object storage." }, { status: 404 });
    const root = resolve(storageRoot);
    const filePath = resolve(root, String(attachment.storage_path));
    const rel = relative(root, filePath);
    if (rel.startsWith("..") || rel.includes("..\\") || rel.startsWith("/")) return NextResponse.json({ error: "invalid_storage_path", message: "Attachment storage path is invalid." }, { status: 500 });
    const info = await stat(filePath).catch(() => null);
    if (!info?.isFile()) return NextResponse.json({ error: "storage_object_missing", message: "Attachment object is unavailable." }, { status: 404 });
    if (info.size > 50 * 1024 * 1024) return NextResponse.json({ error: "attachment_too_large", message: "Attachment exceeds the download size limit." }, { status: 413 });
    if (attachment.sha256) {
      const digest = createHash("sha256").update(await readFile(filePath)).digest("hex");
      if (digest !== String(attachment.sha256)) return NextResponse.json({ error: "attachment_integrity_failed", message: "Attachment integrity verification failed." }, { status: 409 });
    }
    const body = createReadStream(filePath) as unknown as BodyInit;
    return new NextResponse(body, { headers: { "Content-Type": String(attachment.content_type || "application/octet-stream"), "Content-Length": String(info.size), "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(String(attachment.filename || "attachment"))}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
