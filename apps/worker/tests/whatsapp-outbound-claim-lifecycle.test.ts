import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    assert.equal(repository.includes("export async function claimQueuedWhatsAppOutbound"), true);
    assert.equal(repository.includes("FOR UPDATE SKIP LOCKED"), true);
    assert.equal(repository.includes("SET status = 'executing'"), true);
  });

  it("only completes or fails a message owned by the current execution claim", () => {
    assert.equal(repository.includes("status = 'executing' RETURNING id"), true);
    assert.equal(worker.includes("claimQueuedWhatsAppOutbound(limit)"), true);
  });

  it("fails abandoned sends closed instead of making them eligible for replay", () => {
    assert.equal(repository.includes("recoverStaleWhatsAppOutbound"), true);
    assert.equal(repository.includes("provider outcome is unknown. Manual verification required."), true);
    assert.equal(worker.includes("whatsapp.message.execution_interrupted"), true);
    assert.equal(worker.includes("manualVerificationRequired: true"), true);
    assert.equal(worker.includes("persistenceConflict: true"), true);
    assert.equal(worker.includes("providerAccepted: true"), true);
  });

  it("allows the executing state in the forward-only schema migration", () => {
    assert.equal(migration.includes("'queued','executing','sent'"), true);
    assert.equal(migration.includes("whatsapp_messages_outbound_claim_idx"), true);
  });
});
