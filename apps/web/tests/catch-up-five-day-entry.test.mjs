import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { parseCatchUpDays, catchUpPeriodUtc } from "../src/lib/briefings/catch-up-window.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

test("five days is an explicit lookback option; no invented visit date or unbounded range", () => {
  for (const [input, expected] of [["1", 1], ["5", 5], ["7", 7], ["30", 30]]) {
    assert.equal(parseCatchUpDays(input), expected);
  }
  for (const bad of [undefined, null, "", "0", "05", "-5", "90", "5.5", "Infinity", "5;DROP TABLE", 5, {}, []]) {
    assert.equal(parseCatchUpDays(bad), 7);
  }
});

test("five-day lookback is exact in UTC and does not read or mutate visit/review state", () => {
  assert.deepEqual(catchUpPeriodUtc(5, new Date("2026-10-23T09:00:00.000Z")), {
    start: "2026-10-18T09:00:00.000Z", end: "2026-10-23T09:00:00.000Z",
  });
  assert.throws(() => catchUpPeriodUtc(90, new Date()), /Unsupported catch-up window/);
});

test("Overview offers only a feature-gated five-day journey, not a fake personalized count", () => {
  const overview = read("../src/app/overview/page.tsx");
  assert.match(overview, /data\?\.catchUpAvailable/);
  assert.match(overview, /href="\/catch-up\?days=5"/);
  assert.match(overview, /last 5 days/);
  assert.match(overview, /not a measurement of how long you were away/);
  assert.match(overview, /organization-wide counts/);
});

test("server sanitizes optional days and supplies the requested window to the existing private C4 page", () => {
  const page = read("../src/app/catch-up/page.tsx");
  const client = read("../src/app/catch-up/catch-up-client.tsx");
  assert.match(page, /if \(!briefingsEnabled\(\)\) notFound\(\)/);
  assert.match(page, /parseCatchUpDays\(/);
  assert.match(page, /initialDays=\{initialDays\}/);
  assert.match(page, /listGrantedBriefingMailboxes/);
  assert.match(client, /useState<CatchUpDays>\(initialDays\)/);
  assert.match(client, /<option value=\{5\}>Last 5 days<\/option>/);
  assert.match(client, /catchUpPeriodUtc\(selectedDays, now\)/);
  assert.match(client, /This is a selected lookback window, not automatically detected absence/);
  assert.match(client, /Mark this item reviewed/);
  assert.match(client, /reviewedItemIds/);
});
