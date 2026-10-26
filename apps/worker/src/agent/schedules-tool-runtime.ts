import { PostgresAgentRepository, createScheduledJob, deleteScheduledJob, getScheduledJob, listScheduledJobs, recordAuditEvent, updateScheduledJob,assertCurrentAgentToolAuthorization } from "@ai-comms-agent/db";
import { ToolRegistry, nextCronFire,turnAllowsTool } from "@ai-comms-agent/shared";
import type { Tool, ToolContext, ToolResult } from "@ai-comms-agent/shared";
import { executeRegisteredTool } from "./tool-executor";
import type { ToolAuthorizationDecision, ToolAuditWriter } from "./tool-executor";

/**
 * Scheduled AI agent tools.
 *
 * The agent gets full control of its own durable schedules through four
 * host-authorized tools: list, create, update and delete. Schedules created
 * here store a natural-language task instruction (params.task) that the
 * scheduler worker executes with the full agent tool loop (email read/write,
 * WhatsApp send) at each fire.
 */

export const SCHEDULED_AGENT_TASK_INTENT = "scheduled_agent_task";

const SCHEDULE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ScheduledJobRecord = {
  id: string; agentId: string; name: string; cron: string | null; oneFireAt: string | null;
  intent: string; params: Record<string, unknown>; status: string; timezone: string;
  nextFireAt: string | null; lastFireAt: string | null; lastError: string | null; catchUpMinutes: number;
};

export type ScheduleReferenceResolution =
  | { ok: true; job: ScheduledJobRecord }
  | { ok: false; code: "not_found" | "ambiguous_name"; message: string };

/** Resolve a schedule reference that is either the exact UUID (from
 * schedules.list) or the task's name — quoted, trimmed, case-insensitive —
 * matching exactly one active schedule. Models routinely reference schedules
 * by the name the user quoted ("delete the 'Daily evening digest' task");
 * rejecting those references as invalid_input forced visible self-correction
 * loops and contradictory chat replies. */
export async function resolveScheduleReference(
  organizationId: string,
  reference: string,
  lookups: {
    getScheduledJob?: (organizationId: string, id: string) => Promise<ScheduledJobRecord | null>;
    listScheduledJobs?: (organizationId: string) => Promise<ScheduledJobRecord[]>;
  } = {},
): Promise<ScheduleReferenceResolution> {
  const trimmed = String(reference ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!trimmed) {
    return { ok: false, code: "not_found", message: "A schedule reference is required: pass the exact UUID from schedules.list or the task name." };
  }
  if (SCHEDULE_ID_PATTERN.test(trimmed)) {
    const job = await (lookups.getScheduledJob ?? getScheduledJob)(organizationId, trimmed);
    if (!job) {
      return { ok: false, code: "not_found", message: "No scheduled task with that ID exists in this organization. Call schedules.list and use the returned id." };
    }
    return { ok: true, job: job as ScheduledJobRecord };
  }
  const jobs = await (lookups.listScheduledJobs ?? listScheduledJobs)(organizationId);
  const wanted = trimmed.toLowerCase();
  const matches = jobs.filter((job) => job.status !== "archived" && job.name.toLowerCase() === wanted);
  if (matches.length === 0) {
    return { ok: false, code: "not_found", message: `No active scheduled task is named "${trimmed.slice(0, 120)}". Call schedules.list and use the returned id or the exact task name.` };
  }
  if (matches.length > 1) {
    return { ok: false, code: "ambiguous_name", message: `Multiple active scheduled tasks are named "${trimmed.slice(0, 120)}"; pass the exact UUID from schedules.list.` };
  }
  return { ok: true, job: matches[0] as ScheduledJobRecord };
}

type RecurrenceMode = "minutes" | "hours" | "daily" | "weekly" | "monthly" | "cron";
type Recurrence = { mode: RecurrenceMode; interval?: number; time?: string; weekday?: number; day_of_month?: number; cron?: string };

export type RecurrencePlan =
  | { kind: "cron"; cron: string }
  | { kind: "one_time"; oneFireAt: string }
  | { kind: "invalid"; reason: string };

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

