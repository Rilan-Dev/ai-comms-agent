import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { userFacingChatAnswer } from "../src/lib/chat/user-facing-answer.ts";

const read = (relative) => readFileSync(new URL(relative, import.meta.url), "utf8");
const excerpt = (source, start, end) => {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Missing exact tool-final callback boundaries");
  return source.slice(a, b);
};

test("a successful authorized read-only chat tool answer emits one validated delta", () => {
  const source = read("../src/app/api/chat/stream/route.ts");
  const callback = excerpt(source, "onSafeReadOnlyFinal: explicitEmailAction", "\n              });");
  assert.match(callback, /claraRuntime\.streamAuthorizedReadOnlyToolAnswer\(/);
  assert.match(callback, /const validated = userFacingChatAnswer\(generated\)/);
  assert.match(callback, /if \(!validated\) throw/);
  assert.match(callback, /emit\("delta", \{ text: validated \}\)/);
  assert.ok(callback.indexOf('emit("delta", { text: validated })') > callback.indexOf("if (!validated) throw"));
  assert.doesNotMatch(callback, /emit\("delta", \{ text: token \}\)/);
  assert.match(source, /if \(!toolTurn\.streamed\)/);
  assert.match(source, /await appendConversationMessage\(/);
});

test("successful read-only voice tool answer emits only validated text, then persists it", () => {
  const source = read("../src/app/api/voice/turn/route.ts");
  const callback = excerpt(source, "onSafeReadOnlyFinal: explicitEmailAction", "\n              });");
  assert.match(callback, /claraRuntime\.streamAuthorizedReadOnlyToolAnswer\(/);
  assert.match(callback, /const validated = userFacingChatAnswer\(generated\)/);
  assert.match(callback, /if \(!validated\) throw/);
  assert.match(callback, /emit\("delta", \{ text: validated \}\)/);
  assert.doesNotMatch(callback, /emit\("delta", \{ text: token \}\)/);
  assert.match(source, /await saveAnswer\(deliveredText\)/);
  assert.match(source, /if \(!result\.streamed\)/);
});

test("tool final rejects a blank or internal planning answer before delivery", () => {
  assert.equal(userFacingChatAnswer("  "), null);
  assert.equal(userFacingChatAnswer("<think>private</think>\nHere is the email."), null);
  assert.equal(userFacingChatAnswer("I need to make sure I don't include other emails."), null);
  assert.equal(userFacingChatAnswer("Your most recent email arrived today."), "Your most recent email arrived today.");
});

test("abort and tool failure never create an extra speculative answer", () => {
  for (const route of ["../src/app/api/chat/stream/route.ts", "../src/app/api/voice/turn/route.ts"]) {
    const source = read(route);
    const callback = excerpt(source, "onSafeReadOnlyFinal: explicitEmailAction", "\n              });");
    assert.match(callback, /request\.signal\.aborted/);
    assert.match(callback, /throw new Error\("The provider did not produce a final/);
    assert.ok(callback.indexOf('emit("delta", { text: validated })') > callback.indexOf("const validated = userFacingChatAnswer(generated)"));
  }
});
