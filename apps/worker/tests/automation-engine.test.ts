import test from "node:test";
import assert from "node:assert/strict";
import { automationMatches } from "../src/automation/automation-engine";

test("matches trigger type and payload subset",()=>{
  assert.equal(automationMatches({trigger:{type:"email.received",match:{from:"boss@example.com"}},conditions:{}},{type:"email.received",payload:{from:"boss@example.com",subject:"Hello"}}),true);
});
test("rejects unrelated event types",()=>{
  assert.equal(automationMatches({trigger:{type:"email.received"},conditions:{}},{type:"whatsapp.received",payload:{}}),false);
});
test("rejects failed conditions",()=>{
  assert.equal(automationMatches({trigger:{type:"email.received"},conditions:{label:"urgent"}},{type:"email.received",payload:{label:"normal"}}),false);
});
