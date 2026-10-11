import test from "node:test";
import assert from "node:assert/strict";
import { automationMatches, stableEventKey } from "../src/automation/automation-engine";

test("matches trigger type and payload subset",()=>{
  assert.equal(automationMatches({trigger:{type:"email.received",match:{from:"boss@example.com"}},conditions:{}},{type:"email.received",payload:{from:"boss@example.com",subject:"Hello"}}),true);
});
test("rejects unrelated event types",()=>{
  assert.equal(automationMatches({trigger:{type:"email.received"},conditions:{}},{type:"whatsapp.received",payload:{}}),false);
});
test("rejects failed conditions",()=>{
  assert.equal(automationMatches({trigger:{type:"email.received"},conditions:{label:"urgent"}},{type:"email.received",payload:{label:"normal"}}),false);
});


test("builds a stable key from provider event identity",()=>{
  assert.equal(stableEventKey({type:"email.action.completed",payload:{actionId:"a-123"}}),"email.action.completed:a-123");
});

test("prefers message identity for inbound events",()=>{
  assert.equal(stableEventKey({type:"whatsapp.received",payload:{messageId:"m-123",correlationId:"c-1"}}),"whatsapp.received:m-123");
});

test("returns null when an event has no durable identity",()=>{
  assert.equal(stableEventKey({type:"scheduled.time",payload:{}}),null);
});
