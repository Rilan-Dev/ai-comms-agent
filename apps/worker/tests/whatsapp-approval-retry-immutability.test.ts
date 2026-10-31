import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const agent = readFileSync(new URL("../src/agent/whatsapp-tool-runtime.ts", import.meta.url), "utf8");
const manual = readFileSync(new URL("../../../apps/web/src/app/api/whatsapp/messages/route.ts", import.meta.url), "utf8");
const product = readFileSync(new URL("../src/agent/product-action-executor.ts", import.meta.url), "utf8");

test("all WhatsApp approval insertion paths atomically reuse only the original unexpired pending request", () => {
  for (const [surface, src] of [["agent", agent], ["manual", manual], ["product", product]]) {
    const block = src.slice(src.indexOf("INSERT INTO whatsapp_send_actions"));
    assert.ok(block.length > 100, surface + " must persist human approval");
    assert.match(block, /ON CONFLICT \(organization_id,\s*idempotency_key\) WHERE idempotency_key IS NOT NULL/i);
    assert.match(block, /DO UPDATE SET idempotency_key = EXCLUDED\.idempotency_key/);
    assert.match(block, /whatsapp_send_actions\.status = 'pending'/);
    assert.match(block, /whatsapp_send_actions\.expires_at > now\(\)/);
    assert.match(block, /whatsapp_send_actions\.requested_by IS NOT DISTINCT FROM EXCLUDED\.requested_by/);
    assert.match(block, /whatsapp_send_actions\.agent_id IS NOT DISTINCT FROM EXCLUDED\.agent_id/);
    for (const field of ["whatsapp_account_id", "recipient_phone", "message_body", "payload_type", "template_name", "template_language", "template_parameters"]) {
      assert.match(block, new RegExp("whatsapp_send_actions\\." + field + " IS NOT DISTINCT FROM EXCLUDED\\." + field));
    }
    assert.match(block, /RETURNING id,\s*status/);
    assert.doesNotMatch(block, /DO NOTHING RETURNING/);
    assert.doesNotMatch(block, /SELECT id,status,whatsapp_account_id,recipient_phone,message_body/);
  }
});

test("manual route returns HTTP 409 on an already-decided, expired, different-actor or payload collision", () => {
  assert.match(manual, /if \(!actionId\) return NextResponse\.json\(\{\s*error: "idempotency_conflict"/);
  assert.match(manual, /status: 409/);
  assert.match(manual, /status: "pending", correlationId/);
  assert.doesNotMatch(manual, /This WhatsApp message is awaiting or has already received an approval decision/);
});

test("agent and scheduled product actions never audit a terminal duplicate as a new approval", () => {
  assert.match(agent, /if \(!action\) \{/);
  assert.match(agent, /return fail\("idempotency_conflict"/);
  // The conflict diagnostic may look up only the existing action's status —
  // never the full row (no reuse of a decided approval).
  assert.match(agent, /SELECT status FROM whatsapp_send_actions WHERE organization_id=\$1 AND idempotency_key=\$2 LIMIT 1/);
  assert.match(product, /if \(!approval\) \{/);
  assert.match(product, /WhatsApp approval idempotency conflict/);
  assert.match(agent, /decision: "pending"/);
  assert.match(product, /decision: "pending_approval"/);
  assert.doesNotMatch(agent, /SELECT id,status,whatsapp_account_id,recipient_phone,message_body/);
  assert.doesNotMatch(product, /SELECT id,status,whatsapp_account_id,recipient_phone,message_body/);
});
