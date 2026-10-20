import { test } from "node:test";
import assert from "node:assert/strict";
import { nextRoutineOccurrences } from "../../../packages/email-agent-runtime/src/routines/time";

test("daily 09:00 in Kolkata retains the selected wall time", () => {
  const result = nextRoutineOccurrences({
    kind: "calendar", cadence: "daily", localTime: "09:00", weekday: null, timeZone: "Asia/Kolkata",
  }, "2026-10-20T00:00:00Z");
  assert.deepEqual(result.map((item) => item.fireAt), [
    "2026-10-20T03:30:00.000Z", "2026-10-21T03:30:00.000Z", "2026-10-22T03:30:00.000Z",
  ]);
  assert.ok(result.every((item) => item.offsetMinutes === 330 && item.localTime.endsWith("09:00")));
});

test("daily local schedule follows DST while elapsed 24-hour interval does not", () => {
  const after = "2026-03-06T18:00:00Z";
  const calendar = nextRoutineOccurrences({
    kind: "calendar", cadence: "daily", localTime: "09:00", weekday: null, timeZone: "America/New_York",
  }, after);
  assert.deepEqual(calendar.map((item) => item.fireAt), [
    "2026-03-07T14:00:00.000Z", "2026-03-08T13:00:00.000Z", "2026-03-09T13:00:00.000Z",
  ]);
  const interval = nextRoutineOccurrences({
    kind: "interval", everyMinutes: 1440, anchorAt: "2026-03-07T14:00:00Z",
  }, after);
  assert.deepEqual(interval.map((item) => item.fireAt), [
    "2026-03-07T14:00:00.000Z", "2026-03-08T14:00:00.000Z", "2026-03-09T14:00:00.000Z",
  ]);
});

test("nonexistent spring-forward local time is skipped, not silently moved", () => {
  const result = nextRoutineOccurrences({
    kind: "calendar", cadence: "daily", localTime: "02:30", weekday: null, timeZone: "America/New_York",
  }, "2026-03-07T08:00:00Z");
  assert.deepEqual(result.map((item) => item.fireAt), [
    "2026-03-09T06:30:00.000Z", "2026-03-10T06:30:00.000Z", "2026-03-11T06:30:00.000Z",
  ]);
});

test("repeated fall-back local time fires once at the first instant", () => {
  const trigger = {
    kind: "calendar" as const, cadence: "daily" as const, localTime: "01:30",
    weekday: null, timeZone: "America/New_York",
  };
  assert.equal(nextRoutineOccurrences(trigger, "2026-10-31T06:00:00Z")[0]?.fireAt, "2026-11-01T05:30:00.000Z");
  assert.equal(nextRoutineOccurrences(trigger, "2026-11-01T05:40:00Z")[0]?.fireAt, "2026-11-02T06:30:00.000Z");
});

test("weekly Monday follows ISO weekday and year boundary", () => {
  const result = nextRoutineOccurrences({
    kind: "calendar", cadence: "weekly", localTime: "09:00", weekday: 1, timeZone: "UTC",
  }, "2026-12-31T12:00:00Z");
  assert.deepEqual(result.map((item) => item.fireAt), [
    "2027-01-04T09:00:00.000Z", "2027-01-11T09:00:00.000Z", "2027-01-18T09:00:00.000Z",
  ]);
});

test("one-off schedules require explicit offset and only show future fire", () => {
  const once = { kind: "once" as const, fireAt: "2026-10-21T09:00:00+05:30", timeZone: "Asia/Kolkata" };
  assert.deepEqual(nextRoutineOccurrences(once, "2026-10-20T00:00:00Z").map((item) => item.fireAt), [
    "2026-10-21T03:30:00.000Z",
  ]);
  assert.deepEqual(nextRoutineOccurrences(once, "2026-10-21T03:30:00Z"), []);
  assert.throws(() => nextRoutineOccurrences({ ...once, fireAt: "2026-10-21T09:00:00" }, "2026-10-20T00:00:00Z"), /offset/i);
});

test("invalid schedule inputs are rejected without consulting ambient clock", () => {
  assert.throws(() => nextRoutineOccurrences({
    kind: "interval", everyMinutes: 30, anchorAt: "2026-01-01T00:00:00Z",
  }, "2026-01-01T00:00:00Z"), /60/);
  assert.throws(() => nextRoutineOccurrences({
    kind: "calendar", cadence: "weekly", localTime: "25:00", weekday: 1, timeZone: "UTC",
  }, "2026-01-01T00:00:00Z"), /time/i);
  assert.throws(() => nextRoutineOccurrences({
    kind: "calendar", cadence: "weekly", localTime: "09:00", weekday: 0, timeZone: "UTC",
  }, "2026-01-01T00:00:00Z"), /weekday/i);
  assert.throws(() => nextRoutineOccurrences({
    kind: "calendar", cadence: "daily", localTime: "09:00", weekday: null, timeZone: "Not/A_Zone",
  }, "2026-01-01T00:00:00Z"), /zone/i);
  assert.throws(() => nextRoutineOccurrences({
    kind: "once", fireAt: "2026-02-30T09:00:00Z", timeZone: "UTC",
  }, "2026-01-01T00:00:00Z"), /date/i);
  assert.throws(() => nextRoutineOccurrences({
    kind: "event", eventType: "email.received", conditions: {}, debounceMinutes: 15,
  }, "2026-01-01T00:00:00Z"), /event/i);
  assert.throws(() => nextRoutineOccurrences({
    kind: "interval", everyMinutes: 60, anchorAt: "2026-01-01T00:00:00Z",
  }, "invalid"), /instant/i);
});
