import test from "node:test";
import assert from "node:assert/strict";
import {parseDigestFallback,isEligibleDigestProviderFailure,buildVerifiedDigest} from "../src/agent/deterministic-scheduled-digest";

const opt={mode:"deterministic_whatsapp_digest",lookbackHours:24,recipientPhone:"+919629534701"};
test("fallback is opt-in, validated and bound to a supplied E.164 recipient",()=>{
 assert.deepEqual(parseDigestFallback(undefined),{valid:true,value:null});
 assert.deepEqual(parseDigestFallback(opt),{valid:true,value:opt});
 for(const bad of [null,{},[],{...opt,mode:"sarvam_switch"},{...opt,lookbackHours:0},
    {...opt,lookbackHours:1000},{...opt,recipientPhone:"9629534701"},
    {...opt,extra:"grant"},{...opt,recipientPhone:"+000000000"}]){
   assert.equal(parseDigestFallback(bad).valid,false,JSON.stringify(bad));
 }
});
test("fallback triggers only temporary capacity/quota errors and explicit model deadline",()=>{
 for(const msg of ["Gemini tool request failed (429): quota","Gemini tool request failed (503): high demand",
   "Sarvam tool request failed (502)","The AI provider did not complete a tool response before the deadline."]){
   assert.equal(isEligibleDigestProviderFailure(new Error(msg)),true,msg);
 }
 for(const msg of ["Gemini tool request failed (400): wrong signature","Sarvam tool request failed (400): content_filter",
   "Gemini tool request failed (401)","Gemini tool request failed (403)","TypeError: fetch failed","Invalid mail payload"]){
   assert.equal(isEligibleDigestProviderFailure(new Error(msg)),false,msg);
 }
});
const now=new Date("2026-10-31T00:00:00Z");
test("digest uses only actual unread search data and collapses matching subjects",()=>{
 const result=buildVerifiedDigest([{mailbox:"bound@example.com",output:{
  matched_count:4,included_count:4,has_more:false,messages:[
   {subject:"Hospital lead research complete",from_address:"alerts@example.com",received_at:"2026-10-30T12:00:00Z"},
   {subject:"Hospital lead research complete",from_address:"alerts@example.com",received_at:"2026-10-30T11:00:00Z"},
   {subject:"Deployment failed",from_address:"ci@example.com",received_at:"2026-10-30T10:00:00Z"},
   {subject:"Your OTP 123456",from_address:"security@example.com",received_at:"2026-10-30T09:00:00Z"},
  ]}}],24,now);
 assert.equal(result.total,4);
 assert.equal(result.highlights.length,2);
 assert.match(result.body,/4 unread/);
 assert.match(result.body,/Deployment failed/);
 assert.match(result.body,/Hospital lead research/);
 assert.doesNotMatch(result.body,/OTP|123456/);
 assert.equal(result.coverageLimited,false);
});
test("zero matches and truncated pagination are honestly represented",()=>{
 const empty=buildVerifiedDigest([{mailbox:"x@example.com",output:{matched_count:0,has_more:false,messages:[]}}],24,now);
 assert.equal(empty.total,0);
 assert.match(empty.body,/No unread subject highlights/);
 const limited=buildVerifiedDigest([{mailbox:"x@example.com",output:{matched_count:101,has_more:true,messages:[{subject:"Action required"}]}}],168,now);
 assert.equal(limited.total,101);
 assert.equal(limited.coverageLimited,true);
 assert.match(limited.body,/only a page/);
});
test("invalid or unverifiable counts never result in a composed send",()=>{
 for(const output of [{matched_count:null,messages:[]},{matched_count:-1,messages:[]},{matched_count:2,messages:null}]){
  assert.throws(()=>buildVerifiedDigest([{mailbox:"x@example.com",output}],24,now),/verifiable/);
 }
 assert.throws(()=>buildVerifiedDigest([],24,now),/No connected/);
});
