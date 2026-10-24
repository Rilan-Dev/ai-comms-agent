"use client";

import { useMemo, useState } from "react";

type Agent = { id: string; name: string; status: string };
type Schedule = {
  id: string; agentId: string; name: string; cron: string | null; oneFireAt: string | null;
  intent: string; params: Record<string, unknown>; status: string; timezone: string;
  nextFireAt: string | null; lastFireAt: string | null; lastError: string | null;
};
type Rule = { id: string; agentId: string; name: string; trigger: Record<string, unknown>; actions: unknown[]; status: string };
type RunRow = { id: string; fire_at: string; started_at: string; finished_at: string | null; status: string; error: string | null; result: Record<string, unknown> | null };
type RecurrenceMode = "one_time" | "minutes" | "hours" | "daily" | "weekly" | "monthly" | "cron";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function pad2(value: number) { return String(value).padStart(2, "0"); }

/** Client twin of the server recurrence engine: deterministic preset -> cron. */
export function buildScheduleBody(form: {
  agentId: string; name: string; task: string; mode: RecurrenceMode;
  interval: string; time: string; weekday: string; dayOfMonth: string; cron: string;
  oneFireAt: string; timezone: string;
}): { body: Record<string, unknown>; error: string | null } {
  if (!form.name.trim()) return { body: {}, error: "A schedule name is required." };
  if (!form.task.trim()) return { body: {}, error: "A task instruction is required (the AI executes it at every fire time)." };
  if (!form.agentId) return { body: {}, error: "Select an agent." };
  const tz = form.timezone.trim() || "UTC";
  let cron: string | null = null;
  let oneFireAt: string | null = null;
  if (form.mode === "one_time") {
    if (!form.oneFireAt) return { body: {}, error: "Choose the one-time date and time." };
    const fire = new Date(form.oneFireAt);
    if (Number.isNaN(fire.getTime())) return { body: {}, error: "The one-time date and time is invalid." };
    if (fire.getTime() <= Date.now() + 30_000) return { body: {}, error: "The one-time fire time must be at least 30 seconds in the future." };
    oneFireAt = fire.toISOString();
  } else if (form.mode === "cron") {
    cron = form.cron.trim();
    if (cron.split(/\s+/).length !== 5) return { body: {}, error: "The cron expression must contain exactly five fields." };
  } else if (form.mode === "minutes") {
    const n = Number(form.interval);
    if (!Number.isInteger(n) || n < 1 || n > 59) return { body: {}, error: "Minutes interval must be 1–59." };
    cron = `*/${n} * * * *`;
  } else if (form.mode === "hours") {
    const n = Number(form.interval);
    if (!Number.isInteger(n) || n < 1 || n > 23) return { body: {}, error: "Hours interval must be 1–23." };
    cron = `0 */${n} * * *`;
  } else {
    const time = /^(\d{1,2}):(\d{2})$/.test(form.time) ? form.time : "08:00";
    const [hourRaw, minuteRaw] = time.split(":");
    const minute = pad2(Number(minuteRaw));
    const hour = pad2(Number(hourRaw));
    if (form.mode === "daily") cron = `${minute} ${hour} * * *`;
    else if (form.mode === "weekly") {
      const weekday = WEEKDAYS.indexOf(form.weekday);
      if (weekday < 0) return { body: {}, error: "Choose a weekday." };
      cron = `${minute} ${hour} * * ${weekday}`;
    } else {
      const dom = Number(form.dayOfMonth);
      if (!Number.isInteger(dom) || dom < 1 || dom > 28) return { body: {}, error: "Day of month must be 1–28." };
      cron = `${minute} ${hour} ${dom} * *`;
    }
  }
  return {
    body: {
      agentId: form.agentId,
      name: form.name.trim(),
      intent: "scheduled_agent_task",
      cron,
      oneFireAt,
      timezone: tz,
      params: { task: form.task.trim() },
    },
    error: null,
  };
}

function describeRepeat(row: Schedule): string {
  if (row.cron) return `Repeats ${row.cron}`;
  if (row.oneFireAt) return `One-time ${new Date(row.oneFireAt).toLocaleString()}`;
  return "No fire rule";
}

function describeTask(row: Schedule): string {
  const task = row.params?.task;
  return typeof task === "string" ? task : row.intent;
}

