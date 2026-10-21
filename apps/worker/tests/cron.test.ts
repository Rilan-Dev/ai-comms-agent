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
