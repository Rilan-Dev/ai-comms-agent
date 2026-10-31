import test from "node:test";
import assert from "node:assert/strict";
import {applyMailboxSignature,normalizeMailboxSignature} from "@ai-comms-agent/shared";

const main="Kind regards,\nRilan Ahmed\nUrban Nexus Technology\n+971 50 123 4567";
const secondary="Thanks,\nAccounts Team\nSMTS";

test("saved sending mailbox signature is reproduced exactly at the bottom",()=>{
 const message=applyMailboxSignature("Hello Client,\n\nPlease review the attached quotation.",main);
 assert.equal(message,"Hello Client,\n\nPlease review the attached quotation.\n\n"+main);
 assert.equal(applyMailboxSignature(message,main),message,"retry must not duplicate signature");
});
test("saved signature replaces default AI Best regards signoff and guessed profile name",()=>{
 const input="Hello,\n\nThe report is attached.\n\nBest regards,\nAI Generated Name";
 assert.equal(applyMailboxSignature(input,secondary),"Hello,\n\nThe report is attached.\n\n"+secondary);
});
test("separate From mailbox selection uses the matching signature, not another account",()=>{
 const draftA=applyMailboxSignature("Hello",main);
 const draftB=applyMailboxSignature("Hello",secondary);
 assert.ok(draftA.endsWith(main));
 assert.ok(draftB.endsWith(secondary));
 assert.doesNotMatch(draftA,/Accounts Team/);
 assert.doesNotMatch(draftB,/Urban Nexus/);
});
test("no saved signature leaves the body untouched for agent-generated closing",()=>{
 const generated="Hi,\n\nThank you for your email.\n\nBest regards,\nYour Team";
 assert.equal(applyMailboxSignature(generated,null),generated);
 assert.equal(applyMailboxSignature(generated,""),generated);
});
test("saved signatures preserve Unicode and newlines, reject oversized or non-text data",()=>{
 assert.equal(normalizeMailboxSignature("  வணக்கம்,\r\nநன்றி\r\n"),"  வணக்கம்,\nநன்றி\n");
 assert.equal(normalizeMailboxSignature("A\u0000B"),"AB");
 assert.throws(()=>normalizeMailboxSignature("x".repeat(4001)),/4000/);
 assert.throws(()=>normalizeMailboxSignature({}),/text/);
});
test("editable body and literal content stay intact except recognizable generated closings",()=>{
 const exact="Please deliver the following content:\n\nImportant: 12345";
 assert.equal(applyMailboxSignature(exact,main),exact+"\n\n"+main);
});
