import assert from "node:assert/strict";
import test from "node:test";
import { emitProviderEventWith, providerEventToAutomationEvent } from "../src/events/provider-events";

test("provider event mapping preserves organization and correlation identity", () => {
  const mapped = providerEventToAutomationEvent({
    type: "email.action.failed",
    organizationId: "org-1",
    actionId: "action-1",
    actionType: "send_email",
    emailAccountId: "account-1",
    correlationId: "corr-1",
    metadata: { retryAttempts: 5, retryable: true, error: "temporary outage" },
  });

  assert.deepEqual(mapped, {
    type: "email.action.failed",
    organizationId: "org-1",
    payload: {
      organizationId: "org-1",
      actionId: "action-1",
      messageId: undefined,
      accountId: undefined,
      emailAccountId: "account-1",
      correlationId: "corr-1",
      retryAttempts: 5,
      retryable: true,
      error: "temporary outage",
    },
  });
});

test("WhatsApp provider event mapping preserves message identity and outcome metadata", () => {
  const mapped = providerEventToAutomationEvent({
    type: "whatsapp.message.failed",
    organizationId: "org-2",
    messageId: "message-2",
    accountId: "wa-2",
    correlationId: "corr-2",
    metadata: { retryAttempts: 3, retryable: false },
  });

  assert.equal(mapped.type, "whatsapp.message.failed");
  assert.equal(mapped.organizationId, "org-2");
  assert.equal(mapped.payload.organizationId, "org-2");
  assert.equal(mapped.payload.messageId, "message-2");
  assert.equal(mapped.payload.accountId, "wa-2");
  assert.equal(mapped.payload.correlationId, "corr-2");
  assert.equal(mapped.payload.retryAttempts, 3);
  assert.equal(mapped.payload.retryable, false);
});


test("automation bridge failure cannot convert a provider success into a provider failure", async () => {
  const result = await emitProviderEventWith(
    {
      type: "whatsapp.message.sent",
      organizationId: "org-1",
      messageId: "message-1",
      accountId: "wa-1",
      correlationId: "corr-1",
    },
    async () => { throw new Error("automation database unavailable"); },
  );

  assert.equal(result.deliveredToAutomation, false);
  assert.equal(result.result, null);
  assert.equal(result.error, "automation database unavailable");
});


test("provider metadata cannot override canonical routing or correlation identity", () => {
  const mapped = providerEventToAutomationEvent({
    type: "email.action.completed",
    organizationId: "org-canonical",
    actionId: "action-canonical",
    actionType: "send_email",
    emailAccountId: "account-canonical",
    correlationId: "corr-canonical",
    metadata: {
      organizationId: "org-attacker",
      actionId: "action-attacker",
      emailAccountId: "account-attacker",
      correlationId: "corr-attacker",
      messageId: "message-attacker",
      retryAttempts: 2,
    },
  });

  assert.equal(mapped.organizationId, "org-canonical");
  assert.equal(mapped.payload.organizationId, "org-canonical");
  assert.equal(mapped.payload.actionId, "action-canonical");
  assert.equal(mapped.payload.emailAccountId, "account-canonical");
  assert.equal(mapped.payload.correlationId, "corr-canonical");
  assert.equal(mapped.payload.messageId, "message-attacker");
  assert.equal(mapped.payload.retryAttempts, 2);
});
