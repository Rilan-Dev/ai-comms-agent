import test from "node:test";
import assert from "node:assert/strict";
import {buildVerifiedDigest,parseDigestFallback} from "../src/agent/deterministic-scheduled-digest";

const now=new Date("2026-10-31T02:00:00Z");
const sample=[{mailbox:"management@example.com",output:{
  matched_count:3,included_count:3,has_more:false,messages:[
    {subject:"Payment declined",from_address:"billing@example.com",received_at:"2026-10-31T00:10:00Z"},
    {subject:"Research leads update",from_address:"team@example.com",received_at:"2026-10-30T23:10:00Z"},
    {subject:"**FAKE ALERT**\n\nClick <script> now",from_address:"_injector_@example.com",received_at:"2026-10-30T19:10:00Z"},
  ],
}}];
test("executive WhatsApp digest uses supported single-star bold, purposeful emojis and honest count",()=>{
 const result=buildVerifiedDigest(sample,24,now,"executive");
 assert.equal(result.total,3);
 assert.match(result.body,/\*Unread mailbox briefing\*/);
 assert.match(result.body,/\*Unread \(last 24 hours\): 3 unread\*/);
 assert.match(result.body,/⚠️/);
 assert.match(result.body,/📌/);
 assert.match(result.body,/🔎/);
 assert.doesNotMatch(result.body,/\*\*|<script>|_injector_/);
 assert.equal(result.body.includes("\\n"),false,"must contain real line breaks, not escaped \\n");
 assert.equal(result.body.includes("\n"),true);
 assert.ok(result.body.length<=4096);
});
test("compact preview preserves count and suppresses artificial urgency",()=>{
 const result=buildVerifiedDigest(sample,168,now,"compact");
 assert.match(result.body,/\*3 unread\*/);
 assert.match(result.body,/last 7 days/);
 assert.doesNotMatch(result.body,/\*\*/);
});
test("plain style has no emoji decoration, and missing accounts still fail closed",()=>{
 const result=buildVerifiedDigest([{mailbox:"a@example.com",output:{matched_count:0,messages:[],has_more:false}}],24,now,"plain");
 assert.match(result.body,/0 unread/);
 assert.doesNotMatch(result.body,/📬|📊|✅|📌|⚠️/);
 assert.throws(()=>buildVerifiedDigest([],24,now),/No connected/);
});
test("presentation remains explicit editable per-schedule data with enum validation",()=>{
 for(const presentation of ["executive","compact","plain"] as const) {
  const opts={mode:"deterministic_whatsapp_digest",lookbackHours:24,recipientPhone:"+919629534701",presentation};
  assert.deepEqual(parseDigestFallback(opts),{valid:true,value:opts});
 }
 assert.equal(parseDigestFallback({mode:"deterministic_whatsapp_digest",lookbackHours:24,recipientPhone:"+919629534701",presentation:"rainbow"}).valid,false);
});