function parseTimeOfDay(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== "string" || !/^\d{1,2}:\d{2}$/.test(value.trim())) return null;
  const [hourRaw, minuteRaw] = value.trim().split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function validTimezone(timezone: unknown): timezone is string {
  if (typeof timezone !== "string" || !timezone.trim() || timezone.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function validCron(cron: string, timezone: string): boolean {
  if (cron.split(/\s+/).length !== 5) return false;
  try {
    nextCronFire(cron, new Date(), timezone);
    return true;
  } catch {
    return false;
  }
}

/** Deterministically translate a recurrence preset into a 5-field cron
 * expression. Every supported preset (minutes, hours, daily, weekly, monthly
 * and raw cron) funnels through the same validated cron engine used by the
 * scheduler worker, so previews and executions cannot drift. */
export function buildRecurrencePlan(input: {
  recurrence?: unknown;
  oneFireAt?: unknown;
  timezone: string;
  now?: Date;
}): RecurrencePlan {
  const now = input.now ?? new Date();
  const hasRecurrence = input.recurrence !== undefined && input.recurrence !== null;
  const hasOneFire = typeof input.oneFireAt === "string" && input.oneFireAt.trim();
  if (hasRecurrence && hasOneFire) return { kind: "invalid", reason: "Provide either a recurrence or a one-time fire time, not both." };
  if (!hasRecurrence && !hasOneFire) return { kind: "invalid", reason: "A recurrence (minutes, hours, daily, weekly, monthly or cron) or a one-time fire time is required." };
  if (hasOneFire) {
    const fire = new Date(String(input.oneFireAt));
    if (Number.isNaN(fire.getTime())) return { kind: "invalid", reason: "one_fire_at must be an ISO 8601 date-time." };
    if (fire.getTime() <= now.getTime() + 30_000) return { kind: "invalid", reason: "The one-time fire time must be at least 30 seconds in the future." };
    return { kind: "one_time", oneFireAt: fire.toISOString() };
  }
  const raw = input.recurrence;
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return { kind: "invalid", reason: "recurrence must be an object." };
  const recurrence = raw as Record<string, unknown>;
  const mode = recurrence.mode;
  if (typeof mode !== "string" || !["minutes", "hours", "daily", "weekly", "monthly", "cron"].includes(mode)) {
    return { kind: "invalid", reason: "recurrence.mode must be one of minutes, hours, daily, weekly, monthly or cron." };
  }
  if (mode === "cron") {
    const cron = typeof recurrence.cron === "string" ? recurrence.cron.trim() : "";
    if (!validCron(cron, input.timezone)) return { kind: "invalid", reason: "recurrence.cron must be a valid five-field cron expression that fires within a year." };
    return { kind: "cron", cron };
  }
  if (mode === "minutes") {
    const interval = recurrence.interval;
    if (!Number.isInteger(interval) || (interval as number) < 1 || (interval as number) > 59) return { kind: "invalid", reason: "minutes recurrence requires an interval between 1 and 59." };
    return { kind: "cron", cron: `*/${interval} * * * *` };
  }
  if (mode === "hours") {
    const interval = recurrence.interval;
    if (!Number.isInteger(interval) || (interval as number) < 1 || (interval as number) > 23) return { kind: "invalid", reason: "hours recurrence requires an interval between 1 and 23." };
    return { kind: "cron", cron: `0 */${interval} * * *` };
  }
  const time = parseTimeOfDay(recurrence.time ?? "08:00");
  if (!time) return { kind: "invalid", reason: "recurrence.time must be a 24-hour HH:MM local time." };
  if (mode === "daily") return { kind: "cron", cron: `${pad2(time.minute)} ${pad2(time.hour)} * * *` };
  if (mode === "weekly") {
    const weekday = recurrence.weekday === undefined ? 1 : recurrence.weekday;
    if (!Number.isInteger(weekday) || (weekday as number) < 0 || (weekday as number) > 6) return { kind: "invalid", reason: "recurrence.weekday must be 0 (Sunday) through 6 (Saturday)." };
    return { kind: "cron", cron: `${pad2(time.minute)} ${pad2(time.hour)} * * ${weekday}` };
  }
  const dayOfMonth = recurrence.day_of_month === undefined ? 1 : recurrence.day_of_month;
  if (!Number.isInteger(dayOfMonth) || (dayOfMonth as number) < 1 || (dayOfMonth as number) > 28) return { kind: "invalid", reason: "recurrence.day_of_month must be between 1 and 28." };
  return { kind: "cron", cron: `${pad2(time.minute)} ${pad2(time.hour)} ${dayOfMonth} * *` };
}

type ScheduleRow = {
  id: string; agentId: string; name: string; cron: string | null; oneFireAt: string | null;
  task: string | null; status: string; timezone: string; nextFireAt: string | null;
  lastFireAt: string | null; lastError: string | null;
};

function describeSchedule(job: {
  id: string; agentId: string; name: string; cron: string | null; oneFireAt: string | null;
  intent: string; params: Record<string, unknown>; status: string; timezone: string;
  nextFireAt: string | null; lastFireAt: string | null; lastError: string | null;
}): ScheduleRow {
  const task = typeof job.params?.task === "string" ? job.params.task : null;
  return {
    id: job.id, agentId: job.agentId, name: job.name, cron: job.cron, oneFireAt: job.oneFireAt,
    task, status: job.status, timezone: job.timezone, nextFireAt: job.nextFireAt,
    lastFireAt: job.lastFireAt, lastError: job.lastError,
  };
}

function humanSummary(row: ScheduleRow): string {
  if (row.cron) return `repeats (${row.cron}) in ${row.timezone}`;
  if (row.oneFireAt) return `one-time at ${row.oneFireAt} (${row.timezone})`;
  return "no fire time";
}

function toolResult(toolName: string, startedAt: number, output: unknown, error?: { code: string; message: string; retryable: boolean }): ToolResult<any> {
  return {
    ok: !error,
    ...(output === undefined ? {} : { output }),
    ...(error ? { error } : {}),
    audit: {
      tool_name: toolName,
      input_summary: toolName,
      output_summary: error ? error.code : `${toolName} ok`,
      duration_ms: Math.max(0, Date.now() - startedAt),
    },
  };
}

function fail(toolName: string, startedAt: number, code: string, message: string): ToolResult<any> {
  return toolResult(toolName, startedAt, undefined, { code, message, retryable: false });
}

function createSchedulesListTool(): Tool<Record<string, never>, { schedules: ScheduleRow[] }> {
  return {
    name: "schedules.list",
    domain: "schedule",
    description: "List this organization's scheduled AI agent tasks, including each task's instruction, repeat rule (cron), next fire time and status. Read-only.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
    sensitivity: "safe",
    required_permission: "schedules.read",
    execute: async (_input, context) => {
      const startedAt = Date.now();
      if (!context.auth_subject.permissions.includes("schedules.read")) {
        return fail("schedules.list", startedAt, "permission_denied", "The current actor cannot list schedules.");
      }
      const jobs = await listScheduledJobs(context.organization_id);
      const rows = jobs.filter((job) => job.status !== "archived").map(describeSchedule);
      return toolResult("schedules.list", startedAt, { schedules: rows });
    },
    timeout_ms: 5000, retryable: true, idempotent: true,
  };
}

type CreateInput = {
  name: string;
  task: string;
  recurrence?: Recurrence;
  one_fire_at?: string | null;
  timezone?: string;
};

function createSchedulesCreateTool(now: () => Date = () => new Date()): Tool<CreateInput, { schedule: ScheduleRow; summary: string }> {
  return {
    name: "schedules.create",
    domain: "schedule",
    description: "Create a scheduled AI agent task. At every fire time the agent executes the task instruction with its real tools (for example: summarize the last 24 hours of email and send a short WhatsApp note). Provide a natural-language task plus exactly one of: a recurrence preset (minutes, hours, daily, weekly, monthly or raw cron) or a one-time ISO date-time. Always pass the user's timezone when they name one (IANA name like Asia/Calcutta); it defaults to UTC. Recurrence times are local to that timezone.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", minLength: 1, maxLength: 120 },
        task: { type: "string", minLength: 1, maxLength: 4000 },
        recurrence: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["minutes", "hours", "daily", "weekly", "monthly", "cron"] },
            interval: { type: "integer", minimum: 1, maximum: 59 },
            time: { type: "string", minLength: 4, maxLength: 5 },
            weekday: { type: "integer", minimum: 0, maximum: 6 },
            day_of_month: { type: "integer", minimum: 1, maximum: 28 },
            cron: { type: "string", minLength: 9, maxLength: 64 },
          },
          required: ["mode"],
          additionalProperties: false,
        },
        one_fire_at: { type: "string", minLength: 16, maxLength: 40 },
        timezone: { type: "string", minLength: 1, maxLength: 64 },
      },
      required: ["name", "task"],
      additionalProperties: false,
    },
    sensitivity: "sensitive",
    required_permission: "schedules.manage",
    execute: async (input, context) => {
      const startedAt = Date.now();
      if (!context.auth_subject.permissions.includes("schedules.manage")) {
        return fail("schedules.create", startedAt, "permission_denied", "The current actor cannot create schedules.");
      }
      const timezone = validTimezone(input.timezone) ? input.timezone : "UTC";
      const plan = buildRecurrencePlan({ recurrence: input.recurrence, oneFireAt: input.one_fire_at, timezone, now: now() });
      if (plan.kind === "invalid") return fail("schedules.create", startedAt, "invalid_schedule", plan.reason);
      const job = await createScheduledJob({
        organizationId: context.organization_id,
        agentId: context.agent_id,
        userId: context.user_id,
        name: input.name.trim().slice(0, 120),
        cron: plan.kind === "cron" ? plan.cron : null,
        oneFireAt: plan.kind === "one_time" ? plan.oneFireAt : null,
        intent: SCHEDULED_AGENT_TASK_INTENT,
        params: { task: input.task.trim().slice(0, 4000) },
        timezone,
        catchUpMinutes: 60,
      });
      if (!job) return fail("schedules.create", startedAt, "agent_not_found", "The current agent no longer exists in this organization.");
      await recordAuditEvent({
        organizationId: context.organization_id,
        actorUserId: context.user_id,
        agentId: context.agent_id,
        eventType: "schedule.created",
        targetType: "scheduled_job",
        targetId: job.id,
        action: "create",
        decision: "allowed",
        correlationId: context.correlation_id,
        metadata: { source: "agent_tool", tool: "schedules.create", cron: job.cron, oneFireAt: job.oneFireAt, timezone },
      }).catch(() => undefined);
      const row = describeSchedule(job);
      return toolResult("schedules.create", startedAt, { schedule: row, summary: `Scheduled task "${row.name}" created; ${humanSummary(row)}; next fire ${row.nextFireAt ?? "pending"}.` });
    },
    timeout_ms: 8000, retryable: false, idempotent: false,
  };
}

