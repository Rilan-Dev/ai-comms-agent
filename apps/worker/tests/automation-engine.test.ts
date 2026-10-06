import { describe, expect, it } from "vitest";
import { automationMatches } from "../src/automation/automation-engine";

describe("automation trigger evaluator",()=>{
  it("matches trigger type and payload subset",()=>{
    expect(automationMatches({trigger:{type:"email.received",match:{from:"boss@example.com"}},conditions:{}},{type:"email.received",payload:{from:"boss@example.com",subject:"Hello"}})).toBe(true);
  });
  it("rejects unrelated event types",()=>{
    expect(automationMatches({trigger:{type:"email.received"},conditions:{}},{type:"whatsapp.received",payload:{}})).toBe(false);
  });
  it("rejects failed conditions",()=>{
    expect(automationMatches({trigger:{type:"email.received"},conditions:{label:"urgent"}},{type:"email.received",payload:{label:"normal"}})).toBe(false);
  });
});
