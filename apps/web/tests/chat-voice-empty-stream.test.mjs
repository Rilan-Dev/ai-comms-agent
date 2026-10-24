import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = (file) => readFileSync(new URL(file, import.meta.url), "utf8");

test("chat refuses SSE completion without any assistant response", () => {
  const route = src("../src/app/api/chat/stream/route.ts");
  const afterGeneration = route.slice(route.indexOf("if (request.signal.aborted) {", route.indexOf("const shouldResolveTools")));
  const mustExist = 'if (!assistantOutput.trim()) throw new Error("AI provider returned an empty chat response.");';
  assert.match(afterGeneration, /if \(!assistantOutput\.trim\(\)\) throw new Error\("AI provider returned an empty chat response\."\)/);
  assert.ok(afterGeneration.indexOf(mustExist) < afterGeneration.indexOf('await appendConversationMessage({'), "Never save blank assistant turn");
  assert.ok(afterGeneration.indexOf(mustExist) < afterGeneration.indexOf('emit("done", { conversationId:'), "Never claim a completed blank answer");
  assert.match(route, /emit\("error", \{ message: explicitMessagingAction/);
  assert.match(route, /Chat execution failed\. Review drafts and approvals/);
  assert.match(route, /The read-only response could not be completed/);
});

test("voice SSE never completes a normal model turn if the provider yields zero tokens", () => {
  const route = src("../src/app/api/voice/turn/route.ts");
  const from = route.indexOf('surface: "realtime"');
  const until = route.indexOf('mode: "model-stream"', from);
  const stream = route.slice(from, until);
  assert.match(stream, /if \(!generated\.trim\(\)\) throw new Error\("AI provider returned an empty voice response\."\)/);
  assert.ok(stream.indexOf("if (!generated.trim())") < stream.indexOf("await saveAnswer(deliveredText)"));
  assert.match(route, /Clara could not complete the voice answer\. No external action was confirmed\./);
});

test("existing host-verified email feedback and non-empty read-only stream protections stay intact", () => {
  const chat = src("../src/app/api/chat/stream/route.ts");
  const voice = src("../src/app/api/voice/turn/route.ts");
  assert.match(chat, /currentTurnOperationAnswer\(toolTurn\.text,/);
  assert.match(chat, /if \(!request\.signal\.aborted && !generated\.trim\(\)\)/);
  assert.match(voice, /currentTurnOperationAnswer\(result\.text,/);
  assert.match(voice, /if \(!request\.signal\.aborted && !generated\.trim\(\)\)/);
  assert.match(voice, /deniedEmailWriteExplanation\(transcript, subject\.permissions\)/);
});
