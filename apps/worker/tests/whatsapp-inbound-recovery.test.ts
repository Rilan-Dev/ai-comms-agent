import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/messaging/whatsapp-repository.ts"), "utf8");
const worker = readFileSync(resolve(__dirname, "../src/messaging/whatsapp-inbound-worker.ts"), "utf8");

test("WhatsApp inbound abandoned execution fails closed", () => {
  assert.match(repository, /recoverStaleWhatsAppInbound/);
  assert.match(repository, /processing_status = 'processing'/);
  assert.match(repository, /downstream execution outcome is unknown/);
  assert.match(worker, /whatsapp\.inbound\.execution_interrupted/);
  assert.match(worker, /manualVerificationRequired/);
});
