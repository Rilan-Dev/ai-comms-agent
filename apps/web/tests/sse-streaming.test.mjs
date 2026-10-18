import { test } from "node:test";
import assert from "node:assert/strict";
import { readSseEvents } from "../src/lib/streaming/sse.ts";

const encoder = new TextEncoder();

function streamPieces(...parts) {
  return new ReadableStream({
    start(controller) {
      for (const part of parts) controller.enqueue(typeof part === "string" ? encoder.encode(part) : part);
      controller.close();
    },
  });
}

test("incremental SSE parser reconstructs split event names and delta JSON", async () => {
  const received = [];
  for await (const event of readSseEvents(streamPieces(
    "eve", "nt: status\ndata: {\"phase\":\"generating\"}\n\n",
    "event: delta\ndata: {\"text\":\"Hel", "lo\"}\n\n",
    "event: done\ndata: {\"finishReason\":\"completed\"}\n\n",
  ))) received.push(event);
  assert.deepEqual(received, [
    { event: "status", data: '{"phase":"generating"}' },
    { event: "delta", data: '{"text":"Hello"}' },
    { event: "done", data: '{"finishReason":"completed"}' },
  ]);
});

test("incremental SSE parser preserves multi-byte Unicode split across network reads", async () => {
  const full = encoder.encode('event: delta\ndata: {"text":"தமிழ் 🌍"}\n\n');
  const parts = Array.from(full, (byte) => new Uint8Array([byte]));
  const events = [];
  for await (const event of readSseEvents(streamPieces(...parts))) events.push(event);
  assert.equal(JSON.parse(events[0].data).text, "தமிழ் 🌍");
});

test("incremental SSE parser understands CRLF, comments and multiline data", async () => {
  const events = [];
  for await (const event of readSseEvents(streamPieces(
    ": heartbeat\r\n\r\n",
    "event: status\r\ndata: first\r\ndata: second\r\n\r\n",
  ))) events.push(event);
  assert.deepEqual(events, [{ event: "status", data: "first\nsecond" }]);
});

test("incremental SSE parser accepts a final EOF-terminated message", async () => {
  const events = [];
  for await (const event of readSseEvents(streamPieces('event: done\ndata: {"ok":true}'))) events.push(event);
  assert.deepEqual(events, [{ event: "done", data: '{"ok":true}' }]);
});

test("incremental SSE parser refuses unbounded events", async () => {
  await assert.rejects(async () => {
    for await (const _event of readSseEvents(streamPieces("x".repeat(1024 * 1024 + 1)))) {}
  }, /maximum event size/);
});
