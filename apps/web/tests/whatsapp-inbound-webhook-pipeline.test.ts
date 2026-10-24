// Regression tests for the WhatsApp inbound webhook pipeline.
//
// Two production defects motivated these checks (found while testing the live
// deployment on 2026-10-24):
//
// 1. insertWhatsAppInboundMessage used parameter $3 both as a bare column
//    value and inside `CASE WHEN $3 IS NULL`. PostgreSQL cannot infer a type
//    from an IS NULL test, so the prepared statement failed with SQLSTATE
//    42P08 ("could not determine data type of parameter $3") and EVERY
//    inbound webhook message was lost with HTTP 500.
// 2. Meta delivers wa_id / messages[].from without the leading "+" while
//    outbound recipients are stored with it. Inbound contacts therefore never
//    matched the recipient in the 24-hour customer-service window checks.
// 3. A duplicate provider event short-circuited processing with `continue`,
//    so Meta retries could never heal a failure that happened after the event
//    row was already written.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/messaging/whatsapp-repository.ts"), "utf8");
const webhookRoute = readFileSync(resolve(__dirname, "../src/app/api/whatsapp/webhook/route.ts"), "utf8");

const insertInboundSource = () => repository.slice(
  repository.indexOf("export async function insertWhatsAppInboundMessage"),
  repository.indexOf("export async function claimRoutedWhatsAppInbound"),
);

describe("WhatsApp inbound webhook pipeline", () => {
  it("casts the shared agent_id parameter to uuid so the statement parses (42P08)", () => {
    const fn = insertInboundSource();
    expect(fn.length).toBeGreaterThan(0);
    // The bare column value and the CASE expression must both carry an
    // explicit uuid cast so PostgreSQL can resolve the parameter type.
    expect(fn).toMatch(/\$3::uuid,/);
    expect(fn).toMatch(/CASE WHEN \$3::uuid IS NULL/);
    expect(fn).not.toMatch(/CASE WHEN \$3 IS NULL/);
  });

  it("normalizes inbound phone numbers to E.164 with a leading plus", () => {
    expect(webhookRoute).toMatch(/function normalizeE164/);
    expect(webhookRoute).toMatch(/const from = normalizeE164\(/);
    // The contact display-name map must be keyed by the same normalized form
    // so contactMap.get(from) still resolves after normalization.
    expect(webhookRoute).toMatch(/normalizeE164\(String\(c\.wa_id \?\? ""\)\)/);
  });

  it("no longer skips message processing for duplicate provider events", () => {
    expect(webhookRoute).not.toMatch(/if \(!event\.inserted\) continue;/);
    // The event write remains for observability but its result is not used
    // as a processing gate.
    expect(webhookRoute).toMatch(/await recordWhatsAppWebhookEvent\(/);
    expect(webhookRoute).not.toMatch(/const event = await recordWhatsAppWebhookEvent\(/);
  });

  it("keeps the idempotent message insertion contract for Meta retries", () => {
    expect(insertInboundSource()).toMatch(/ON CONFLICT DO NOTHING RETURNING id/);
  });
});
