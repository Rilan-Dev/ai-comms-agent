import test from "node:test";
import assert from "node:assert/strict";
import {executeProductActions} from "../src/agent/product-action-executor";
test("sequential business actions fail stop: empty summary never creates a lead",async()=>{
 const results=await executeProductActions({
   organizationId:"11111111-1111-4111-8111-111111111111",
   agentId:"22222222-2222-4222-8222-222222222222",
   executionId:"33333333-3333-4333-8333-333333333333",
   source:"automation",output:""
 },{actions:[{type:"generate_summary"},{type:"create_work_item",kind:"opportunity",priority:"high"}],
    event:{eventType:"email.received",eventId:"qa-unsafe",subject:"Customer asks for a quotation"}});
 assert.equal(results.length,1);
 assert.equal(results[0]?.type,"generate_summary");
 assert.equal(results[0]?.status,"configuration_required");
});
