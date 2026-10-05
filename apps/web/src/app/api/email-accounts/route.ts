import { NextResponse } from "next/server";
import { parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { PostgresEmailAccountRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function dbRequired() {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "database_not_configured", message: "PostgreSQL is required for email accounts." },
      { status: 503 },
    );
  }
  return null;
}

export async function GET(request: Request) {
  try {
    const missingDb = dbRequired();
    if (missingDb) return missingDb;
    await ensureDevSeed();
    const organizationId = new URL(request.url).searchParams.get("organizationId");
    if (!organizationId) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: { organizationId: "Organization is required." } },
        { status: 400 },
      );
    }

    await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.read" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    const accounts = await new PostgresEmailAccountRepository().listForOrganization(organizationId);
    return NextResponse.json({ accounts });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const missingDb = dbRequired();
    if (missingDb) return missingDb;
    await ensureDevSeed();

    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    const action = typeof body?.action === "string" ? body.action : "";

    if (!organizationId) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: { organizationId: "Organization is required." } },
        { status: 400 },
      );
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), role: "admin" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    if (action !== "disconnect" || !accountId) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: { action: "A supported account action is required." } },
        { status: 422 },
      );
    }

    if (action === "connect_imap_smtp") {
      const emailAddress = typeof body?.emailAddress === "string" ? body.emailAddress.trim().toLowerCase() : "";
      const host = typeof body?.host === "string" ? body.host.trim() : "";
      const smtpHost = typeof body?.smtpHost === "string" ? body.smtpHost.trim() : host;
      const username = typeof body?.username === "string" ? body.username.trim() : "";
      const password = typeof body?.password === "string" ? body.password : "";
      const port = Number(body?.port);
      const smtpPort = Number(body?.smtpPort);
      const tls = body?.tls === true;
      if (!emailAddress || !host || !smtpHost || !username || !password || !Number.isInteger(port) || port < 1 || port > 65535 || !Number.isInteger(smtpPort) || smtpPort < 1 || smtpPort > 65535 || !tls) {
        return NextResponse.json({ error: "validation_error", message: "Email, hosts, valid ports, username, password and mandatory TLS are required." }, { status: 422 });
      }
      const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
      if (!masterKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
      const repository = new PostgresEmailAccountRepository();
      const account = await repository.create({
        organizationId,
        provider: "imap_smtp",
        emailAddress,
        displayName: typeof body?.displayName === "string" ? body.displayName.trim() : emailAddress,
        connectionConfig: { imap_host: host, imap_port: port, smtp_host: smtpHost, smtp_port: smtpPort, tls: true },
        status: "pending",
        capabilities: { folders: true, labels: false, sync_incremental: false, sync_full: true, sync_webhook: false, sync_idle: true, search_server_side: true, search_client_side: true, drafts: true, reply: true, forward: true, mark_read: true, archive: false, move: true, threads: false, attachments_download: true, attachments_upload: false, send: true },
      });
      await repository.saveCredentials(account.id, "password", { username, password, host, port, imap_host: host, imap_port: port, smtp_host: smtpHost, smtp_port: smtpPort, tls: true }, masterKey);
      await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: "email.account.created", targetType: "email_account", targetId: account.id, action: "connect", decision: "allowed", metadata: { provider: "imap_smtp" } });
      return NextResponse.json({ account }, { status: 201 });
    }

    const repository = new PostgresEmailAccountRepository();
    const account = await repository.getById(accountId);
    if (!account || account.organization_id !== organizationId) {
      return NextResponse.json({ error: "not_found", message: "Email account was not found." }, { status: 404 });
    }

    const updated = await repository.updateStatus(accountId, "disconnected");
    if (!updated) return NextResponse.json({ error: "not_found", message: "Email account was not found." }, { status: 404 });

    await recordAuditEvent({
      organizationId,
      actorUserId: subject.user.id,
      eventType: "email.account.disconnected",
      targetType: "email_account",
      targetId: accountId,
      action: "disconnect",
      decision: "allowed",
    });

    return NextResponse.json({ account: updated });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
