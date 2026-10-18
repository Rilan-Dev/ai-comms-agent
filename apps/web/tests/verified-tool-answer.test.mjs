import test from "node:test";
import assert from "node:assert/strict";
import { emitVerifiedToolAnswer } from "../src/lib/streaming/verified-tool-answer.ts";

function provider(tokens) {
  return async () => (async function* () { for (const chunk of tokens) yield chunk; })();
}
async function capture(answer, tokens, signal) {
  const deltas = [];
  const result = await emitVerifiedToolAnswer(answer, provider(tokens), (delta) => deltas.push(delta), signal);
  return { ...result, deltas, text: deltas.join("") };
}
test("genuine provider deltas render before generation ends, preserving the approved answer", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const emitted = [];
  const pending = emitVerifiedToolAnswer("Message received.", async () => (async function* () {
    yield "Message ";
    await gate;
    yield "received.";
  })(), (delta) => emitted.push(delta));
  // Yield to the iterator so we verify the first chunk reached the UI first.
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(emitted, ["Message "]);
  release();
  const result = await pending;
  assert.equal(emitted.join(""), "Message received.");
  assert.deepEqual(result, { completed: true, mode: "verified-provider-tokens" });
});
test("invented sends and mutated approvals never become visible", async () => {
  const result = await capture("A send is pending human approval.", [
    "A send is pending ", "human ", "approval. The email was sent!",
  ]);
  assert.equal(result.text, "A send is pending human approval.");
  assert.equal(result.mode, "canonical-fallback");
});
test("provider error after a valid prefix produces only canonical remaining text", async () => {
  const deltas = [];
  const result = await emitVerifiedToolAnswer("Account read denied.", async () => (async function* () {
    yield "Account read ";
    throw new Error("provider secret: abcdef");
  })(), (part) => deltas.push(part));
  assert.equal(deltas.join(""), "Account read denied.");
  assert.equal(result.mode, "canonical-fallback");
});
test("provider returning empty or incomplete output cannot silently omit approved text", async () => {
  assert.equal((await capture("No mailbox attached.", [])).text, "No mailbox attached.");
  assert.equal((await capture("No mailbox attached.", ["No "])).text, "No mailbox attached.");
});
test("abort before generation prevents network and all output", async () => {
  const controller = new AbortController();
  controller.abort();
  let called = false, written = "";
  const result = await emitVerifiedToolAnswer("Pending", async () => {
    called = true; return provider(["Pending"])();
  }, (delta) => { written += delta; }, controller.signal);
  assert.equal(result.mode, "aborted");
  assert.equal(called, false);
  assert.equal(written, "");
});
test("abort during provider iteration does not emit fallback or a completion", async () => {
  const controller = new AbortController();
  let written = "";
  const result = await emitVerifiedToolAnswer("Partial then cancelled", async () => (async function* () {
    yield "Partial ";
    controller.abort();
    yield "then cancelled";
  })(), (delta) => { written += delta; }, controller.signal);
  assert.equal(result.completed, false);
  assert.equal(result.mode, "aborted");
  assert.equal(written, "Partial ");
});
test("real provider model tokens may be split arbitrarily, but order stays canonical", async () => {
  const content = "தமிழ் 🌍 — mail approved";
  const chunks = Array.from(content);
  const result = await capture(content, chunks);
  assert.equal(result.text, content);
  assert.equal(result.mode, "verified-provider-tokens");
});
