import test from "node:test";
import assert from "node:assert/strict";
import {safeRecapAutomation,sourceSummaryFallback} from "../src/automation/source-summary-fallback";
const base={source:"automation",intent:"automation.execute",params:{event:{eventType:"whatsapp.received",eventId:"qa-event",accountId:"acc",body:"Please send a technician."},actions:[{type:"generate_summary"},{type:"create_work_item",kind:"service_ticket"}]}};
test("summary and work item workflows recover from transient model failure with honest source recap",()=>{
 assert.equal(safeRecapAutomation(base),true);
 assert.ok(sourceSummaryFallback(base,"provider_error")?.includes("NOT an AI-generated summary"));
});
test("drafts, WhatsApp sends and three-action chains cannot use a non-AI recap as generated content",()=>{
 for(const action of [{type:"create_draft"},{type:"send_whatsapp"},{type:"create_email_approval"}]){
  const input={...base,params:{...base.params,actions:[{type:"generate_summary"},action]}};
  assert.equal(sourceSummaryFallback(input,"empty"),null);
 }
 const three={...base,params:{...base.params,actions:[...base.params.actions,{type:"create_draft"}]}};
 assert.equal(safeRecapAutomation(three),false);
});
