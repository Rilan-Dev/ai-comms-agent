import test from "node:test";
import assert from "node:assert/strict";
import {buildBusinessRuleActions} from "../src/lib/automations/business-actions";
test("business presets produce bounded ordered safe action chains",()=>{
 const base={action:"opportunity_draft" as const,priority:"high" as const,assigneeId:"",whatsappTo:""};
 assert.deepEqual(buildBusinessRuleActions(base),[
  {type:"generate_summary"},
  {type:"create_work_item",kind:"opportunity",priority:"high"},
  {type:"create_draft"}]);
 assert.deepEqual(buildBusinessRuleActions({...base,action:"service_ticket"}).map(x=>x.type),["generate_summary","create_work_item"]);
});
test("WhatsApp send retains explicit recipient and separate approval action",()=>{
 assert.deepEqual(buildBusinessRuleActions({action:"send_whatsapp",priority:"normal",assigneeId:"",whatsappTo:" +919629534701 "}),
  [{type:"send_whatsapp",to:"+919629534701"}]);
});
