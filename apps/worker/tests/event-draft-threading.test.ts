import test from "node:test";
import assert from "node:assert/strict";
import {draftReplySourceFromEvent} from "../src/automation/draft-reply-source";
import {readFileSync} from "node:fs";

const msgId="11111111-2222-4333-8444-555555555555";
test("new customer email drafts address actual sender and reuse source message",()=>{
 assert.deepEqual(draftReplySourceFromEvent({from:"Project Manager <client@example.com>",messageId:msgId}),{recipient:"client@example.com",replyToMessageId:msgId});
});
test("invalid or malformed source email fails closed instead of inventing a recipient",()=>{
 assert.equal(draftReplySourceFromEvent({from:"",messageId:msgId}),null);
 assert.equal(draftReplySourceFromEvent({from:"not_an_email",messageId:msgId}),null);
 assert.deepEqual(draftReplySourceFromEvent({from:"client@example.com",messageId:"fake"}),{recipient:"client@example.com",replyToMessageId:null});
});
test("product draft executor binds reply source into the existing thread",()=>{
 const source=readFileSync(new URL("../src/agent/product-action-executor.ts",import.meta.url),"utf8");
 assert.ok(source.includes("replySource=draftReplySourceFromEvent(event)"));
 assert.ok(source.includes("replyToMessageId:replySource.replyToMessageId"));
 assert.ok(source.includes("replySource?.recipient??stringValue(action.to)"));
 assert.ok(source.includes('email.draft.create'));
});
