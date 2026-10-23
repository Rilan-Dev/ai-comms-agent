import { NextResponse } from "next/server";
import {
  createEmailAction,
  assertCurrentEmailActionAuthorization,
  ActionAuthorizationRevokedError,
  EmailActionIdempotencyConflictError,
  decideEmailAction,
  getEmailActionForOrganization,
  getMailMessageForOrganization,
  recordAuditEvent,
  query,
} from "@ai-comms-agent/db";
import { asOrganizationId } from "@ai-comms-agent/shared";
import { authorize, authorizationErrorToResponse } from "@/lib/identity/authorization";
import { ensureDevSeed, getIdentityAdapter, getIdentityRepository } from "@/lib/identity/repository";
import { assertSameOrigin } from "@/lib/identity/local-auth";
import { matchesManualComposeReview } from "@/lib/mail/manual-compose-review";
import { eligibleReplyForwardSourceId, isLocalEmailMessageId } from "@ai-comms-agent/email-agent-runtime/email-source-identity";

export const dynamic = "force-dynamic";

function validRecipients(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && /^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(item.trim())).map(item => item.trim().toLowerCase())
    : [];
}

export async function POST(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
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
      { organizationId: asOrganizationId(organizationId), permission: "email.write" },
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
      const to = validRecipients(draft.to_recipients);
      const cc = validRecipients(draft.cc_recipients);
      const bcc = validRecipients(draft.bcc_recipients);
      // Never silently drop persisted recipients from a human-reviewed action.
      if (to.length === 0 || to.length !== (Array.isArray(draft.to_recipients) ? draft.to_recipients.length : 0)
          || cc.length !== (Array.isArray(draft.cc_recipients) ? draft.cc_recipients.length : 0)
          || bcc.length !== (Array.isArray(draft.bcc_recipients) ? draft.bcc_recipients.length : 0)) {
        return NextResponse.json({
          error: "invalid_draft_recipients",
          message: "The saved draft contains missing or invalid recipients. Correct and resave it before requesting approval.",
        }, { status: 422 });
      }
      snapshot = {
        to,
        cc,
        bcc,
        subject: draft.subject ?? "",
        bodyText: draft.text_body ?? "",
      };
      // Manual review must refer to the exact stored draft, not the previous
      // autosaved version; other audited tool callers retain their contract.
      if (body?.expectedSnapshot !== undefined
          && !matchesManualComposeReview(snapshot, body.expectedSnapshot)) {
        return NextResponse.json({
          error: "draft_review_changed",
          message: "The saved draft changed since your review. Reload, review and save again before requesting approval.",
        }, { status: 409 });
      }
    } else {
      const messageId = typeof body?.messageId === "string" ? body.messageId : "";
      if (!isLocalEmailMessageId(messageId)) return NextResponse.json({
        error: "invalid_source_message", message: "Choose a synchronized message from this mailbox before requesting reply or forward approval.",
      }, { status: 422 });
      const message = await getMailMessageForOrganization(organizationId, messageId);
      if (!message || !eligibleReplyForwardSourceId(message, emailAccountId)) {
        // Worker requires the tenant-scoped LOCAL ID, backed by a genuine
        // provider message, rather than an unsynced draft/provider-only ID.
        return NextResponse.json({ error: "not_found", message: "A provider-backed source message was not found in this organization/mailbox." }, { status: 404 });
      }
      // A saved From header is untrusted provider data. For replies, validate
      // it exactly as a caller-specified forwarding recipient; never coerce
      // null/undefined into the literal "undefined" mailbox.
      const rawRecipients = actionType === "reply_email"
        ? [message.from_email ?? message.from_address]
        : body?.to;
      const rawCc = body?.cc ?? [];
      const rawBcc = body?.bcc ?? [];
      const to = validRecipients(rawRecipients);
      const cc = validRecipients(rawCc);
      const bcc = validRecipients(rawBcc);
      // Filtering invalid array members would silently change the content
      // presented for human approval. Reject the entire malformed request.
      if (!Array.isArray(rawRecipients) || to.length === 0 || to.length !== rawRecipients.length
          || !Array.isArray(rawCc) || cc.length !== rawCc.length
          || !Array.isArray(rawBcc) || bcc.length !== rawBcc.length) {
        return NextResponse.json({
          error: "invalid_action_recipients",
          message: "The reply or forward has missing or invalid recipients. Correct the address before requesting human approval.",
        }, { status: 422 });
      }
      snapshot = {
        messageId,
        to,
        cc,
        bcc,
        subject: typeof body?.subject === "string" ? body.subject : actionType === "reply_email" ? `Re: ${String(message.subject ?? "").replace(/^(re:\s*)+/i, "")}` : `Fwd: ${String(message.subject ?? "")}`,
        bodyText: typeof body?.bodyText === "string" ? body.bodyText : "",
      };
    }

    const headerKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    const bodyKey = typeof body?.idempotencyKey === "string" ? body.idempotencyKey.trim() : "";
    const idempotencyKey = (headerKey || bodyKey).slice(0, 200) || null;

    const action = await createEmailAction({
      organizationId,
      emailAccountId,
      actionType,
      draftId,
      recipientSnapshot: snapshot,
      requestedBy: subject.user.id,
      idempotencyKey,
      correlationId: crypto.randomUUID(),
    });

    try {
      await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: "email.action.requested", targetType: "email_action", targetId: String(action.id), action: String(actionType), decision: "pending_approval", correlationId: action.correlationId, metadata: { emailAccountId, draftId, idempotencyKey } });
    } catch (error) {
      // The committed request is the reconciliation source. A secondary
      // audit outage must not invite the user to create another request.
      console.error("[email-action] request audit needs reconciliation", { actionId: action.id, correlationId: action.correlationId, errorType: error instanceof Error ? error.name : typeof error });
    }
    return NextResponse.json({
      action,
      status: action.status,
      message: "The email action is pending human approval. No email has been sent.",
    }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailActionIdempotencyConflictError) {
      return NextResponse.json({ error: "email_action_conflict", message: error.message }, { status: 409 });
    }
    return authorizationErrorToResponse(error);
  }
}

