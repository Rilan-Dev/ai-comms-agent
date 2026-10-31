import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const runtimeSource = readFileSync(new URL("../src/runtime.ts", import.meta.url), "utf8");

// Regression guard for the silent-empty-reply defect observed in production on
// 2026-10-24: reasoning-first models (sarvam-105b) can spend the whole
// completion budget on `delta.reasoning`, stop with finish_reason "length",
// and never emit `delta.content`. The SSE reader previously completed silently
// with zero chunks, which surfaced as empty AI chat replies and empty agent
// auto-reply output ("Generated WhatsApp text must contain 1-4096 characters").
test("SSE reader fails loudly when a completion contains no content chunks", () => {
  const reader = runtimeSource.slice(
    runtimeSource.indexOf("async function readSseStream"),
    runtimeSource.indexOf("async function openAICompatibleStream"),
  );
  assert.ok(reader.length > 0, "readSseStream source not found");
  assert.match(reader, /let sawContent = false/, "content tracking missing");
  assert.match(reader, /sawContent = true/, "content flag never set");
  assert.match(
    reader,
    /if \(!sawContent\)\s*\{\s*throw new Error\(/,
    "zero-content completion must throw instead of completing silently",
  );
  assert.match(
    reader,
    /no content/i,
    "the thrown error must describe the no-content condition",
  );
});

test("SSE parser still extracts only delta.content as chat tokens", () => {
  const reader = runtimeSource.slice(
    runtimeSource.indexOf("async function readSseStream"),
    runtimeSource.indexOf("async function openAICompatibleStream"),
  );
  assert.match(reader, /delta\?\.content/, "must keep reading delta.content");
  assert.doesNotMatch(reader, /delta\?\.reasoning/, "reasoning must NOT be surfaced as chat output");
});
