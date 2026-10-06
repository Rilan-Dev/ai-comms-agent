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