type UpdateInput = {
  id: string;
  name?: string;
  task?: string;
  recurrence?: Recurrence;
  one_fire_at?: string;
  timezone?: string;
  status?: "active" | "paused";
};

function createSchedulesUpdateTool(now: () => Date = () => new Date()): Tool<UpdateInput, { schedule: ScheduleRow; summary: string }> {
  return {
    name: "schedules.update",
    domain: "schedule",
    description: "Edit an existing scheduled AI agent task: rename it, rewrite its task instruction, change its repeat rule or one-time fire time, change timezone, or pause/resume it (status active|paused). Omitted fields keep their current values. Pass the schedule's id — the exact UUID from schedules.list — or the task's exact unique name (for example 'Daily evening digest').",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1, maxLength: 120, description: "Schedule UUID from schedules.list, or the task's exact unique name." },
        name: { type: "string", minLength: 1, maxLength: 120 },
        task: { type: "string", minLength: 1, maxLength: 4000 },
        recurrence: {
          type: "object",
          properties: {
            mode: { type: "string", enum: ["minutes", "hours", "daily", "weekly", "monthly", "cron"] },
            interval: { type: "integer", minimum: 1, maximum: 59 },
            time: { type: "string", minLength: 4, maxLength: 5 },
            weekday: { type: "integer", minimum: 0, maximum: 6 },
            day_of_month: { type: "integer", minimum: 1, maximum: 28 },
            cron: { type: "string", minLength: 9, maxLength: 64 },
          },
          required: ["mode"],
          additionalProperties: false,
        },
        one_fire_at: { type: "string", minLength: 16, maxLength: 40 },
        timezone: { type: "string", minLength: 1, maxLength: 64 },
        status: { type: "string", enum: ["active", "paused"] },
      },
      required: ["id"],
      additionalProperties: false,
    },
    sensitivity: "sensitive",
    required_permission: "schedules.manage",
    execute: async (input, context) => {
      const startedAt = Date.now();
      if (!context.auth_subject.permissions.includes("schedules.manage")) {
        return fail("schedules.update", startedAt, "permission_denied", "The current actor cannot edit schedules.");
      }
      const resolution = await resolveScheduleReference(context.organization_id, String(input.id ?? ""));
      if (!resolution.ok) {
        return fail("schedules.update", startedAt, resolution.code, resolution.message);
      }
      const existing = resolution.job;
      if (existing.status === "archived") {
        return fail("schedules.update", startedAt, "not_found", "No active schedule with that reference exists in this organization.");
      }
      if (existing.agentId !== context.agent_id) {
        return fail("schedules.update", startedAt, "agent_mismatch", "This schedule belongs to a different agent.");
      }
      const timezone = input.timezone === undefined ? existing.timezone : (validTimezone(input.timezone) ? input.timezone : "");
      if (input.timezone !== undefined && !timezone) {
        return fail("schedules.update", startedAt, "invalid_schedule", "timezone must be a valid IANA time zone.");
      }
      const currentTask = typeof existing.params?.task === "string" ? existing.params.task : existing.intent;
      const nextTask = input.task !== undefined ? input.task.trim().slice(0, 4000) : currentTask;
      const nextName = input.name !== undefined ? input.name.trim().slice(0, 120) : existing.name;
      // A schedule may be paused/resumed without touching its fire plan.
      const planTouched = input.recurrence !== undefined || input.one_fire_at !== undefined;
      const plan = planTouched
        ? buildRecurrencePlan({ recurrence: input.recurrence, oneFireAt: input.one_fire_at, timezone, now: now() })
        : { kind: "cron" as const, cron: existing.cron ?? "" };
      if (plan.kind === "invalid") return fail("schedules.update", startedAt, "invalid_schedule", plan.reason);
      const cron = planTouched && plan.kind === "cron" ? plan.cron : (planTouched ? null : existing.cron);
      const oneFireAt = planTouched && plan.kind === "one_time" ? plan.oneFireAt : (planTouched ? null : existing.oneFireAt);
      if (!planTouched && !cron && !oneFireAt) {
        return fail("schedules.update", startedAt, "invalid_schedule", "This schedule has no fire rule; provide a recurrence or one-time fire time.");
      }
      const status: "active" | "paused" | "error" = input.status === "paused" ? "paused" : input.status === "active" ? "active" : (existing.status === "paused" ? "paused" : existing.status === "error" ? "error" : "active");
      const job = await updateScheduledJob({
        organizationId: context.organization_id,
        id: existing.id,
        name: nextName,
        cron,
        oneFireAt,
        intent: SCHEDULED_AGENT_TASK_INTENT,
        params: { task: nextTask },
        status: planTouched && status === "active" ? "active" : status,
        timezone,
        catchUpMinutes: existing.catchUpMinutes,
      });
      if (!job) return fail("schedules.update", startedAt, "not_found", "The schedule was deleted while being edited.");
      await recordAuditEvent({
        organizationId: context.organization_id,
        actorUserId: context.user_id,
        agentId: context.agent_id,
        eventType: "schedule.updated",
        targetType: "scheduled_job",
        targetId: existing.id,
        action: "update",
        decision: "allowed",
        correlationId: context.correlation_id,
        metadata: { source: "agent_tool", tool: "schedules.update", status: job.status, cron: job.cron, oneFireAt: job.oneFireAt },
      }).catch(() => undefined);
      const row = describeSchedule(job);
      return toolResult("schedules.update", startedAt, { schedule: row, summary: `Scheduled task "${row.name}" updated; ${humanSummary(row)}; status ${row.status}; next fire ${row.nextFireAt ?? "pending"}.` });
    },
    timeout_ms: 8000, retryable: false, idempotent: true,
  };
}

