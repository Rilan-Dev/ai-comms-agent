import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasInteractiveEmailActions, suggestedChatNextActions } from "../src/lib/chat/interactive-replies.ts";

const selectedWhatsAppQuestion = "Send a WhatsApp message to +919629534701 saying 'Hello! This is a test message from Clara AI.'";
const selectedAnswer = "I can't send WhatsApp messages. I'm a text-only assistant and don't have access to messaging tools outside of email. If you'd like, I can draft a test email for you instead. Would you like me to prepare anything else?";
const source = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");

test("reported WhatsApp refusal never produces a random mail action or next-step panel", () => {
  assert.deepEqual(suggestedChatNextActions(selectedAnswer, selectedWhatsAppQuestion), []);
  assert.equal(hasInteractiveEmailActions(selectedAnswer, selectedWhatsAppQuestion), false);
});

test("short conversational and error answers never show default choices", () => {
  for (const [answer, request] of [
    ["Hello! How can I help?", "Hi"],
    ["You're welcome.", "Thanks"],
    ["I couldn't find any matching messages.", "Summarize my inbox"],
    ["I don't have access to your email. No email was sent.", "Send email to test@example.com"],
    ["Drafts require email.write and human approval.", "Send an email"],
    ["No new unread emails were found.", "Summarize my unread email"],
    ["I cannot access WhatsApp and I can only help with email.", "Send a WhatsApp message"],
  ]) {
    assert.deepEqual(suggestedChatNextActions(answer, request), [], request);
    assert.equal(hasInteractiveEmailActions(answer, request), false, request);
  }
});

test("a substantive requested mail summary may offer text-only follow-ups", () => {
  const answer = "Sender: reports@example.com\nSubject: Quarterly update\nReceived: today";
  assert.deepEqual(suggestedChatNextActions(answer, "Summarize my recent emails").map(x=>x.id), ["prioritize", "checklist", "draft"]);
  assert.equal(hasInteractiveEmailActions(answer, "Summarize my recent emails"), false);
  assert.deepEqual(suggestedChatNextActions(answer, "Send a WhatsApp notification about my email"), []);
});

test("email actions require explicit email drafting intent and prepared email content", () => {
  const draft = "Here is the draft:\nSubject: Project update\nBody:\nHello team,\nThe status is green.";
  assert.equal(hasInteractiveEmailActions(draft, "Please draft an email to the team"), true);
  assert.equal(hasInteractiveEmailActions(draft, "Send a WhatsApp to the team"), false);
  assert.equal(hasInteractiveEmailActions("I could draft an email if you like", "Draft an email"), false);
  assert.equal(hasInteractiveEmailActions(draft, "Tell me a joke"), false);
});

test("latest assistant response passes its preceding user request to conditional controls", () => {
  const chat = source("../src/app/chat/chat-client.tsx");
  const controls = source("../src/app/chat/interactive-message-controls.tsx");
  assert.match(chat, /latestUserRequest/);
  assert.match(chat, /userRequest=\{latestUserRequest\}/);
  assert.match(controls, /suggestedChatNextActions\(answer, userRequest\)/);
  assert.match(controls, /hasInteractiveEmailActions\(answer, userRequest\)/);
  assert.match(controls, /if \(!actions\.length && !emailActions\) return null;/);
  assert.match(controls, /\{actions\.length > 0 \?/);
  assert.match(controls, /\{emailActions \? <InteractiveMailActions/);
  assert.match(chat, /message\.role === "assistant" && message\.id === latestAssistantId/);
  assert.doesNotMatch(controls, /fetch\(|dangerouslySetInnerHTML/);
});


test("chat interactive controls import only exported reply helpers", () => {
  // Catch unresolved named imports during native Node tests, before the Next
  // production build reaches TypeScript's TS2305 failure.
  const component = source("../src/app/chat/interactive-message-controls.tsx");
  const helpers = source("../src/lib/chat/interactive-replies.ts");
  const declaration = component.match(/import\s*\{([^}]+)\}\s*from\s*["']@\/lib\/chat\/interactive-replies["']/);
  assert.ok(declaration, "the interactive reply helpers import must be present");
  const importedNames = declaration[1].split(",")
    .map(part => part.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0].trim())
    .filter(Boolean);
  assert.ok(importedNames.includes("suggestedChatNextActions"));
  assert.ok(importedNames.includes("hasInteractiveEmailActions"));
  for (const name of importedNames) {
    assert.match(helpers,
      new RegExp("\\bexport\\s+(?:(?:async\\s+)?function|const|class|type|interface)\\s+" + name + "\\b"),
      `Imported helper ${name} must be exported by interactive-replies.ts`);
  }
});
