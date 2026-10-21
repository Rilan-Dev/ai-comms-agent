import test from "node:test";
import assert from "node:assert/strict";
import { matchesCron, nextCronFire } from "../src/scheduling/cron";

test("matches a five-field cron in the requested timezone",()=>{
  const d=new Date("2026-10-06T09:30:00.000Z");
  assert.equal(matchesCron("0 15 * * *",d,"Asia/Kolkata"),true);
});
test("finds the next matching minute",()=>{
  const d=new Date("2026-10-06T09:31:00.000Z");
  assert.equal(nextCronFire("0 15 * * *",d,"Asia/Kolkata").toISOString(),"2026-10-07T09:30:00.000Z");
});


test("numeric-base steps repeat until the end of the field", () => {
  const at = (minute: number) => new Date(`2026-10-22T08:${String(minute).padStart(2, "0")}:00.000Z`);
  for (const minute of [5, 20, 35, 50]) {
    assert.equal(matchesCron("5/15 * * * *", at(minute), "UTC"), true, `minute ${minute}`);
  }
  for (const minute of [0, 10, 55]) {
    assert.equal(matchesCron("5/15 * * * *", at(minute), "UTC"), false, `minute ${minute}`);
  }
  for (const minute of [0, 15, 30, 45]) {
    assert.equal(matchesCron("0/15 * * * *", at(minute), "UTC"), true, `minute ${minute}`);
  }
  assert.equal(nextCronFire("5/15 * * * *", at(5), "UTC").toISOString(), at(20).toISOString());
});

test("bare numeric cron fields stay single values and ranges retain their steps", () => {
  const at = (minute: number) => new Date(`2026-10-22T08:${String(minute).padStart(2, "0")}:00.000Z`);
  assert.equal(matchesCron("5 * * * *", at(5), "UTC"), true);
  assert.equal(matchesCron("5 * * * *", at(20), "UTC"), false);
  assert.equal(matchesCron("5-20/7 * * * *", at(12), "UTC"), true);
  assert.equal(matchesCron("5-20/7 * * * *", at(19), "UTC"), true);
  assert.equal(matchesCron("*/15 * * * *", at(45), "UTC"), true);
});


test("rejects malformed cron segments with extra slash tokens", () => {
  const now = new Date("2026-10-22T08:15:00.000Z");
  for (const cron of ["*/15/2 * * * *", "5/15/2 * * * *", "*/15/ * * * *"]) {
    assert.throws(() => matchesCron(cron, now, "UTC"), /Invalid cron field/);
  }
  // Validation must not short-circuit when an earlier time field does not match.
  assert.throws(() => matchesCron("0 0 * * */15/2", now, "UTC"), /Invalid cron field/);
  assert.equal(matchesCron("*/15 * * * *", now, "UTC"), true);
});


test("restricted day-of-month and day-of-week use standard cron OR matching", () => {
  const cron = "0 8 1 * 4"; // At 08:00 on day 1 and on Thursdays.
  assert.equal(matchesCron(cron, new Date("2026-10-22T08:00:00Z"), "UTC"), true); // Thursday, not day 1
  assert.equal(matchesCron(cron, new Date("2026-11-01T08:00:00Z"), "UTC"), true); // Day 1, not Thursday
  assert.equal(matchesCron(cron, new Date("2026-10-23T08:00:00Z"), "UTC"), false);
});

test("unrestricted cron day fields continue to require the restricted day", () => {
  assert.equal(matchesCron("0 8 1 * *", new Date("2026-10-22T08:00:00Z"), "UTC"), false);
  assert.equal(matchesCron("0 8 1 * *", new Date("2026-11-01T08:00:00Z"), "UTC"), true);
  assert.equal(matchesCron("0 8 * * 4", new Date("2026-10-22T08:00:00Z"), "UTC"), true);
  assert.equal(matchesCron("0 8 * * 4", new Date("2026-10-23T08:00:00Z"), "UTC"), false);
});

test("nextCronFire does not skip matching weekday when a day-of-month is specified", () => {
  assert.equal(
    nextCronFire("0 8 1 * 4", new Date("2026-10-21T08:00:00Z"), "UTC").toISOString(),
    "2026-10-22T08:00:00.000Z",
  );
});