export default function ScheduledClient({ organizationId, initialSchedules, initialRules, agents }: {
  organizationId: string; initialSchedules: Schedule[]; initialRules: Rule[]; agents: Agent[];
}) {
  const [schedules, setSchedules] = useState(initialSchedules);
  const [rules, setRules] = useState(initialRules);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editTask, setEditTask] = useState("");
  const [runsFor, setRunsFor] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [runsBusy, setRunsBusy] = useState(false);
  const browserTimezone = useMemo(() => {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; }
  }, []);
  const [form, setForm] = useState({
    agentId: agents[0]?.id ?? "",
    name: "",
    task: "",
    mode: "daily" as RecurrenceMode,
    interval: "30",
    time: "08:00",
    weekday: "Monday",
    dayOfMonth: "1",
    cron: "*/15 * * * *",
    oneFireAt: "",
    timezone: browserTimezone,
  });
  const [ruleForm, setRuleForm] = useState({ agentId: agents[0]?.id ?? "", name: "", event: "email.received", action: "create_draft" });

  async function reload() {
    const [s, a] = await Promise.all([
      fetch(`/api/organizations/${organizationId}/schedules`, { cache: "no-store" }),
      fetch(`/api/organizations/${organizationId}/automations`, { cache: "no-store" }),
    ]);
    const sd = await s.json();
    const ad = await a.json();
    if (s.ok) setSchedules(sd.schedules ?? []);
    if (a.ok) setRules(ad.automations ?? []);
  }

  async function createSchedule() {
    setBusy(true); setNotice("");
    try {
      const { body, error } = buildScheduleBody(form);
      if (error) throw new Error(error);
      const r = await fetch(`/api/organizations/${organizationId}/schedules`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? d.error ?? "Could not create the scheduled task.");
      setForm({ ...form, name: "", task: "", oneFireAt: "" });
      setNotice("Scheduled AI agent task created. The agent executes it with its real tools at every fire time.");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not create the scheduled task.");
    } finally { setBusy(false); }
  }

  async function patchSchedule(id: string, changes: Record<string, unknown>) {
    setBusy(true);
    try {
      const current = schedules.find(s => s.id === id);
      if (!current) throw new Error("Schedule not found.");
      const r = await fetch(`/api/organizations/${organizationId}/schedules`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          agentId: current.agentId,
          name: typeof changes.name === "string" ? changes.name : current.name,
          intent: current.intent || "scheduled_agent_task",
          cron: "cron" in changes ? changes.cron : current.cron,
          oneFireAt: "oneFireAt" in changes ? changes.oneFireAt : current.oneFireAt,
          timezone: current.timezone,
          params: { task: typeof changes.task === "string" ? changes.task : describeTask(current) },
          status: typeof changes.status === "string" ? changes.status : current.status,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? d.error ?? "Could not update the schedule.");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update the schedule.");
    } finally { setBusy(false); }
  }

  async function archiveSchedule(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/organizations/${organizationId}/schedules?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Could not delete the schedule.");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not delete the schedule.");
    } finally { setBusy(false); }
  }

  async function loadRuns(jobId: string) {
    if (runsFor === jobId) { setRunsFor(null); setRuns([]); return; }
    setRunsBusy(true);
    try {
      const r = await fetch(`/api/organizations/${organizationId}/schedules?jobId=${encodeURIComponent(jobId)}`, { cache: "no-store" });
      const d = await r.json();
      if (r.ok) { setRuns(d.runs ?? []); setRunsFor(jobId); }
    } finally { setRunsBusy(false); }
  }

  async function createRule() {
    setBusy(true); setNotice("");
    try {
      const r = await fetch(`/api/organizations/${organizationId}/automations`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: ruleForm.agentId, name: ruleForm.name, trigger: { event: ruleForm.event }, actions: [{ type: ruleForm.action }] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? "Could not create automation.");
      setRuleForm({ ...ruleForm, name: "" });
      setNotice("Automation rule created.");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not create automation.");
    } finally { setBusy(false); }
  }

  async function archiveRule(id: string) {
    setBusy(true);
    try {
      const r = await fetch(`/api/organizations/${organizationId}/automations?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Could not archive automation.");
      await reload();
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not archive automation.");
    } finally { setBusy(false); }
  }

  const activeSchedules = schedules.filter(s => s.status !== "archived");
  const activeRules = rules.filter(r => r.status !== "archived");

  return <main className="mx-auto max-w-[1200px] space-y-8 bg-background p-5 sm:p-7 lg:p-10">
    <header>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">Automation workspace</p>
      <h1 className="font-display text-3xl font-medium tracking-tight">Scheduled AI agent<span className="text-tertiary">.</span></h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        One workspace for time-driven and event-driven automation. Scheduled tasks carry a natural-language instruction the AI agent executes with its real tools (email, WhatsApp) at every fire — create them here, or just ask the agent in chat.
      </p>
    </header>

    {notice && <div role="status" className="rounded-md border bg-background px-4 py-3 text-sm">{notice}</div>}

    <section className="rounded-md border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">New scheduled AI task</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-6">
        <input aria-label="Schedule name" className="h-10 rounded-md border bg-background px-3 text-sm lg:col-span-2" placeholder="Schedule name (e.g. Morning email digest)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
        <select aria-label="Agent" className="h-10 rounded-md border bg-background px-3 text-sm" value={form.agentId} onChange={e => setForm({ ...form, agentId: e.target.value })}>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select aria-label="Repeat mode" className="h-10 rounded-md border bg-background px-3 text-sm" value={form.mode} onChange={e => setForm({ ...form, mode: e.target.value as RecurrenceMode })}>
          <option value="one_time">One-time</option>
          <option value="minutes">Every N minutes</option>
          <option value="hours">Every N hours</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
          <option value="cron">Advanced (cron)</option>
        </select>
        {form.mode === "one_time" && <input className="h-10 rounded-md border bg-background px-3 text-sm" type="datetime-local" aria-label="One-time fire time" value={form.oneFireAt} onChange={e => setForm({ ...form, oneFireAt: e.target.value })} />}
        {form.mode === "minutes" && <input className="h-10 rounded-md border bg-background px-3 text-sm" type="number" min={1} max={59} aria-label="Minutes interval" value={form.interval} onChange={e => setForm({ ...form, interval: e.target.value })} />}
        {form.mode === "hours" && <input className="h-10 rounded-md border bg-background px-3 text-sm" type="number" min={1} max={23} aria-label="Hours interval" value={form.interval} onChange={e => setForm({ ...form, interval: e.target.value })} />}
        {form.mode === "daily" && <input className="h-10 rounded-md border bg-background px-3 text-sm" type="time" aria-label="Fire time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />}
        {form.mode === "weekly" && <>
          <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Weekday" value={form.weekday} onChange={e => setForm({ ...form, weekday: e.target.value })}>
            {WEEKDAYS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <input className="h-10 rounded-md border bg-background px-3 text-sm" type="time" aria-label="Fire time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
        </>}
        {form.mode === "monthly" && <>
          <input className="h-10 rounded-md border bg-background px-3 text-sm" type="number" min={1} max={28} aria-label="Day of month" value={form.dayOfMonth} onChange={e => setForm({ ...form, dayOfMonth: e.target.value })} />
          <input className="h-10 rounded-md border bg-background px-3 text-sm" type="time" aria-label="Fire time" value={form.time} onChange={e => setForm({ ...form, time: e.target.value })} />
        </>}
        {form.mode === "cron" && <input className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Cron expression" value={form.cron} onChange={e => setForm({ ...form, cron: e.target.value })} />}
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Timezone" value={form.timezone} onChange={e => setForm({ ...form, timezone: e.target.value })}>
          {[browserTimezone, "UTC", "Asia/Calcutta", "Asia/Dubai", "Europe/London", "Europe/Berlin", "America/New_York", "America/Chicago", "America/Los_Angeles", "Australia/Sydney"].filter((v, i, a) => v && a.indexOf(v) === i).map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>
      <textarea aria-label="Task instruction" className="mt-4 min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Task instruction the AI executes at every fire time — e.g. Summarize my emails from the last 24 hours and send me a short note on WhatsApp at +919629534701." value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} />
      <button disabled={busy} onClick={() => void createSchedule()} className="mt-4 h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">Create scheduled task</button>
      <p className="mt-3 text-xs text-muted-foreground">At every fire time the agent runs this instruction with its enabled tools: reading mail, summarizing, sending WhatsApp notes and more. Sends follow the agent's approval policy (autonomous sending when enabled).</p>
    </section>

    <section className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">Scheduled AI tasks ({activeSchedules.length})</h2>
      {activeSchedules.map(row => <article key={row.id} className="rounded-md border border-border bg-card p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{row.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{describeRepeat(row)} · {row.timezone} · next fire {row.nextFireAt ? new Date(row.nextFireAt).toLocaleString() : "pending"}</p>
            <p className="mt-2 text-sm text-foreground/90">{describeTask(row)}</p>
            {row.lastFireAt && <p className="mt-1 text-[11px] text-muted-foreground">Last fired {new Date(row.lastFireAt).toLocaleString()}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold">{row.status}</span>
            <button disabled={busy} onClick={() => void patchSchedule(row.id, { status: row.status === "paused" ? "active" : "paused" })} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">
              {row.status === "paused" ? "Resume" : "Pause"}
            </button>
            <button disabled={busy} onClick={() => { setEditing(editing === row.id ? null : row.id); setEditTask(describeTask(row)); }} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">Edit</button>
            <button disabled={busy || runsBusy} onClick={() => { void loadRuns(row.id); }} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">{runsFor === row.id ? "Hide runs" : "Runs"}</button>
            <button disabled={busy} onClick={() => void archiveSchedule(row.id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">Delete</button>
          </div>
        </div>
        {editing === row.id && <div className="mt-3 rounded-md border border-border bg-background p-3">
          <label htmlFor={`edit-task-${row.id}`} className="text-xs font-semibold text-muted-foreground">Task instruction</label>
          <textarea id={`edit-task-${row.id}`} className="mt-2 min-h-[72px] w-full rounded-md border bg-background px-3 py-2 text-sm" value={editTask} onChange={e => setEditTask(e.target.value)} />
          <button disabled={busy} onClick={() => { void patchSchedule(row.id, { task: editTask }); setEditing(null); }} className="mt-3 h-9 rounded-md bg-foreground px-4 text-xs font-semibold text-background disabled:opacity-50">Save task</button>
        </div>}
        {runsFor === row.id && <div className="mt-3 rounded-md border border-border bg-background p-3" aria-live="polite">
          <p className="text-xs font-semibold text-muted-foreground">Execution history (latest 100)</p>
          {runs.length === 0 && <p className="mt-2 text-xs text-muted-foreground">No runs recorded yet.</p>}
          <div className="mt-2 space-y-2">
            {runs.slice(0, 20).map(run => <div key={run.id} className="rounded-md border p-3 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold">{new Date(run.fire_at).toLocaleString()}</span>
                <span className="rounded-full border px-2 py-0.5 text-[10px] font-semibold">{run.status}</span>
                {typeof run.result?.toolCallCount === "number" && <span className="text-muted-foreground">{String(run.result.toolCallCount)} tool calls</span>}
                {Array.isArray(run.result?.toolCalls) && <span className="text-muted-foreground">{(run.result.toolCalls as unknown[]).map((c) => { const call = c as { name?: string; ok?: boolean }; return `${call.name ?? "tool"}${call.ok === false ? " (failed)" : ""}`; }).join(" · ")}</span>}
              </div>
              {typeof run.result?.output === "string" && run.result.output && <p className="mt-2 whitespace-pre-wrap text-foreground/90">{run.result.output}</p>}
              {run.error && <p className="mt-2 text-destructive">{run.error}</p>}
            </div>)}
          </div>
        </div>}
        {row.lastError && <p className="mt-3 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{row.lastError}</p>}
      </article>)}
      {activeSchedules.length === 0 && <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No scheduled AI tasks yet. Create one above, or ask the agent in chat: "every day at 8, summarize my last 24 hours of email and send me a WhatsApp note".</div>}
    </section>

    <section className="rounded-md border border-border bg-card p-5">
      <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">Event automations</h2>
      <p className="mt-1 text-xs text-muted-foreground">Event-driven rules: when a trigger event arrives, the bound agent executes its configured action.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-4">
        <input aria-label="Automation rule name" className="h-10 rounded-md border bg-background px-3 text-sm" placeholder="Rule name" value={ruleForm.name} onChange={e => setRuleForm({ ...ruleForm, name: e.target.value })} />
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Automation agent" value={ruleForm.agentId} onChange={e => setRuleForm({ ...ruleForm, agentId: e.target.value })}>
          {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Trigger event" value={ruleForm.event} onChange={e => setRuleForm({ ...ruleForm, event: e.target.value })}>
          <option value="email.received">Email received</option>
          <option value="email.action_required">Email action required</option>
          <option value="whatsapp.received">WhatsApp received</option>
        </select>
        <select className="h-10 rounded-md border bg-background px-3 text-sm" aria-label="Automation action" value={ruleForm.action} onChange={e => setRuleForm({ ...ruleForm, action: e.target.value })}>
          <option value="create_draft">Create draft</option>
          <option value="send_whatsapp">Send WhatsApp</option>
          <option value="generate_summary">Generate summary</option>
        </select>
      </div>
      <button disabled={busy || !ruleForm.agentId || !ruleForm.name} onClick={() => void createRule()} className="mt-4 h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-85 disabled:opacity-50">Create rule</button>
    </section>

    <section className="grid gap-3">
      {activeRules.map(r => <article key={r.id} className="rounded-md border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="font-semibold">{r.name}</p>
            <p className="mt-1 text-xs text-muted-foreground">{String(r.trigger.event ?? "event")} → {String((r.actions[0] as { type?: string } | undefined)?.type ?? "action")}</p>
          </div>
          <span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold">{r.status}</span>
          <button disabled={busy} onClick={() => void archiveRule(r.id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">Archive</button>
        </div>
      </article>)}
      {activeRules.length === 0 && <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No automation rules yet.</div>}
    </section>
  </main>;
}
