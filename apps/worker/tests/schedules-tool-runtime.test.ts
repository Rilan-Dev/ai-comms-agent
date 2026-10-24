import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRecurrencePlan, SCHEDULED_AGENT_TASK_INTENT } from "../src/agent/schedules-tool-runtime";
import { nextCronFire } from "../src/scheduling/cron";

const HERE = dirname(fileURLToPath(import.meta.url));

const FIXED_NOW = new Date("2026-10-25T10:00:00.000Z");

function plan(input: { recurrence?: unknown; oneFireAt?: unknown; timezone?: string }) {
  return buildRecurrencePlan({
    recurrence: input.recurrence,
    oneFireAt: input.oneFireAt,
    timezone: input.timezone ?? "UTC",
    now: FIXED_NOW,
  });
}

test("SCHEDULED_AGENT_TASK_INTENT is stable for scheduler routing", () => {
  assert.equal(SCHEDULED_AGENT_TASK_INTENT, "scheduled_agent_task");
});

test("minutes preset maps to an every-N-minutes cron", () => {
  assert.deepEqual(plan({ recurrence: { mode: "minutes", interval: 5 } }), { kind: "cron", cron: "*/5 * * * *" });
  assert.deepEqual(plan({ recurrence: { mode: "minutes", interval: 1 } }), { kind: "cron", cron: "*/1 * * * *" });
});

test("minutes preset rejects out-of-range intervals", () => {
  assert.equal(plan({ recurrence: { mode: "minutes", interval: 0 } }).kind, "invalid");
  assert.equal(plan({ recurrence: { mode: "minutes", interval: 60 } }).kind, "invalid");
  assert.equal(plan({ recurrence: { mode: "minutes", interval: 2.5 } }).kind, "invalid");
  assert.equal(plan({ recurrence: { mode: "minutes" } }).kind, "invalid");
});

test("hours preset maps to an every-N-hours cron", () => {
  assert.deepEqual(plan({ recurrence: { mode: "hours", interval: 6 } }), { kind: "cron", cron: "0 */6 * * *" });
  assert.equal(plan({ recurrence: { mode: "hours", interval: 24 } }).kind, "invalid");
});

test("daily preset maps time of day to cron and defaults to 08:00", () => {
  assert.deepEqual(plan({ recurrence: { mode: "daily", time: "18:30" } }), { kind: "cron", cron: "30 18 * * *" });
  assert.deepEqual(plan({ recurrence: { mode: "daily" } }), { kind: "cron", cron: "00 08 * * *" });
});

test("weekly preset maps weekday and time to cron", () => {
  assert.deepEqual(plan({ recurrence: { mode: "weekly", weekday: 0, time: "09:15" } }), { kind: "cron", cron: "15 09 * * 0" });
  assert.deepEqual(plan({ recurrence: { mode: "weekly" } }), { kind: "cron", cron: "00 08 * * 1" });
  assert.equal(plan({ recurrence: { mode: "weekly", weekday: 7 } }).kind, "invalid");
});

test("monthly preset maps day of month and time to cron", () => {
  assert.deepEqual(plan({ recurrence: { mode: "monthly", day_of_month: 15, time: "07:05" } }), { kind: "cron", cron: "05 07 15 * *" });
  assert.equal(plan({ recurrence: { mode: "monthly", day_of_month: 29 } }).kind, "invalid");
});

test("raw cron preset passes validated five-field cron through", () => {
  assert.deepEqual(plan({ recurrence: { mode: "cron", cron: "*/15 9-17 * * 1-5" } }), { kind: "cron", cron: "*/15 9-17 * * 1-5" });
  assert.equal(plan({ recurrence: { mode: "cron", cron: "* * * *" } }).kind, "invalid");
  assert.equal(plan({ recurrence: { mode: "cron", cron: "99 * * * *" } }).kind, "invalid");
});

