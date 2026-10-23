import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { explicitComposeRecipient } from "../src/lib/mail/test-email-compose-intent.ts";

test("only one explicit outgoing To address is safely prefilled in an editable compose form", () => {
  for (const phrase of [
    "send email to sample@example.com for test email",
    "Please send a test email to sample@example.com",
    "draft an email to sample@example.com about our meeting",
    "could you write email to sample@example.com?",
  ]) assert.equal(explicitComposeRecipient(phrase), "sample@example.com", phrase);
});

test("does not infer recipients from read requests, ambiguity, multiple recipients or long prompts", () => {
  for (const phrase of [
    "show emails from sample@example.com",
    "list emails to sample@example.com",
    "send me all emails from sample@example.com",
    "how do I send email to sample@example.com?",
    "send email to sample@example.com and other@example.com",
    "send email to me",
    "send email to not-an-email",
    "send email to sample@example.com " + "x".repeat(2000),
  ]) assert.equal(explicitComposeRecipient(phrase), null, phrase);
});

test("inline Chat mail review prefills only the recipient explicitly supplied by the last user", () => {
  const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
  const inline = chat.slice(chat.indexOf("function openInlineEmailComposer()"),chat.indexOf("function requestInlineEmailApproval()"));
  assert.match(inline, /explicitComposeRecipient\(latestUserRequest\)/);
  assert.match(inline, /if \(!composeTo\.trim\(\) && suggestedRecipient/);
  assert.match(inline, /void openMailComposer\(suggestedRecipient \?\? ""\)/);
  assert.match(chat, /onClick=\{\(\) => void submitMailCompose\("draft"\)\}/);
  assert.match(chat, /onClick=\{\(\) => void submitMailCompose\("request_approval"\)\}/);
  assert.doesNotMatch(inline, /fetch\(|submitMailCompose\(|email\.send\.request/);
});
