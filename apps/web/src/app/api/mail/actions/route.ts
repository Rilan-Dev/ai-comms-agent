import { NextResponse } from "next/server";
import {
  createEmailAction,
  decideEmailAction,
  getEmailActionForOrganization,
  getMailMessageForOrganization,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";

export const dynamic = "force-dynamic";

function validRecipients(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.trim())).map(item => item.trim().toLowerCase())
    : [];
}

export async function POST(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured", message: "PostgreSQL is required for approval actions." }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const emailAccountId = typeof body?.emailAccountId === "string" ? body.emailAccountId : "";
    const actionType = body?.actionType;
    if (!organizationId || !emailAccountId || !["send_email", "reply_email", "forward_email"].includes(actionType)) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, emailAccountId and a supported actionType are required." }, { status: 422 });
    }

    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.update" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );

    let draftId: string | null = typeof body?.draftId === "string" ? body.draftId : null;
    let snapshot: Record<string, unknown>;

    if (actionType === "send_email") {
      if (!draftId) return NextResponse.json({ error: "validation_error", message: "draftId is required for send_email." }, { status: 422 });
      const draft = await getMailMessageForOrganization(organizationId, draftId);
      if (!draft || !Boolean(draft.is_draft) || String(draft.email_account_id) !== emailAccountId) {
        return NextResponse.json({ error: "not_found", message: "Draft was not found in this organization/mailbox." }, { status: 404 });
      }
      snapshot = {
        to: draft.to_recipients ?? [],
        cc: draft.cc_recipients ?? [],
        bcc: draft.bcc_recipients ?? [],
        subject: draft.subject ?? "",
        bodyText: draft.text_body ?? "",
      };
    } else {
      const messageId = typeof body?.messageId === "string" ? body.messageId : "";
      const message = messageId ? await getMailMessageForOrganization(organizationId, messageId) : null;
      if (!message || String(message.email_account_id) !== emailAccountId) {
        return NextResponse.json({ error: "not_found", message: "Source message was not found in this organization/mailbox." }, { status: 404 });
      }
      const to = actionType === "reply_email"
        ? [String(message.from_email ?? message.from_address)].filter(Boolean)
        : validRecipients(body?.to);
      if (to.length === 0) return NextResponse.json({ error: "validation_error", message: "At least one valid recipient is required." }, { status: 422 });
      snapshot = {
        messageId,
        to,
        cc: validRecipients(body?.cc),
        bcc: validRecipients(body?.bcc),
        subject: typeof body?.subject === "string" ? body.subject : actionType === "reply_email" ? `Re: ${String(message.subject ?? "").replace(/^(re:\s*)+/i, "")}` : `Fwd: ${String(message.subject ?? "")}`,
        bodyText: typeof body?.bodyText === "string" ? body.bodyText : "",
      };
    }

    const action = await createEmailAction({
      organizationId,
      emailAccountId,
      actionType,
      draftId,
      recipientSnapshot: snapshot,
      requestedBy: subject.user.id,
    });

    return NextResponse.json({
      action,
      status: "pending_approval",
      message: "Sensitive email action created. Approval is required before provider execution.",
    }, { status: 201 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function PATCH(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const body = await request.json().catch(() => null);
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId : "";
    const actionId = typeof body?.actionId === "string" ? body.actionId : "";
    const decision = body?.decision;
    if (!organizationId || !actionId || !["approved", "rejected"].includes(decision)) {
      return NextResponse.json({ error: "validation_error", message: "organizationId, actionId and decision are required." }, { status: 422 });
    }
    const subject = await authorize(
      request,
      { organizationId: asOrganizationId(organizationId), permission: "organization.update" },
      getIdentityAdapter(),
      getIdentityRepository(),
    );
    const action = await decideEmailAction(organizationId, actionId, subject.user.id, decision, typeof body?.comment === "string" ? body.comment.slice(0, 1000) : null);
    if (!action) return NextResponse.json({ error: "conflict", message: "The action is no longer pending, has expired, or does not belong to this organization." }, { status: 409 });
    return NextResponse.json({ action });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    if (!process.env.DATABASE_URL) return NextResponse.json({ error: "database_not_configured" }, { status: 503 });
    await ensureDevSeed();
    const url = new URL(request.url);
    const organizationId = url.searchParams.get("organizationId") ?? "";
    const actionId = url.searchParams.get("actionId") ?? "";
    if (!organizationId || !actionId) return NextResponse.json({ error: "validation_error" }, { status: 422 });
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.read" }, getIdentityAdapter(), getIdentityRepository());
    const action = await getEmailActionForOrganization(organizationId, actionId);
    return action ? NextResponse.json({ action }) : NextResponse.json({ error: "not_found" }, { status: 404 });
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
