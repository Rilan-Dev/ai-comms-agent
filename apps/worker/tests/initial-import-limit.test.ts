import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInitialImportLimit,
  remainingInitialImport,
  eligibleSyncMessageIds,
} from "../src/email/initial-import-limit";

test("platform initial import preferences accept only bounded presets", () => {
  for (const n of [10, 50, 100]) {
    assert.equal(parseInitialImportLimit(n), n);
    assert.equal(parseInitialImportLimit(String(n)), n);
  }
  for (const invalid of [null, undefined, 0, -5, 1, 5000, 101, "all", "Infinity", {}, ""]) {
    assert.equal(parseInitialImportLimit(invalid), 50);
  }
});

test("existing imported messages count against historical quota, never negative", () => {
  assert.equal(remainingInitialImport(50, 0), 50);
  assert.equal(remainingInitialImport(50, 37), 13);
  assert.equal(remainingInitialImport(10, 10), 0);
  assert.equal(remainingInitialImport(100, 5300), 0);
});

test("historical page cannot exceed chosen import cap", () => {
  const ids = Array.from({ length: 100 }, (_, index) => "m-" + index);
  const initial = eligibleSyncMessageIds(ids, "initial", 10, 7);
  assert.deepEqual(initial, ids.slice(0, 3));
  assert.deepEqual(eligibleSyncMessageIds(ids, "initial", 10, 10), []);
});

test("incremental events are never dropped even when historical quota is filled", () => {
  const arrivals = Array.from({ length: 150 }, (_, i) => "live-" + i);
  assert.deepEqual(eligibleSyncMessageIds(arrivals, "incremental", 10, 10000), arrivals);
});

test("invalid and non-finite quotas fail closed", () => {
  assert.equal(remainingInitialImport(NaN, 0), 0);
  assert.equal(remainingInitialImport(50, Infinity), 0);
});
