import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const providerEvents = readFileSync(resolve(__dirname, "../src/events/provider-events.ts"), "utf8");
const emailWorker = readFileSync(resolve(__dirname, "../src/email/action-worker.ts"), "utf8");
const whatsappWorker = readFileSync(resolve(__dirname, "../src/messaging/whatsapp-worker.ts"), "utf8");

describe("provider event routing contract", () => {
  it("preserves deterministic identifiers for automation deduplication", () => {
    expect(providerEvents).toContain('actionId: "actionId" in event ? event.actionId : undefined');
    expect(providerEvents).toContain('messageId: "messageId" in event ? event.messageId : undefined');
    expect(providerEvents).toContain("correlationId: event.correlationId ?? undefined");
  });

  it("routes email worker success and failure outcomes", () => {
    expect(emailWorker).toContain('type: "email.action.completed"');
    expect(emailWorker).toContain('type: "email.action.failed"');
    expect(emailWorker).toContain("emitProviderEvent");
  });

  it("routes WhatsApp worker success and failure outcomes", () => {
    expect(whatsappWorker).toContain('type: "whatsapp.message.sent"');
    expect(whatsappWorker).toContain('type: "whatsapp.message.failed"');
    expect(whatsappWorker).toContain("emitProviderEvent");
  });
});
