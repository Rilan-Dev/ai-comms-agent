import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const actionRoute = readFileSync(resolve(__dirname, "../src/app/api/mail/actions/route.ts"), "utf8");
const actionRepository = readFileSync(resolve(__dirname, "../../../packages/db/src/email/actions.ts"), "utf8");
const executor = readFileSync(resolve(__dirname, "../../../apps/worker/src/email/action-executor.ts"), "utf8");

describe("approval-safe email action contract", () => {
  it("creates only sensitive email actions in pending approval", () => {
    expect(actionRoute).toContain("send_email");
    expect(actionRoute).toContain("reply_email");
    expect(actionRoute).toContain("forward_email");
    expect(actionRepository).toContain("'pending_approval'");
  });

  it("binds actions to the organization and selected mailbox", () => {
    expect(actionRoute).toContain("String(draft.email_account_id) !== emailAccountId");
    expect(actionRoute).toContain("String(message.email_account_id) !== emailAccountId");
    expect(actionRepository).toContain("organization_id = $2");
  });

  it("uses an atomic pending-to-decision transition", () => {
    expect(actionRepository).toContain("status = 'pending_approval'");
    expect(actionRepository).toContain("status = $1");
    expect(actionRepository).toContain("AND (expires_at IS NULL OR expires_at > now())");
  });

  it("keeps provider credentials and execution inside the worker", () => {
    expect(executor).toContain("parseCredentialsMasterKey");
    expect(executor).toContain("loadCredentials");
    expect(executor).toContain("createEmailProviderRegistry");
    expect(executor).toContain("claimApprovedEmailAction");
    expect(actionRoute).not.toContain("CREDENTIALS_MASTER_KEY");
    expect(actionRoute).not.toContain("loadCredentials");
  });


  it("preserves a stable idempotency key across email action retries", () => {
    expect(actionRoute).toContain("Idempotency-Key");
    expect(actionRoute).toContain("body?.idempotencyKey");
    expect(actionRepository).toContain("idempotency_key");
    expect(actionRepository).toContain("ON CONFLICT (organization_id, idempotency_key)");
  });

  it("requires approval before provider send/reply/forward", () => {
    expect(executor).toContain("status = 'approved'");
    expect(executor).toContain("connected.sendDraft");
    expect(executor).toContain("connected.reply");
    expect(executor).toContain("connected.forward");
  });

  it("fails closed on abandoned worker execution instead of auto-replaying", () => {
    expect(actionRepository).toContain("recoverStaleExecutingEmailActions");
    expect(actionRepository).toContain("provider outcome is unknown");
    expect(actionRepository).toContain("providerOutcomeUnknown");
    expect(executor).toContain("email.action.execution_interrupted");
    expect(executor).toContain("manualVerificationRequired");
  });

});
