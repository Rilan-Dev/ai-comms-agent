import {describe,it,expect} from "vitest";
import {scheduleToForm,historicalSchedule,localDateTime} from "../src/lib/schedules/schedule-form";
const base={agentId:"agent-A",name:"Morning digest",cron:"00 09 * * *",oneFireAt:null,timezone:"Asia/Kolkata",params:{task:"Summarize emails",fallback:"sarvam"},intent:"scheduled_agent_task",status:"active",nextFireAt:"2026-11-01T03:30:00Z"};
describe("schedule edit, clone, history",()=>{
 it("recovers recurring daily timing and agent without discarding instructions",()=>{
   const edit=scheduleToForm(base);
   expect(edit.mode).toBe("daily");expect(edit.time).toBe("09:00");expect(edit.agentId).toBe("agent-A");expect(edit.task).toBe("Summarize emails");
 });
 it("supports every recurrence including advanced cron without misrepresenting cron",()=>{
   expect(scheduleToForm({...base,cron:"*/15 * * * *"}).mode).toBe("minutes");
   expect(scheduleToForm({...base,cron:"0 */4 * * *"}).mode).toBe("hours");
   expect(scheduleToForm({...base,cron:"30 7 * * 1"}).mode).toBe("weekly");
   expect(scheduleToForm({...base,cron:"15 8 10 * *"}).mode).toBe("monthly");
   expect(scheduleToForm({...base,cron:"5 8 * 2 *"}).mode).toBe("cron");
 });
 it("duplicates without changing original and clears expired one-time fire",()=>{
   const expired={...base,cron:null,oneFireAt:"2026-10-20T08:00:00Z",nextFireAt:null,status:"archived"};
   const fresh=scheduleToForm(expired,true);
   expect(fresh.name).toBe("Morning digest (copy)");
   expect(fresh.oneFireAt).toBe("");
   expect(expired.name).toBe("Morning digest");
   expect(historicalSchedule(expired)).toBe(true);
 });
 it("places archived and elapsed single-fire entries into history",()=>{
   expect(historicalSchedule(base)).toBe(false);
   expect(historicalSchedule({...base,status:"archived"})).toBe(true);
   expect(historicalSchedule({...base,cron:null,oneFireAt:"2026-01-01T00:00:00Z",nextFireAt:null})).toBe(true);
 });
 it("does not convert invalid timestamps",()=>expect(localDateTime("invalid")).toBe(""));
});
