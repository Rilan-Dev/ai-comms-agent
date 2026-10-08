import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(
  resolve(__dirname, "../../../packages/db/src/messaging/whatsapp-repository.ts"),
  "utf8",
);
const worker = readFileSync(
  resolve(__dirname, "../src/messaging/whatsapp-worker.ts"),
  "utf8",
);
const migration = readFileSync(
  resolve(__dirname, "../../../supabase/migrations/0025_whatsapp_outbound_claim_lifecycle.sql"),
  "utf8",
);

describe("WhatsApp outbound claim lifecycle", () => {
  it("atomically claims queued messages with SKIP LOCKED", () => {
    expect(repository).toContain("export async function claimQueuedWhatsAppOutbound");
    expect(repository).toContain("FOR UPDATE SKIP LOCKED");
    expect(repository).toContain("SET status = 'executing'");
  });

  it("only completes or fails a message owned by the current execution claim", () => {
    expect(repository).toContain("status = 'executing' RETURNING id");
    expect(worker).toContain("claimQueuedWhatsAppOutbound(limit)");
  });

  it("fails abandoned sends closed instead of making them eligible for replay", () => {
    expect(repository).toContain("recoverStaleWhatsAppOutbound");
    expect(repository).toContain("provider outcome is unknown. Manual verification required.");
    expect(worker).toContain("whatsapp.message.execution_interrupted");
    expect(worker).toContain("manualVerificationRequired: true");
    expect(worker).toContain("persistenceConflict: true");
    expect(worker).toContain("providerAccepted: true");
  });

  it("allows the executing state in the forward-only schema migration", () => {
    expect(migration).toContain("'queued','executing','sent'");
    expect(migration).toContain("whatsapp_messages_outbound_claim_idx");
  });
});
