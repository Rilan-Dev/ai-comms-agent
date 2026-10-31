"use client";

import type { ScheduleValues } from "@/lib/schedules/schedule-form";
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export function ScheduleFields({form,onChange,agents,browserTimezone,idPrefix}:{form:ScheduleValues;onChange:(next:ScheduleValues)=>void;agents:Array<{id:string;name:string}>;browserTimezone:string;idPrefix:string}) {
  const update=(value:Partial<ScheduleValues>)=>onChange({...form,...value});
  const inputClass="h-10 min-w-0 rounded-xl border bg-background px-3 text-sm";
  return <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground lg:col-span-2">Schedule name
      <input aria-label={idPrefix+" name"} className={inputClass} maxLength={180} value={form.name} onChange={e=>update({name:e.target.value})}/></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Agent
      <select aria-label={idPrefix+" agent"} className={inputClass} value={form.agentId} onChange={e=>update({agentId:e.target.value})}>
        {agents.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
      </select></label>
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Repeat
      <select aria-label={idPrefix+" recurrence"} className={inputClass} value={form.mode} onChange={e=>update({mode:e.target.value as ScheduleValues["mode"]})}>
        <option value="one_time">One-time</option><option value="minutes">Every N minutes</option><option value="hours">Every N hours</option>
        <option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="cron">Advanced (cron)</option>
      </select></label>
    {form.mode==="one_time"&&<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Fire date/time<input className={inputClass} type="datetime-local" aria-label={idPrefix+" date"} value={form.oneFireAt} onChange={e=>update({oneFireAt:e.target.value})}/></label>}
    {(form.mode==="minutes"||form.mode==="hours")&&<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Interval<input className={inputClass} type="number" min="1" max={form.mode==="minutes"?"59":"23"} aria-label={idPrefix+" interval"} value={form.interval} onChange={e=>update({interval:e.target.value})}/></label>}
    {form.mode==="weekly"&&<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Weekday<select className={inputClass} aria-label={idPrefix+" weekday"} value={form.weekday} onChange={e=>update({weekday:e.target.value})}>{WEEKDAYS.map(v=><option key={v}>{v}</option>)}</select></label>}
    {form.mode==="monthly"&&<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Day of month<input type="number" min="1" max="28" className={inputClass} aria-label={idPrefix+" day of month"} value={form.dayOfMonth} onChange={e=>update({dayOfMonth:e.target.value})}/></label>}
    {["daily","weekly","monthly"].includes(form.mode)&&<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Time<input type="time" className={inputClass} aria-label={idPrefix+" time"} value={form.time} onChange={e=>update({time:e.target.value})}/></label>}
    {form.mode==="cron"&&<label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Cron expression<input className={inputClass} aria-label={idPrefix+" cron"} value={form.cron} onChange={e=>update({cron:e.target.value})}/></label>}
    <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">Timezone
      <select className={inputClass} aria-label={idPrefix+" timezone"} value={form.timezone} onChange={e=>update({timezone:e.target.value})}>
      {[form.timezone,browserTimezone,"Asia/Kolkata","UTC","Asia/Dubai","Europe/London","Europe/Berlin","America/New_York","America/Chicago","America/Los_Angeles","Australia/Sydney"].filter((v,i,a)=>v&&a.indexOf(v)===i).map(t=><option key={t} value={t}>{t}</option>)}
      </select>
    </label>
  </div>;
}
