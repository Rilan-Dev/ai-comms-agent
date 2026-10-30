import test from "node:test";
import assert from "node:assert/strict";
import {sourceSummaryFallback,summaryOnlyAutomation,recoverableSummaryProviderError} from "../src/automation/source-summary-fallback";
const mail={source:"automation",intent:"automation.execute",params:{actions:[{type:"generate_summary"}],event:{emailAccountId:"abc",subject:"Action required: review",from:"sender@example.test",snippet:"Please approve the request.",actionRequired:true}}};
test("safe fallback produces a clearly non-AI source recap without sending",()=>{
 const output=sourceSummaryFallback(mail,"empty");
 assert.ok(output?.includes("NOT an AI-generated summary"));
 assert.ok(output?.includes("No email or WhatsApp was sent"));
 assert.ok(output?.includes("Action required: review"));
 assert.ok(output?.includes("flagged action required"));
});
test("does not bypass authorization or create side effects for send/draft workflows",()=>{
 for(const type of ["send_whatsapp","create_draft","create_email_approval"]){
  const v={...mail,params:{...mail.params,actions:[{type}]}};
  assert.equal(summaryOnlyAutomation(v),false);
  assert.equal(sourceSummaryFallback(v,"empty"),null);
 }
 assert.equal(sourceSummaryFallback({...mail,source:"schedule"},"empty"),null);
});
test("requires source data rather than inventing provider outcomes",()=>{
 assert.equal(sourceSummaryFallback({...mail,params:{...mail.params,event:{}}},"empty"),null);
 const text=sourceSummaryFallback({...mail,params:{...mail.params,event:{accountId:"a",messageType:"unknown"}}},"provider_error");
 assert.ok(text?.includes("WhatsApp"));
 assert.ok(text?.includes("rate-limited"));
});
test("recovers only known transient model errors, not permission or 400 errors",()=>{
 assert.equal(recoverableSummaryProviderError(new Error("Gemini 429 quota exceeded")),true);
 assert.equal(recoverableSummaryProviderError(new Error("AI provider streamed a completion with no content")),true);
 assert.equal(recoverableSummaryProviderError(new Error("permission revoked")),false);
 assert.equal(recoverableSummaryProviderError(new Error("Tool request failed 400 missing signature")),false);
});