type DeleteInput = { id: string };

function createSchedulesDeleteTool(): Tool<DeleteInput, { deleted: boolean; summary: string }> {
  return {
    name: "schedules.delete",
    domain: "schedule",
    description: "Delete (archive) a scheduled AI agent task. Pass the schedule's id — the exact UUID from schedules.list — or the task's exact unique name (for example 'Daily evening digest'); the name must match exactly one active task. When unsure, call schedules.list first. Archived schedules never fire again and disappear from the active list.",
    input_schema: {
      type: "object",
      properties: {
        id: { type: "string", minLength: 1, maxLength: 120, description: "Schedule UUID from schedules.list, or the task's exact unique name." },
      },
      required: ["id"],
      additionalProperties: false,
    },
    sensitivity: "sensitive",
    required_permission: "schedules.manage",
    execute: async (input, context) => {
      const startedAt = Date.now();
      if (!context.auth_subject.permissions.includes("schedules.manage")) {
        return fail("schedules.delete", startedAt, "permission_denied", "The current actor cannot delete schedules.");
      }
      const resolution = await resolveScheduleReference(context.organization_id, String(input.id ?? ""));
      if (!resolution.ok) {
        return fail("schedules.delete", startedAt, resolution.code, resolution.message);
      }
      const existing = resolution.job;
      if (existing.status === "archived") {
        return fail("schedules.delete", startedAt, "not_found", "That scheduled task is already archived.");
      }
      if (existing.agentId !== context.agent_id) {
        return fail("schedules.delete", startedAt, "agent_mismatch", "This schedule belongs to a different agent.");
      }
      const ok = await deleteScheduledJob(context.organization_id, existing.id);
      if (!ok) return fail("schedules.delete", startedAt, "not_found", "The schedule was already archived.");
      await recordAuditEvent({
        organizationId: context.organization_id,
        actorUserId: context.user_id,
        agentId: context.agent_id,
        eventType: "schedule.archived",
        targetType: "scheduled_job",
        targetId: existing.id,
        action: "archive",
        decision: "allowed",
        correlationId: context.correlation_id,
        metadata: { source: "agent_tool", tool: "schedules.delete" },
      }).catch(() => undefined);
      return toolResult("schedules.delete", startedAt, { deleted: true, summary: `Scheduled task "${existing.name}" was deleted and will not fire again.` });
    },
    timeout_ms: 8000, retryable: false, idempotent: true,
  };
}

