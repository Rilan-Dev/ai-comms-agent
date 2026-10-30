import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {automationMatches,stableEventKey} from "../src/automation/automation-engine";
const read=(p:string)=>readFileSync(new URL(p,import.meta.url),"utf8");
test("provider sync outbox is durable, deduplicated and gated by rule creation",()=>{
 const s=read("../src/automation/event-outbox-worker.ts");
 for(const required of [
  "m.is_draft=false","m.is_sent=false","m.created_at>=now()","m.received_at>=now()",
  "s.last_success_at IS NOT NULL","s.sync_mode='incremental'",
  "a.created_at<=m.created_at",
  "ON CONFLICT(organization_id,event_type,source_key) DO NOTHING",
  "FOR UPDATE SKIP LOCKED","attempts>=3","Matching automation execution failed",
 ])assert.ok(s.includes(required),"Missing outbox guard: "+required);
});
test("WhatsApp outbox only processes inbound signed webhook rows, not outbound messages",()=>{
 const s=read("../src/automation/event-outbox-worker.ts");
 assert.ok(s.includes("m.direction='inbound'"));
 assert.ok(s.includes("m.provider_message_id IS NOT NULL"));
 assert.ok(s.includes("whatsapp.received"));
 assert.ok(s.includes("split_part(m.provider_message_id,':',1)"));
});
test("slow AI execution cannot stop provider ingestion or unbounded parallel dispatch",()=>{
 const s=read("../src/automation/event-outbox-worker.ts");
 assert.ok(s.includes("await scanProviderEvents();"),"Provider scan must run before AI execution capacity check");
 assert.ok(s.includes("MAX_CONCURRENT_EXECUTIONS=2"),"Bound concurrent dispatch");
 assert.ok(s.includes("activeExecutions>=MAX_CONCURRENT_EXECUTIONS"),"Respect max active capacity");
 assert.ok(s.includes("[Math.min(limit,1)]"),"Each worker claims at most one outbox row");
 assert.ok(s.includes("FOR UPDATE SKIP LOCKED"),"Concurrent rows claimed safely");
});
test("inbound agent reply completion does not create duplicate event automation",()=>{
 const s=read("../src/messaging/whatsapp-inbound-worker.ts");
 assert.ok(!s.includes("evaluateAutomationEvent("));
});
test("summary and draft action types are executed, unsupported actions fail closed",()=>{
 const s=read("../src/agent/product-action-executor.ts");
 assert.ok(s.includes('type==="generate_summary"'));
 assert.ok(s.includes('type==="create_draft"'));
 assert.ok(s.includes("await createLocalDraft"));
 assert.ok(s.includes("email.draft.create"));
 assert.ok(s.includes("Agent draft tool is disabled"));
 assert.ok(s.includes("configuration_required"));
});
test("synthetic event matches scoped rule once and rejects other organizations",()=>{
 const rule={organizationId:"11111111-1111-4111-8111-111111111111",trigger:{event:"email.received",match:{qaToken:"smoke-A"}},conditions:{}};
 const e={organizationId:rule.organizationId,type:"email.received",payload:{messageId:"test-1",qaToken:"smoke-A"}};
 assert.equal(automationMatches(rule,e),true);
 assert.equal(automationMatches(rule,{...e,payload:{messageId:"test-1",qaToken:"other"}}),false);
 assert.equal(automationMatches(rule,{...e,organizationId:"22222222-2222-4222-8222-222222222222"}),false);
 assert.equal(stableEventKey(e),"email.received:test-1");
});