test("one-time fire requires a future ISO date-time", () => {
  const future = plan({ oneFireAt: "2026-10-25T10:05:00.000Z" });
  assert.equal(future.kind, "one_time");
  if (future.kind === "one_time") assert.equal(future.oneFireAt, "2026-10-25T10:05:00.000Z");
  assert.equal(plan({ oneFireAt: "2026-10-25T10:00:10.000Z" }).kind, "invalid");
  assert.equal(plan({ oneFireAt: "not-a-date" }).kind, "invalid");
});

test("exactly one of recurrence or one-time fire is required", () => {
  assert.equal(plan({ recurrence: { mode: "daily" }, oneFireAt: "2026-10-26T10:00:00.000Z" }).kind, "invalid");
  assert.equal(plan({}).kind, "invalid");
  assert.equal(plan({ recurrence: "daily" }).kind, "invalid");
  assert.equal(plan({ recurrence: { mode: "unknown" } }).kind, "invalid");
});

test("every preset cron actually fires through the shared cron engine", () => {
  for (const cron of ["*/5 * * * *", "0 */6 * * *", "30 18 * * *", "15 9 * * 0", "5 7 15 * *", "*/15 9-17 * * 1-5"]) {
    const fire = nextCronFire(cron, FIXED_NOW, "UTC");
    assert.ok(fire.getTime() > FIXED_NOW.getTime(), `cron ${cron} must fire after now`);
  }
});

test("scheduler worker routes scheduled_agent_task jobs to the real tool loop", () => {
  const source = readFileSync(resolve(HERE, "../src/scheduling/scheduler-worker.ts"), "utf8");
  assert.ok(source.includes("runScheduledAgentTask"));
  assert.ok(source.includes("SCHEDULED_AGENT_TASK_INTENT"));
  // Legacy intents keep the prompt-only dispatcher.
  assert.ok(source.includes("dispatchAgentExecution"));
});

test("scheduled agent runtime grants least-privilege permissions from the agent policy", () => {
  const source = readFileSync(resolve(HERE, "../src/agent/scheduled-agent-runtime.ts"), "utf8");
  assert.ok(source.includes('channel: "schedule"'));
  assert.ok(source.includes("permissions"));
  assert.ok(source.includes("listForAgent(args.agentId)"));
  // The scheduled loop never registers scheduling tools, so a task cannot
  // silently clone or reschedule itself.
  assert.equal(source.includes("createSchedulesToolRuntime"), false);
});

test("scheduled runs attribute sends and audits to the schedule creator", () => {
  const runtime = readFileSync(resolve(HERE, "../src/agent/scheduled-agent-runtime.ts"), "utf8");
  assert.ok(runtime.includes("userId?: string | null"));
  assert.ok(runtime.includes("user_id: actingUserId"));
  const scheduler = readFileSync(resolve(HERE, "../src/scheduling/scheduler-worker.ts"), "utf8");
  assert.ok(scheduler.includes("userId:job.createdBy"));
  const repository = readFileSync(resolve(HERE, "../../../packages/db/src/automation/repository.ts"), "utf8");
  assert.ok(repository.includes("createdBy:string|null"));
  assert.ok(repository.includes("row.created_by?String(row.created_by):null"));
});

test("chat runtime wires the schedules tool surface", () => {
  const source = readFileSync(resolve(HERE, "../../web/src/app/api/chat/stream/route.ts"), "utf8");
  assert.ok(source.includes("createSchedulesToolRuntime"));
  assert.ok(source.includes('call.name.startsWith("schedules.")'));
});

test("schedules tool runtime registers all four CRUD tools", () => {
  const source = readFileSync(resolve(HERE, "../src/agent/schedules-tool-runtime.ts"), "utf8");
  for (const tool of ["schedules.list", "schedules.create", "schedules.update", "schedules.delete"]) {
    assert.ok(source.includes(`name: "${tool}"`), `tool ${tool} must be registered`);
  }
  assert.ok(source.includes('"schedules.read"'));
  assert.ok(source.includes('"schedules.manage"'));
});
