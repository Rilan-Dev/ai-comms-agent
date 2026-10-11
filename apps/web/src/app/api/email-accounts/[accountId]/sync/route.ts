import { NextResponse } from "next/server";
import { PostgresEmailAccountRepository, query } from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> },
) {
  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for mailbox synchronization." }, { status: 503 });
    }
    const body = await request.json().catch(() => null) as { organizationId?: unknown } | null;
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const { accountId } = await context.params;
    if (!organizationId || !accountId) {
      return NextResponse.json({ error: "validation_error", message: "Organization and mailbox are required." }, { status: 422 });
    }
    await authorize(request, { organizationId: asOrganizationId(organizationId), role: "admin" }, getIdentityAdapter(), getIdentityRepository());
    const accounts = new PostgresEmailAccountRepository();
    const account = await accounts.getById(accountId);
    if (!account || account.organization_id !== organizationId) {
      return NextResponse.json({ error: "not_found", message: "Mailbox was not found in this organization." }, { status: 404 });
    }
    if (account.provider !== "gmail" && account.provider !== "zoho" && account.provider !== "imap_smtp") {
      return NextResponse.json({ error: "unsupported_provider", message: "Manual sync is available for Gmail, Zoho, and IMAP/SMTP mailboxes." }, { status: 409 });
    }
    if (account.status === "revoked" || account.status === "disconnected") {
      return NextResponse.json({ error: "reconnect_required", message: "Reconnect this mailbox before synchronizing." }, { status: 409 });
    }

    await query(
      `INSERT INTO email_sync_states
        (email_account_id, organization_id, status, last_attempt_at, next_attempt_at, updated_at)
       VALUES ($1,$2,'idle',NULL,NULL,now())
       ON CONFLICT (email_account_id) DO UPDATE SET
         status=CASE WHEN email_sync_states.status='running' THEN 'running'::email_sync_status ELSE 'idle'::email_sync_status END,
         last_attempt_at=CASE WHEN email_sync_states.status='running' THEN email_sync_states.last_attempt_at ELSE NULL END,
         next_attempt_at=NULL, last_error=NULL, updated_at=now()`,
      [account.id, organizationId],
    );
    return NextResponse.json({ ok: true, queued: true, status: "queued", message: "Mailbox sync queued. The worker will process it automatically." }, { status: 202 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
