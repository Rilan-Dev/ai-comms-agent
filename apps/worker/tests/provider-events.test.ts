import assert from "node:assert/strict";
import test from "node:test";
import { providerEventToAutomationEvent } from "../src/events/provider-events";

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
  assert.equal(mapped.payload.organizationId, "org-2");
  assert.equal(mapped.payload.messageId, "message-2");
  assert.equal(mapped.payload.accountId, "wa-2");
  assert.equal(mapped.payload.correlationId, "corr-2");
  assert.equal(mapped.payload.retryAttempts, 3);
  assert.equal(mapped.payload.retryable, false);
});
