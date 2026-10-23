import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const route = readFileSync(new URL("../src/app/api/voice/turn/route.ts", import.meta.url), "utf8");

test("Voice SSE and JSON share one trusted tool-intent decision", () => {
  const start = route.indexOf('const needsAuthorizedTools = explicitEmailAction ||');
  const sse = route.indexOf('if (request.headers.get("accept")?.includes("text/event-stream"))');
  assert.ok(start > 0 && sse > start, "tool intent must be decided before either response format");
  assert.equal(route.slice(sse, route.indexOf("const encoder = new TextEncoder()", sse)).includes("const needsAuthorizedTools ="), false);
});

test("non-tool JSON voice goes to Clara's conversational read-only model, not email tool runtime", () => {
  const jsonStart = route.indexOf("if (blockedWriteExplanation) {", route.indexOf('return new Response(stream,'));
  const jsonTools = route.indexOf("const turn = await runEmailAgentTurn({", jsonStart);
  assert.ok(jsonStart > 0 && jsonTools > jsonStart);
  const json = route.slice(jsonStart, jsonTools);
  assert.match(json, /if \(!needsAuthorizedTools\)/);
  assert.match(json, /claraRuntime\.createChatTurn\(/);
  assert.match(json, /for await \(const token of generation\.stream\)/);
  assert.match(json, /userFacingChatAnswer\(modelAnswer\)/);
  assert.match(json, /await saveAnswer\(validated\)/);
  assert.match(json, /toolCalls: \[\], pendingApprovals: \[\],/);
  assert.match(json, /finishReason: "completed", actions: \[\]/);
  assert.match(json, /Never claim to have sent, approved/);
});

test("JSON email actions still use host tools, actor rights, approval and bounded loops", () => {
  const json = route.slice(route.lastIndexOf("const turn = await runEmailAgentTurn({"));
  assert.match(json, /auth_subject:/);
  assert.match(json, /role,/);
  assert.match(json, /permissions,/);
  assert.match(json, /maxRounds: 4,/);
  assert.match(json, /maxToolCalls: 8,/);
  assert.match(json, /currentTurnOperationAnswer\(turn\.text,/);
  assert.match(json, /executionId, explicitEmailAction/);
  assert.match(route, /deniedEmailWriteExplanation\(transcript, subject\.permissions\)/);
});

test("SSE validates conversational output and retains tool-qualified status", () => {
  const sse = route.slice(route.indexOf('if (request.headers.get("accept")?.includes("text/event-stream"))'), route.indexOf('return new Response(stream,'));
  assert.match(sse, /if \(blockedWriteExplanation\)/);
  assert.match(sse, /else if \(needsAuthorizedTools\)/);
  assert.match(sse, /emit\("delta", \{ text: verifiedAnswer \}\)/);
  assert.match(sse, /mode: "model-stream"/);
  assert.match(sse, /runEmailAgentTurn\(/);
});
