import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildScheduleBody } from "../../web/src/app/scheduled/scheduled-client";

const scheduledClient = readFileSync(resolve(__dirname, "../../web/src/app/scheduled/scheduled-client.tsx"), "utf8");
const sidebar = readFileSync(resolve(__dirname, "../../web/src/components/sidebar.tsx"), "utf8");
const schedulesPage = readFileSync(resolve(__dirname, "../../web/src/app/schedules/page.tsx"), "utf8");
const automationsPage = readFileSync(resolve(__dirname, "../../web/src/app/automations/page.tsx"), "utf8");
const agentDetail = readFileSync(resolve(__dirname, "../../web/src/app/agents/[id]/agent-detail-client.tsx"), "utf8");
const identityTypes = readFileSync(resolve(__dirname, "../../../packages/shared/src/identity/types.ts"), "utf8");

const baseForm = {
  agentId: "240019d9-3fb5-426b-8600-5b858b5a2b51",
  name: "Morning digest",
  task: "Summarize my last 24 hours of email and send a short WhatsApp note to +919629534701",
  mode: "daily",
  interval: "30",
  time: "08:00",
  weekday: "Monday",
  dayOfMonth: "1",
  cron: "*/15 * * * *",
  oneFireAt: "",
  timezone: "Asia/Calcutta",
};

describe("merged Scheduled AI agent screen", () => {
  it("builds a scheduled_agent_task body from the daily preset", () => {
    const { body, error } = buildScheduleBody({ ...baseForm, time: "18:30" });
    expect(error).toBeNull();
    expect(body).toMatchObject({ intent: "scheduled_agent_task", cron: "30 18 * * *", timezone: "Asia/Calcutta" });
    expect(body.params).toMatchObject({ task: baseForm.task });
  });

  it("maps minutes, hours, weekly and monthly presets to cron", () => {
    expect(buildScheduleBody({ ...baseForm, mode: "minutes", interval: "10" }).body).toMatchObject({ cron: "*/10 * * * *" });
    expect(buildScheduleBody({ ...baseForm, mode: "hours", interval: "6" }).body).toMatchObject({ cron: "0 */6 * * *" });
    expect(buildScheduleBody({ ...baseForm, mode: "weekly", weekday: "Friday", time: "09:15" }).body).toMatchObject({ cron: "15 09 * * 5" });
    expect(buildScheduleBody({ ...baseForm, mode: "monthly", dayOfMonth: "15", time: "07:05" }).body).toMatchObject({ cron: "05 07 15 * *" });
  });

  it("builds a one-time body from a future datetime", () => {
    const future = new Date(Date.now() + 60_000 * 10).toISOString();
    const { body, error } = buildScheduleBody({ ...baseForm, mode: "one_time", oneFireAt: future });
    expect(error).toBeNull();
    expect(body).toMatchObject({ cron: null, oneFireAt: future });
  });

  it("rejects a one-time fire in the past and invalid presets", () => {
    expect(buildScheduleBody({ ...baseForm, mode: "one_time", oneFireAt: "2020-01-01T00:00:00.000Z" }).error).toBeTruthy();
    expect(buildScheduleBody({ ...baseForm, mode: "minutes", interval: "99" }).error).toBeTruthy();
    expect(buildScheduleBody({ ...baseForm, name: "" }).error).toBeTruthy();
    expect(buildScheduleBody({ ...baseForm, task: "" }).error).toBeTruthy();
    expect(buildScheduleBody({ ...baseForm, mode: "cron", cron: "* * * *" }).error).toBeTruthy();
  });

  it("merges Scheduling and Automations into one screen and nav item", () => {
    expect(sidebar).toContain('"/scheduled"');
    expect(sidebar).toContain("Scheduled AI Agent");
    expect(sidebar).not.toContain('"/automations"');
    expect(sidebar).not.toContain('"/schedules"');
    expect(schedulesPage).toContain('redirect("/scheduled")');
    expect(automationsPage).toContain('redirect("/scheduled")');
    expect(scheduledClient).toContain("New scheduled AI task");
    expect(scheduledClient).toContain("Event automations");
    // Execution evidence: per-schedule run history and pause/resume/edit/delete.
    expect(scheduledClient).toContain("loadRuns");
    expect(scheduledClient).toContain("Pause");
    expect(scheduledClient).toContain("Resume");
  });

  it("exposes the schedules tool checklist on the agent policy tab", () => {
    expect(agentDetail).toContain("SCHEDULES_POLICY_CHOICES");
    expect(agentDetail).toContain("Scheduled AI agent permissions");
  });

  it("grants schedule permissions by role in the shared catalogue", () => {
    expect(identityTypes).toContain('"schedules.read"');
    expect(identityTypes).toContain('"schedules.manage"');
    // Members may read; only owner/admin rows include schedules.manage.
    const member = identityTypes.slice(identityTypes.indexOf("member: ["), identityTypes.indexOf("viewer: ["));
    expect(member).toContain('"schedules.read"');
    expect(member).not.toContain('"schedules.manage"');
  });
});
