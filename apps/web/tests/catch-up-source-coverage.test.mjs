import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { describeCatchUpSourceCoverage } from "../src/lib/briefings/source-coverage-display.ts";

test("zero eligible source count is not mistaken for generated AI results", () => {
  const result = describeCatchUpSourceCoverage(0, [], null);
  assert.deepEqual([result.selectedCount, result.loadedCount, result.remainingCount], [0, 0, 0]);
  assert.equal(result.complete, false);
  assert.match(result.message, /No source emails were selected/i);
});

test("page 1 of a larger permitted manifest reports visible links and a remaining count", () => {
  const ids = Array.from({ length: 200 }, (_, index) => `mail-${index}`);
  const result = describeCatchUpSourceCoverage(320, ids, "next");
  assert.equal(result.loadedCount, 200);
  assert.equal(result.remainingCount, 120);
  assert.equal(result.hasMore, true);
  assert.equal(result.complete, false);
  assert.match(result.message, /200 of 320/);
  assert.match(result.message, /Load more/);
});

test("absence of a cursor never falsely declares missing selected sources complete", () => {
  const result = describeCatchUpSourceCoverage(5, ["one", "two"], null);
  assert.equal(result.complete, false);
  assert.equal(result.remainingCount, 3);
  assert.match(result.message, /not yet available/);
});

test("an exact selected set without next page is a complete SOURCE LINK list, not an AI summary", () => {
  const result = describeCatchUpSourceCoverage(2, ["one", "two"], null);
  assert.equal(result.complete, true);
  assert.equal(result.hasMore, false);
  assert.match(result.message, /2 of 2 source email links/);
  assert.doesNotMatch(result.message, /AI generated|AI complete|all reviewed/i);
});

test("duplicate and empty IDs never inflate coverage, invalid source counts fail closed", () => {
  const result = describeCatchUpSourceCoverage(3, ["one", "one", "", "two"], "next");
  assert.equal(result.loadedCount, 2);
  assert.equal(result.remainingCount, 1);
  const invalid = describeCatchUpSourceCoverage(-4, ["one"], null);
  assert.equal(invalid.selectedCount, 0);
  assert.equal(invalid.complete, false);
});

test("catch-up UI shows separate source coverage and pending AI generation truthfully", () => {
  const client = readFileSync(new URL("../src/app/catch-up/catch-up-client.tsx", import.meta.url), "utf8");
  assert.match(client, /describeCatchUpSourceCoverage\(manifest\.sourceCount, sources\.map\(s => s\.messageId\), nextCursor\)/);
  assert.match(client, /sourceCoverage\.message/);
  assert.match(client, /Source email links loaded/);
  assert.match(client, /C3 source-grounded AI generation is not yet running automatically/);
  assert.match(client, /Load more source links/);
  assert.match(client, /Selected UTC window:/);
  assert.doesNotMatch(client, /mark.*read.*on login/i);
});
