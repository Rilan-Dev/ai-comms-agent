import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

const read = (name) => readFileSync(new URL(name, import.meta.url), "utf8");

test("preview reuses the canonical routine clock and never owns another scheduler", () => {
  const page = read("../src/app/routines/preview/page.tsx");
  assert.match(page, /nextRoutineOccurrences\(trigger, now, 3\)/);
  assert.match(page, /from "@ai-comms-agent\/email-agent-runtime\/routines\/time"/);
  assert.doesNotMatch(page, /createScheduledJob|createAutomationRule|saveRoutine|sendWhatsApp|fetch\(/);
  assert.match(page, /export default async function RoutinePreviewPage/);
});

test("calendar 09:00 local and every 24 elapsed hours are separate explicit choices", () => {
  const page = read("../src/app/routines/preview/page.tsx");
  assert.match(page, /kind === "daily"/);
  assert.match(page, /kind === "weekly"/);
  assert.match(page, /kind === "interval"/);
  assert.match(page, /everyMinutes: 1440/);
  assert.match(page, /cadence: kind === "weekly" \? "weekly" : "daily"/);
  assert.match(page, /name="timeZone"/);
  assert.match(page, /name="localTime"/);
  assert.match(page, /name="weekday"/);
  assert.match(page, /name="fireAt"/);
  assert.match(page, /name="kind"/);
  assert.match(page, /different time through daylight-saving changes/);
});

test("preview accepts bounded inputs, rejects bad zones, and labels every outcome non-executable", () => {
  const page = read("../src/app/routines/preview/page.tsx");
  assert.match(page, /boundedParam\(/);
  assert.match(page, /A valid IANA time zone is required/);
  assert.match(page, /preview only — nothing saved or sent/i);
  assert.match(page, /event-triggered routines do not have fixed occurrence times/i);
  assert.match(page, /These times are estimates for planning/i);
  assert.match(page, /getAuthenticatedAppContext/);
  assert.match(page, /redirect\("\/login\?reason=not_provisioned"\)/);
  assert.match(page, /<form method="get"/);
  assert.doesNotMatch(page, /<form method="post"/i);
});

test("Overview offers a safe timing preview ahead of direct Schedules/Automations links", () => {
  const overview = read("../src/app/overview/page.tsx");
  const section = overview.slice(overview.indexOf("03 · Plan"), overview.indexOf("</article>", overview.indexOf("03 · Plan")));
  assert.match(section, /href="\/routines\/preview"/);
  assert.match(section, /href="\/schedules"/);
  assert.match(section, /href="\/automations"/);
  assert.match(section, /New AI digest routines are not yet activated/);
});

test("future send/standing-consent remains behind an independent approval gate", () => {
  const page = read("../src/app/routines/preview/page.tsx");
  assert.match(page, /WhatsApp delivery needs a separate consent and provider approval/);
  assert.match(page, /human approval/);
  assert.doesNotMatch(page, /"use server"|serverAction|action=\{/);
});