export interface SchedulesToolRuntime {
  registry: ToolRegistry;
  authorize: (tool: Tool, input: unknown, context: ToolContext) => Promise<ToolAuthorizationDecision>;
  writeAudit: ToolAuditWriter;
}

/** Missing policy and revoked allowlist entries fail closed, mirroring the
 * email and WhatsApp runtimes. */
export async function createSchedulesToolRuntime(organizationId: string, agentId: string, now: () => Date = () => new Date()): Promise<SchedulesToolRuntime> {
  const agents = new PostgresAgentRepository();
  const policy = await agents.policy(organizationId, agentId);
  const allowedTools = policy?.allowedTools ?? [];
  const registry = new ToolRegistry((requestedAgentId) => requestedAgentId === agentId ? allowedTools : null);
  registry.register(createSchedulesListTool() as unknown as Tool);
  registry.register(createSchedulesCreateTool(now) as unknown as Tool);
  registry.register(createSchedulesUpdateTool(now) as unknown as Tool);
  registry.register(createSchedulesDeleteTool() as unknown as Tool);
  const authorize: SchedulesToolRuntime["authorize"] = async (tool, _input, context) => {
    if (context.organization_id !== organizationId || context.agent_id !== agentId) {
      return { allowed: false, code: "context_mismatch", message: "The tool context does not match the initialized agent runtime." };
    }
    if(!turnAllowsTool(context,tool.name))return {allowed:false,code:'tool_not_allowed',message:'This tool was not enabled when the turn started.'};
    if(context.agent_configuration){
      try{await assertCurrentAgentToolAuthorization({organizationId,agentId,userId:context.user_id,revocationGeneration:context.agent_configuration.revocationGeneration??-1},tool.required_permission);}
      catch{return {allowed:false,code:'current_access_revoked',message:'Current access changed or could not be confirmed. Start a new turn after reviewing the agent configuration.'};}
    }
    const currentPolicy = await agents.policy(organizationId, agentId);
    if (!currentPolicy?.allowedTools.includes(tool.name)) {
      return { allowed: false, code: "tool_not_allowed", message: "This tool is not enabled for the current agent." };
    }
    return { allowed: true };
  };
  const writeAudit: ToolAuditWriter = async (toolName, tool, context, outcome) => {
    await recordAuditEvent({
      organizationId: context.organization_id,
      actorUserId: context.user_id,
      agentId: context.agent_id,
      eventType: "agent.tool_call",
      targetType: tool?.domain ?? "tool",
      action: toolName,
      decision: outcome.ok ? "allow" : (outcome.error?.code ?? "deny"),
      correlationId: context.correlation_id,
      metadata: {
        channel: context.channel,
        tool_name: toolName,
        success: outcome.ok,
        error_code: outcome.error?.code ?? null,
        duration_ms: outcome.audit.duration_ms,
      },
    });
  };
  return { registry, authorize, writeAudit };
}

export async function invokeSchedulesTool(runtime: SchedulesToolRuntime, toolName: string, input: unknown, context: ToolContext) {
  return executeRegisteredTool(runtime.registry, toolName, input, context, runtime.authorize, runtime.writeAudit);
}
