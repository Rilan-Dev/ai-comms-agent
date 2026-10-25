import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildRecurrencePlan, resolveScheduleReference, SCHEDULED_AGENT_TASK_INTENT } from "../src/agent/schedules-tool-runtime";
import { nextCronFire } from "../src/scheduling/cron";

const HERE = dirname(fileURLToPath(import.meta.url));

const FIXED_NOW = new Date("2026-10-25T10:00:00.000Z");

const job = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
  id, agentId: "agent-1", name, cron: "*/5 * * * *", oneFireAt: null,
  intent: SCHEDULED_AGENT_TASK_INTENT, params: { task: "summarize email" }, status: "active",
  timezone: "UTC", nextFireAt: null, lastFireAt: null, lastError: null, catchUpMinutes: 60,
  ...overrides,
});

test("resolveScheduleReference accepts the quoted task name the user actually said (live regression: delete 'Daily evening digest' rejected as invalid_input)", async () => {
  const digest = job("b6439111-1aa6-47aa-a293-8e545d5ca617", "Daily evening digest");
  const resolution = await resolveScheduleReference("org-1", "  'Daily evening digest' ", {
    listScheduledJobs: async () => [job("11111111-1111-4111-8111-111111111111", "Morning brief"), digest],
  });
  assert.equal(resolution.ok, true);
  if (resolution.ok) assert.equal(resolution.job.id, digest.id);
});

test("resolveScheduleReference matches names case-insensitively", async () => {
  const resolution = await resolveScheduleReference("org-1", "daily evening DIGEST", {
    listScheduledJobs: async () => [job("b6439111-1aa6-47aa-a293-8e545d5ca617", "Daily evening digest")],
  });
  assert.equal(resolution.ok, true);
});

test("resolveScheduleReference resolves exact UUIDs through getScheduledJob", async () => {
  const digest = job("b6439111-1aa6-47aa-a293-8e545d5ca617", "Daily evening digest");
  let asked = "";
  const resolution = await resolveScheduleReference("org-1", "b6439111-1aa6-47aa-a293-8e545d5ca617", {
    getScheduledJob: async (_org: string, id: string) => { asked = id; return digest; },
  });
  assert.equal(asked, "b6439111-1aa6-47aa-a293-8e545d5ca617");
  assert.equal(resolution.ok, true);
  const missing = await resolveScheduleReference("org-1", "00000000-0000-4000-8000-000000000000", {
    getScheduledJob: async () => null,
  });
  assert.equal(missing.ok, false);
  if (!missing.ok) assert.equal(missing.code, "not_found");
});

test("resolveScheduleReference rejects unknown and ambiguous names with actionable messages", async () => {
  const unknown = await resolveScheduleReference("org-1", "No such task", {
    listScheduledJobs: async () => [job("b6439111-1aa6-47aa-a293-8e545d5ca617", "Daily evening digest")],
  });
  assert.equal(unknown.ok, false);
  if (!unknown.ok) {
    assert.equal(unknown.code, "not_found");
    assert.match(unknown.message, /schedules\.list/);
  }
  const ambiguous = await resolveScheduleReference("org-1", "Digest", {
    listScheduledJobs: async () => [job("b6439111-1aa6-47aa-a293-8e545d5ca617", "Digest"), job("22222222-2222-4222-8222-222222222222", "digest")],
  });
  assert.equal(ambiguous.ok, false);
  if (!ambiguous.ok) assert.equal(ambiguous.code, "ambiguous_name");
});

test("resolveScheduleReference ignores archived tasks when matching names and requires a reference", async () => {
  const archivedOnly = await resolveScheduleReference("org-1", "Daily evening digest", {
    listScheduledJobs: async () => [job("b6439111-1aa6-47aa-a293-8e545d5ca617", "Daily evening digest", { status: "archived" })],
  });
  assert.equal(archivedOnly.ok, false);
  if (!archivedOnly.ok) assert.equal(archivedOnly.code, "not_found");
  const empty = await resolveScheduleReference("org-1", "   ");
  assert.equal(empty.ok, false);
});

test("schedules.delete and schedules.update accept name references in their input schema", () => {
  const source = readFileSync(resolve(HERE, "../src/agent/schedules-tool-runtime.ts"), "utf8");
  assert.equal((source.match(/minLength: 36, maxLength: 36/g) ?? []).length, 0, "no schedule tool field may require a bare 36-char UUID anymore");
  assert.ok(source.includes("resolveScheduleReference(context.organization_id"), "both delete and update must resolve references");
  assert.ok((source.match(/resolveScheduleReference\(context\.organization_id/g) ?? []).length >= 2, "delete and update each resolve the reference");
});

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

test("advanceScheduledJob CAS tolerates microsecond updated_at precision", () => {
  // Regression: the claim snapshot is a JS Date (milliseconds) while
  // PostgreSQL updated_at carries microseconds. An exact equality CAS
  // matched zero rows, so recurring schedules fired once and silently died
  // and one-time schedules never archived. The CAS must compare within the
  // same millisecond.
  const repository = readFileSync(resolve(HERE, "../../../packages/db/src/automation/repository.ts"), "utf8");
  const start = repository.indexOf("export async function advanceScheduledJob");
  const body = repository.slice(start, repository.indexOf("export async function completeScheduledJobRun"));
  assert.ok(body.includes("updated_at >= $4::timestamptz"), "advance CAS must use a lower-bound comparison");
  assert.ok(body.includes("updated_at < $4::timestamptz + interval '1 millisecond'"), "advance CAS must bound the revision to one millisecond");
  assert.equal(body.includes("updated_at=$4::timestamptz AND"), false, "exact equality on a millisecond snapshot can never match microsecond timestamps");
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
