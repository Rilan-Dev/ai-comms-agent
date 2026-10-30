export type ScheduleValues = {
  agentId: string; name: string; task: string;
  mode: "one_time" | "minutes" | "hours" | "daily" | "weekly" | "monthly" | "cron";
  interval: string; time: string; weekday: string; dayOfMonth: string;
  cron: string; oneFireAt: string; timezone: string;
};
const WEEKDAYS = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
export type SavedSchedule = {
  agentId: string; name: string; cron: string | null; oneFireAt: string | null;
  timezone: string; params: Record<string,unknown>; intent: string;
  status: string; nextFireAt: string | null;
};

export function localDateTime(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  const p = (n:number) => String(n).padStart(2,"0");
  return date.getFullYear()+"-"+p(date.getMonth()+1)+"-"+p(date.getDate())+"T"+p(date.getHours())+":"+p(date.getMinutes());
}
export function scheduleToForm(row:SavedSchedule, duplicate=false):ScheduleValues {
  const parts = row.cron?.trim().split(/\s+/) ?? [];
  let mode: ScheduleValues["mode"] = row.oneFireAt ? "one_time" : "cron";
  let interval = "30", time = "08:00", weekday = "Monday", dayOfMonth = "1";
  if (parts.length===5) {
    const [min,hour,dom,month,dow]=parts;
    if (min?.startsWith("*/") && hour==="*" && dom==="*" && month==="*" && dow==="*") {
      mode="minutes"; interval=min.slice(2);
    } else if (min==="0" && hour?.startsWith("*/") && dom==="*" && month==="*" && dow==="*") {
      mode="hours";interval=hour.slice(2);
    } else if (/^\d{1,2}$/.test(min ?? "") && /^\d{1,2}$/.test(hour ?? "") && month==="*") {
      time=String(hour).padStart(2,"0")+":"+String(min).padStart(2,"0");
      if (dom==="*" && dow==="*")mode="daily";
      else if (dom==="*" && /^[0-6]$/.test(dow??"")){mode="weekly";weekday=WEEKDAYS[Number(dow)] ?? "Monday";}
      else if (/^\d{1,2}$/.test(dom??"") && dow==="*"){mode="monthly";dayOfMonth=dom!;}
    }
  }
  return {
    agentId:row.agentId,name:duplicate?row.name+" (copy)":row.name,
    task:typeof row.params?.task==="string"?row.params.task:row.intent,
    mode,interval,time,weekday,dayOfMonth,
    cron:row.cron ?? "0 9 * * *",
    oneFireAt:duplicate && row.oneFireAt?"":row.oneFireAt?localDateTime(row.oneFireAt):"",
    timezone:row.timezone||"UTC",
  };
}
export function historicalSchedule(row:Pick<SavedSchedule,"status"|"cron"|"oneFireAt"|"nextFireAt">,now=Date.now()):boolean {
  if (["archived","completed","closed","expired"].includes(row.status))return true;
  if (!row.cron && row.oneFireAt && !row.nextFireAt) return true;
  if (!row.cron && row.oneFireAt && Date.parse(row.oneFireAt)<now && row.status!=="error")return true;
  return false;
}
