import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const chat = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");
const slice = (start, end) => {
  const from = chat.indexOf(start);
  const to = chat.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing chat routine: ${start}`);
  return chat.slice(from, to);
};
const switcher = slice("async function switchAgent(", "async function returnFromVoice()");
const voice = slice("async function returnFromVoice()", "async function openMailComposer(");
const open = slice("async function openMailComposer(", "async function submitMailCompose(");
const submit = slice("async function submitMailCompose(", "async function reloadMailPermissions()");
const send = slice("async function sendMessage()", "\n  return (");
const ui = chat.slice(chat.indexOf('aria-label="Choose agent"'), chat.indexOf('aria-label="Sending mailbox"') + 400);

test("agent switching does not expose old conversation under a new agent while loading", () => {
  assert.match(switcher, /agentSwitchInFlightRef\.current/);
  assert.match(switcher, /setAgentSwitchBusy\(true\)/);
  assert.match(switcher, /agentContextEpochRef\.current/);
  assert.ok(switcher.indexOf("setAgentId(nextAgentId)") > switcher.indexOf("if (!response.ok)"));
  assert.match(switcher, /setConversationId\(payload\.conversation\.id\)/);
  assert.match(switcher, /setMessages\(payload\.messages\)/);
  assert.match(switcher, /finally \{/);
  assert.match(ui, /disabled=\{voiceOpen \|\| busy \|\| agentSwitchBusy/);
});

test("failed agent switch preserves previously selected agent and history", () => {
  const failure = switcher.slice(switcher.indexOf("} catch (error)"));
  assert.doesNotMatch(failure, /setAgentId\(nextAgentId\)/);
  assert.doesNotMatch(failure, /setMessages\(\[\{/);
  assert.match(switcher, /setAgentSwitchNotice\(/);
  assert.match(switcher, /if \(!agents\.some\(agent => agent\.id === nextAgentId\)\) return/);
  assert.match(send, /agentSwitchInFlightRef\.current/);
});

test("voice history reload cannot replace newer selected agent's conversation", () => {
  assert.match(voice, /const epoch = agentContextEpochRef\.current/);
  assert.match(voice, /if \(epoch !== agentContextEpochRef\.current\) return/);
  assert.match(voice, /setConversationId\(data\.conversation\.id\)/);
  assert.match(voice, /setMessages\(data\.messages\)/);
});

test("draft save and approval response require the original review revision", () => {
  assert.match(open, /const revision = \+\+composeRevisionRef\.current/);
  assert.match(open, /if \(revision !== composeRevisionRef\.current \|\| epoch !== agentContextEpochRef\.current\) return/);
  assert.match(submit, /const revision = composeRevisionRef\.current/);
  assert.match(submit, /if \(revision !== composeRevisionRef\.current \|\| epoch !== agentContextEpochRef\.current\) return/);
  assert.match(submit, /composeInFlightRef\.current/);
  assert.match(submit, /setComposeDraftId\(data\.draftId\)/);
  assert.match(submit, /setComposeActionId\(data\.actionId\)/);
});

test("editing any mail recipient, subject, body or mailbox invalidates prior saved draft and approval", () => {
  assert.match(chat, /function invalidateComposeReview\(\)/);
  assert.match(chat, /composeRevisionRef\.current \+= 1/);
  const composer = chat.slice(chat.indexOf('aria-label="Email review in this Chat conversation"'),chat.indexOf('Review approvals'));
  assert.equal((composer.match(/invalidateComposeReview\(\)/g) ?? []).length, 5);
  assert.match(composer, /disabled=\{composeBusy/);
  assert.match(chat, /setComposeActionId\(null\)/);
});
