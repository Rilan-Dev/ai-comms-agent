import { NextResponse } from "next/server";
import { parseCredentialsMasterKey } from "@ai-comms-agent/db";
import { PostgresEmailAccountRepository, recordAuditEvent } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { testImapSmtpConnection } from "@ai-comms-agent/db";
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

export async function DELETE(request: Request) {
  try {
    const missingDb = dbRequired();
    if (missingDb) return missingDb;
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const accountId = typeof body?.accountId === "string" ? body.accountId : "";
    if (!organizationId || !accountId) return NextResponse.json({ error: "validation_error", message: "Organization and account are required." }, { status: 422 });
    const subject = await authorize(request, { organizationId: asOrganizationId(organizationId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const repository = new PostgresEmailAccountRepository();
    const account = await repository.getById(accountId);
    if (!account || account.organization_id !== organizationId) return NextResponse.json({ error: "not_found", message: "Email account was not found." }, { status: 404 });
    const deleted = await repository.delete(accountId);
    if (!deleted) return NextResponse.json({ error: "not_found", message: "Email account was not found." }, { status: 404 });
    await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: "email.account.deleted", targetType: "email_account", targetId: accountId, action: "delete", decision: "allowed", metadata: { provider: account.provider } });
    return NextResponse.json({ ok: true });
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

    if (!["disconnect", "connect_imap_smtp", "test_imap_smtp", "reconnect_imap_smtp"].includes(action)) {
      return NextResponse.json(
        { error: "validation_error", fieldErrors: { action: "A supported account action is required." } },
        { status: 422 },
      );
    }

    if (action === "reconnect_imap_smtp") {
      if (!accountId) return NextResponse.json({ error: "validation_error", fieldErrors: { accountId: "Account is required." } }, { status: 422 });
      const repository = new PostgresEmailAccountRepository();
      const account = await repository.getById(accountId);
      if (!account || account.organization_id !== organizationId) {
        return NextResponse.json({ error: "not_found", message: "Email account was not found." }, { status: 404 });
      }
      if (account.provider !== "imap_smtp") {
        return NextResponse.json({ error: "validation_error", message: "Only IMAP/SMTP accounts can be reconnected from this action." }, { status: 422 });
      }
      const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
      if (!masterKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
      const credentials = await repository.loadCredentials(accountId, masterKey);
      if (!credentials) return NextResponse.json({ error: "provider_configuration_required", message: "Saved mailbox credentials are unavailable. Reconfigure this account." }, { status: 409 });
      try {
        await testImapSmtpConnection({
          host: String(credentials.host ?? ""),
          port: Number(credentials.port),
          username: String(credentials.username ?? ""),
          password: String(credentials.password ?? ""),
          smtpHost: String(credentials.smtp_host ?? credentials.host ?? ""),
          smtpPort: Number(credentials.smtp_port ?? 465),
          tls: credentials.tls === true,
        });
        const updated = await repository.updateStatus(accountId, "connected");
        await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: "email.account.reconnected", targetType: "email_account", targetId: accountId, action: "reconnect", decision: "allowed", metadata: { provider: "imap_smtp" } });
        return NextResponse.json({ account: updated, ok: true });
      } catch (error) {
        const message = error instanceof Error ? error.message : "IMAP/SMTP connection failed.";
        await repository.updateStatus(accountId, "error", message);
        await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: "email.account.reconnect_failed", targetType: "email_account", targetId: accountId, action: "reconnect", decision: "allowed", metadata: { provider: "imap_smtp" } });
        return NextResponse.json({ error: "provider_connection_failed", message }, { status: 502 });
      }
    }

    if (action === "connect_imap_smtp" || action === "test_imap_smtp") {
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
      let test;
      try {
        test = await testImapSmtpConnection({ host, port, username, password, smtpHost, smtpPort, tls });
      } catch (error) {
        const code = typeof error === "object" && error !== null && "code" in error
          ? String((error as { code?: unknown }).code ?? "")
          : "";
        const message = error instanceof Error ? error.message : "IMAP/SMTP connection failed.";
        const safeMessage = code === "ENOTFOUND" || code === "EAI_AGAIN"
          ? "Could not resolve the mail server hostname. Check the IMAP and SMTP hostnames and the server's DNS connectivity."
          : code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ECONNRESET"
            ? "Could not connect to the mail server. Check the host, port, TLS settings, and outbound network access."
            : message;
        return NextResponse.json(
          { error: "provider_connection_failed", message: safeMessage },
          { status: 502 },
        );
      }
      if (action === "test_imap_smtp") return NextResponse.json({ ok: true, test });
            const masterKey = process.env.CREDENTIALS_MASTER_KEY ? parseCredentialsMasterKey(process.env.CREDENTIALS_MASTER_KEY) : null;
      if (!masterKey) return NextResponse.json({ error: "provider_configuration_required", message: "Credential encryption is not configured on the server." }, { status: 503 });
      const repository = new PostgresEmailAccountRepository();
      const connectionConfig = { imap_host: host, imap_port: port, smtp_host: smtpHost, smtp_port: smtpPort, tls: true };
      const capabilities = { folders: true, labels: false, sync_incremental: false, sync_full: true, sync_webhook: false, sync_idle: true, search_server_side: true, search_client_side: true, drafts: false, reply: false, forward: false, mark_read: true, archive: false, move: false, threads: false, attachments_download: false, attachments_upload: false, send: false };
      const existing = await repository.findByOrganizationProviderAddress(organizationId, "imap_smtp", emailAddress);
      let account;
      if (existing) {
        account = await repository.updateConnection(existing.id, {
          emailAddress,
          displayName: typeof body?.displayName === "string" ? body.displayName.trim() : emailAddress,
          connectionConfig,
          capabilities,
          status: "pending",
        });
        if (!account) return NextResponse.json({ error: "not_found", message: "Email account disappeared during reconnect." }, { status: 404 });
      } else {
        account = await repository.create({
          organizationId,
          provider: "imap_smtp",
          emailAddress,
          displayName: typeof body?.displayName === "string" ? body.displayName.trim() : emailAddress,
          connectionConfig,
          status: "pending",
          capabilities,
        });
      }
      try {
        await repository.saveCredentials(account.id, "password", { username, password, host, port, imap_host: host, imap_port: port, smtp_host: smtpHost, smtp_port: smtpPort, tls: true }, masterKey);
      } catch (error) {
        await repository.updateStatus(account.id, "error", "Mailbox configuration was saved without credentials. Reconnect to finish setup.");
        throw error;
      }
      await recordAuditEvent({
        organizationId,
        actorUserId: subject.user.id,
        eventType: existing ? "email.account.reconnected" : "email.account.created",
        targetType: "email_account",
        targetId: account.id,
        action: existing ? "reconnect" : "connect",
        decision: "allowed",
        metadata: { provider: "imap_smtp", status: "pending_worker_verification" },
      });
      return NextResponse.json({ account }, { status: existing ? 200 : 201 });
    }

    if (!accountId) return NextResponse.json({ error: "validation_error", fieldErrors: { accountId: "Account is required." } }, { status: 422 });
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
