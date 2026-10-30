"use client";

import { useMemo, useRef, useState } from "react";
import { historicalSchedule, scheduleToForm, type ScheduleValues } from "@/lib/schedules/schedule-form";
import { ScheduleFields } from "@/components/schedules/schedule-fields";
import { MentionPicker } from "@/components/mentions/mention-picker";

type Agent = { id: string; name: string; status: string };
type Schedule = {
  id: string; agentId: string; name: string; cron: string | null; oneFireAt: string | null;
  intent: string; params: Record<string, unknown>; status: string; timezone: string;
  nextFireAt: string | null; lastFireAt: string | null; lastError: string | null; catchUpMinutes?: number;
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
  const [editForm, setEditForm] = useState<ScheduleValues | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const createFormRef = useRef<HTMLDetailsElement>(null);
  const taskTextareaRef = useRef<HTMLTextAreaElement>(null);
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);
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
          agentId: typeof changes.agentId==="string" ? changes.agentId : current.agentId,
          name: typeof changes.name === "string" ? changes.name : current.name,
          intent: current.intent || "scheduled_agent_task",
          cron: "cron" in changes ? changes.cron : current.cron,
          oneFireAt: "oneFireAt" in changes ? changes.oneFireAt : current.oneFireAt,
          timezone: typeof changes.timezone==="string" ? changes.timezone : current.timezone,
          params: { ...current.params, task: typeof changes.task === "string" ? changes.task : describeTask(current) },
          catchUpMinutes: current.catchUpMinutes,
          status: typeof changes.status === "string" ? changes.status : current.status,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message ?? d.error ?? "Could not update the schedule.");
      await reload();
      return true;
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update the schedule.");
      return false;
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

  const activeSchedules = schedules.filter(s => !historicalSchedule(s));
  const historicalSchedules = schedules.filter(s => historicalSchedule(s));
  function startEdit(row:Schedule) { setEditing(row.id); setEditForm(scheduleToForm(row)); setNotice(""); }
  function duplicate(row:Schedule) {
    setForm(scheduleToForm(row,true));
    setEditing(null); setEditForm(null); setNotice("Duplicate prepared. Choose the new fire time and review the recipient, account and sending policy before creating. The original task is unchanged.");
    if(createFormRef.current) createFormRef.current.open=true;
    requestAnimationFrame(()=>{createFormRef.current?.scrollIntoView({block:"start",behavior:"smooth"}); createFormRef.current?.querySelector<HTMLInputElement>('input[aria-label="New schedule name"]')?.focus();});
  }
  async function saveEdit(row:Schedule) {
    if(!editForm)return;
    const {body,error}=buildScheduleBody(editForm);
    if(error){setNotice(error);return;}
    if(await patchSchedule(row.id,{...body,task:editForm.task,status:row.status})) {
      setEditing(null);setEditForm(null);setNotice("Schedule updated; prior execution history and fallback options are preserved.");
    }
  }
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
            <button disabled={busy} onClick={() => { if(editing === row.id){setEditing(null);setEditForm(null);} else startEdit(row); }} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">Edit</button>
            <button disabled={busy} onClick={() => duplicate(row)} className="rounded-xl border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">Duplicate</button>
            <button disabled={busy || runsBusy} onClick={() => { void loadRuns(row.id); }} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">{runsFor === row.id ? "Hide runs" : "Runs"}</button>
            <button disabled={busy} onClick={() => void archiveSchedule(row.id)} className="rounded-md border border-border px-3 py-2 text-xs font-medium transition-colors hover:bg-secondary disabled:opacity-50">Delete</button>
          </div>
        </div>
        {editing === row.id && editForm && <div className="mt-4 space-y-3 rounded-xl border border-border bg-background p-4">
          <h3 className="text-sm font-semibold">Edit schedule — {row.name}</h3>
          <ScheduleFields idPrefix="Edit schedule" form={editForm} onChange={setEditForm} agents={agents} browserTimezone={browserTimezone}/>
          <label className="block text-xs font-semibold text-muted-foreground">AI task instruction
            <textarea ref={editTextareaRef} aria-label="Edit task instruction" className="mt-2 min-h-[90px] w-full rounded-xl border bg-background px-3 py-2 text-sm" value={editForm.task} onChange={e => setEditForm({...editForm,task:e.target.value})}/>
          </label>
          <MentionPicker organizationId={organizationId} value={editForm.task} onChange={task=>setEditForm({...editForm,task})} textareaRef={editTextareaRef}/>
          <p className="text-xs text-muted-foreground">Updating an existing job changes future fires; prior execution history remains attached. Saved fallback and policy parameters are preserved.</p>
          <div className="flex flex-wrap gap-2">
            <button disabled={busy} onClick={() => void saveEdit(row)} className="rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Save schedule changes</button>
            <button disabled={busy} onClick={() => {setEditing(null);setEditForm(null);}} className="rounded-xl border px-4 py-2 text-xs font-semibold">Cancel</button>
          </div>
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
      {activeSchedules.length === 0 && <div className="rounded-md border border-dashed p-10 text-center text-sm text-muted-foreground">No scheduled AI tasks yet. Create one below, or ask the agent in chat: &quot;every day at 8, summarize my last 24 hours of email and send me a WhatsApp note&quot;.</div>}
    </section>

    <section className="rounded-xl border border-border bg-card p-5" aria-label="Historical scheduled tasks">
      <button type="button" className="flex w-full items-center justify-between text-left text-sm font-semibold" onClick={()=>setHistoryOpen(!historyOpen)} aria-expanded={historyOpen}>Closed, completed &amp; expired schedules ({historicalSchedules.length}) <span>{historyOpen?"Hide history":"Show history"} ↗</span></button>
      {historyOpen && <div className="mt-4 space-y-3">{historicalSchedules.length===0?<p className="text-sm text-muted-foreground">No archived or completed one-time schedules yet.</p>:historicalSchedules.map(row=><article key={row.id} className="rounded-xl border border-border bg-background p-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="font-semibold">{row.name}</p><p className="mt-1 text-xs text-muted-foreground">{row.status} · {describeRepeat(row)} · {row.timezone}</p><p className="mt-2 whitespace-pre-wrap text-sm">{describeTask(row)}</p>{row.lastFireAt&&<p className="mt-1 text-xs text-muted-foreground">Last fired {new Date(row.lastFireAt).toLocaleString()}</p>}</div>
        <div className="flex gap-2"><button disabled={busy} onClick={()=>duplicate(row)} className="rounded-xl bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-50">Duplicate &amp; reschedule</button><button disabled={runsBusy} onClick={()=>void loadRuns(row.id)} className="rounded-xl border px-3 py-2 text-xs font-semibold">{runsFor===row.id?"Hide runs":"Runs"}</button></div></div>
        {runsFor===row.id&&<div className="mt-3 space-y-2 border-t pt-3 text-xs">{runs.length===0?"No recorded executions.":runs.map(run=><div key={run.id} className="rounded-lg border p-2"><span className="font-semibold">{run.status} — {new Date(run.fire_at).toLocaleString()}</span>{run.error&&<p className="mt-1 text-destructive">{run.error}</p>}{typeof run.result?.output==="string"&&<p className="mt-1 whitespace-pre-wrap">{run.result.output}</p>}</div>)}</div>}
      </article>)}</div>}
    </section>
    <details ref={createFormRef} className="rounded-md border border-border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">New scheduled AI task</summary>
      <div className="mt-4"><ScheduleFields idPrefix="New schedule" form={form} onChange={setForm} agents={agents} browserTimezone={browserTimezone}/></div>
      <textarea ref={taskTextareaRef} aria-label="Task instruction" className="mt-4 min-h-[84px] w-full rounded-md border bg-background px-3 py-2 text-sm" placeholder="Task instruction the AI executes at every fire time — e.g. Summarize my emails from the last 24 hours and send me a short note on WhatsApp at +919629534701." value={form.task} onChange={e => setForm({ ...form, task: e.target.value })} />
      <div className="mt-2"><MentionPicker organizationId={organizationId} value={form.task} onChange={task=>setForm({...form,task})} textareaRef={taskTextareaRef}/></div>
      <a href="/recipients" className="mt-2 inline-block text-xs font-semibold text-primary underline">Manage primary / secondary WhatsApp recipients</a>
      <button disabled={busy} onClick={() => void createSchedule()} className="mt-4 h-10 rounded-md bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">Create scheduled task</button>
      <p className="mt-3 text-xs text-muted-foreground">At every fire time the agent runs this instruction with its enabled tools: reading mail, summarizing, sending WhatsApp notes and more. Sends follow the agent&apos;s approval policy (autonomous sending when enabled).</p>
    </details>

    <section className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-[.12em] text-muted-foreground">Event automations</h2>
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

    <details open={activeRules.length===0} className="rounded-md border border-border bg-card p-5">
      <summary className="cursor-pointer text-sm font-semibold">New event automation</summary>
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
    </details>
  </main>;
}
