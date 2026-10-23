import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../src/app/chat/page.tsx", import.meta.url), "utf8");
const client = readFileSync(new URL("../src/app/chat/chat-client.tsx", import.meta.url), "utf8");

function section(start, end) {
  const from = client.indexOf(start);
  const to = client.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Missing ChatClient section: ${start}`);
  return client.slice(from, to);
}

test("changing an old-chat deep link remounts the correct agent and conversation state", () => {
  assert.match(page, /<ChatClient\s+key=\{\`\$\{organizationId\}:\$\{agent\.id\}:\$\{conversation\.id\}\`\}/);
  assert.match(page, /initialConversationId=\{conversation\.id\}/);
  assert.match(page, /initialMessages=\{messages as never\[\]\}/);
  assert.match(client, /useState\(initialConversationId\)/);
  assert.match(client, /useState<Message\[\]>\(initialMessages\)/);
});

test("an unknown explicitly requested agent cannot silently fall back to a different agent", () => {
  assert.match(page, /const agent = requestedAgentId\s*\? agents\.find\(item => item\.id === requestedAgentId\)\s*: agents\[0\]/);
  assert.match(page, /if \(!agent && requestedAgentId\)/);
  assert.match(page, /title="Agent not found"/);
  assert.match(page, /getChatConversation\(organizationId, params\.conversationId, agent\.id\)/);
});

test("concurrent New chat creation fences double-click and agent switching even before render", () => {
  const switchAgent = section("async function switchAgent(", "async function startNewChat()");
  const newChat = section("async function startNewChat()", "async function returnFromVoice()");
  assert.match(client, /const newChatInFlightRef = useRef\(false\)/);
  assert.match(switchAgent, /newChatInFlightRef\.current/);
  assert.match(newChat, /agentSwitchInFlightRef\.current/);
  assert.match(newChat, /newChatInFlightRef\.current = true/);
  assert.match(newChat, /newChatInFlightRef\.current = false/);
  assert.match(newChat, /const epoch = agentContextEpochRef\.current/);
  assert.match(newChat, /if \(epoch !== agentContextEpochRef\.current\)/);
  assert.match(newChat, /window\.location\.assign\(/);
  assert.match(client, /disabled=\{voiceOpen \|\| busy \|\| agentSwitchBusy \|\| newChatBusy \|\| composeBusy \|\| mailPermissionBusy\}/);
});

test("history links remain unavailable during a pending new-chat mutation", () => {
  assert.match(client, /if \(busy \|\| chatTurnInFlightRef\.current \|\| newChatBusy \|\| newChatInFlightRef\.current/);
  assert.match(client, /aria-current=\{session\.id === conversationId \? "page" : undefined\}/);
});
