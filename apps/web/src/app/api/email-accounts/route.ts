import { NextResponse } from "next/server";
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
