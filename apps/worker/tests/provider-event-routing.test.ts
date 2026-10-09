import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const providerEvents = readFileSync(resolve(__dirname, "../src/events/provider-events.ts"), "utf8");
const emailWorker = readFileSync(resolve(__dirname, "../src/email/action-worker.ts"), "utf8");
const whatsappWorker = readFileSync(resolve(__dirname, "../src/messaging/whatsapp-worker.ts"), "utf8");

describe("provider event routing contract", () => {
  it("preserves deterministic identifiers for automation deduplication", () => {
    assert.equal(providerEvents.includes('actionId: "actionId" in event ? event.actionId : undefined'), true);
    assert.equal(providerEvents.includes('messageId: "messageId" in event ? event.messageId : event.metadata?.messageId'), true);
    assert.equal(providerEvents.includes("correlationId: event.correlationId ?? undefined"), true);
  });

  it("routes email worker success and failure outcomes", () => {
    assert.equal(emailWorker.includes('type: "email.action.completed"'), true);
    assert.equal(emailWorker.includes('type: "email.action.failed"'), true);
    assert.equal(emailWorker.includes("emitProviderEvent"), true);
  });

  it("routes WhatsApp worker success and failure outcomes", () => {
    assert.equal(whatsappWorker.includes('type: "whatsapp.message.sent"'), true);
    assert.equal(whatsappWorker.includes('type: "whatsapp.message.failed"'), true);
    assert.equal(whatsappWorker.includes("emitProviderEvent"), true);
  });
});
