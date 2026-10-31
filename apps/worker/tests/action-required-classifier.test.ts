import test from "node:test";
import assert from "node:assert/strict";
import {isLikelyActionRequiredEmail as actionable} from "../src/email/action-required-classifier";
const base={subject:"Project update",snippet:"FYI: Notes from today's meeting.",body:"",from:"Project Manager <sender@example.com>",to:["Me <myself@example.com>"],accountEmail:"myself@example.com",isDraft:false,isOutbound:false};
test("identifies direct approval and response requests from an inbox message",()=>{
 assert.equal(actionable({...base,subject:"Action Required: Please approve the invoice"}),true);
 assert.equal(actionable({...base,subject:"Re: Contract",snippet:"Could you review the agreement by Friday?"}),true);
 assert.equal(actionable({...base,subject:"FYI",snippet:"Please respond to the request with your decision."}),true);
});
test("does not over-classify generic updates, bulk messages, no-reply or missing recipients",()=>{
 assert.equal(actionable(base),false);
 assert.equal(actionable({...base,subject:"Daily digest: Please approve something"}),false);
 assert.equal(actionable({...base,from:"No Reply <no-reply@example.com>",subject:"Action required"}),false);
 assert.equal(actionable({...base,to:["other@example.com"],subject:"Action Required"}),false);
 assert.equal(actionable({...base,isDraft:true,subject:"Approval required"}),false);
 assert.equal(actionable({...base,isOutbound:true,subject:"Approval required"}),false);
 assert.equal(actionable({...base,from:"myself@example.com",subject:"Approval required"}),false);
});