export async function PATCH(request: Request) {
  try { assertSameOrigin(request); }
  catch { return NextResponse.json({ error: "invalid_origin" }, { status: 403 }); }
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
    if(decision==='approved'){
      const pending=await getEmailActionForOrganization(organizationId,actionId);
      if(!pending)return NextResponse.json({error:'not_found'},{status:404});
      try {await assertCurrentEmailActionAuthorization({...pending,approvedBy:subject.user.id});}
      catch(error) {if(!(error instanceof ActionAuthorizationRevokedError))throw error;return NextResponse.json({error:'action_authorization_revoked',message:'The requester, agent or mailbox permission changed. No send was approved.'},{status:409});}
    }
    const action = await decideEmailAction(organizationId, actionId, subject.user.id, decision, typeof body?.comment === "string" ? body.comment.slice(0, 1000) : null);
    if (!action) return NextResponse.json({ error: "conflict", message: "The action is no longer pending, has expired, or does not belong to this organization." }, { status: 409 });
    try {
      await recordAuditEvent({ organizationId, actorUserId: subject.user.id, eventType: `email.action.${decision}`, targetType: "email_action", targetId: actionId, action: decision, decision: "allowed", correlationId: action.correlationId, metadata: { comment: typeof body?.comment === "string" ? body.comment.slice(0, 1000) : null } });
    } catch (error) {
      console.error("[email-action] decision audit needs reconciliation", { actionId, correlationId: action.correlationId, errorType: error instanceof Error ? error.name : typeof error });
    }
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
    await authorize(request, { organizationId: asOrganizationId(organizationId), permission: "organization.update" }, getIdentityAdapter(), getIdentityRepository());
    const action = await getEmailActionForOrganization(organizationId, actionId);
    if(!action)return NextResponse.json({error:"not_found"},{status:404});
    const sender=await query<{email_address:string}>('SELECT email_address FROM email_accounts WHERE id=$1 AND organization_id=$2 AND deleted_at IS NULL',[action.emailAccountId,organizationId]);
    return NextResponse.json({action:{...action,senderAddress:sender.rows[0]?.email_address??null}},{headers:{'Cache-Control':'private, no-store'}});
  } catch (error) {
    return authorizationErrorToResponse(error);
  }
}
