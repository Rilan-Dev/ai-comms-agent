/**
 * Only the scheduling tools actually registered by the host runtime appear
 * here. Selecting a tool changes local editor state only until an authorized
 * admin reviews and saves policy. It never grants actor RBAC or creates a
 * schedule by itself.
 */
export const SCHEDULES_POLICY_CHOICES = [
  {
    name: "schedules.list",
    label: "List scheduled AI tasks",
    detail: "Read this organization's scheduled AI agent tasks, repeat rules and next fire times. Requires schedules.read.",
    group: "read",
  },
  {
    name: "schedules.create",
    label: "Create scheduled AI tasks",
    detail: "Create scheduled tasks (minutes, hours, daily, weekly, monthly, cron or one-time) that the agent later executes with its real tools. Requires schedules.manage.",
    group: "manage",
  },
  {
    name: "schedules.update",
    label: "Edit scheduled AI tasks",
    detail: "Rename, rewrite the task instruction, change the repeat rule, or pause/resume a scheduled task. Requires schedules.manage.",
    group: "manage",
  },
  {
    name: "schedules.delete",
    label: "Delete scheduled AI tasks",
    detail: "Archive a scheduled task so it never fires again. Requires schedules.manage.",
    group: "manage",
  },
] as const;

export function schedulesPolicyReadiness(input: {
  allowedTools: readonly string[];
}): { canList: boolean; canCreate: boolean; blockers: string[] } {
  const enabled = new Set(input.allowedTools);
  return {
    canList: enabled.has("schedules.list"),
    canCreate: enabled.has("schedules.create"),
    blockers: [],
  };
}
