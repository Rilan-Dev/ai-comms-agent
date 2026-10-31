import {beforeEach,afterEach,expect,it,vi} from "vitest";

const m=vi.hoisted(()=>({
 claim:vi.fn(),recover:vi.fn(),advance:vi.fn(),complete:vi.fn(),fail:vi.fn(),audit:vi.fn(),
 agentTask:vi.fn(),legacy:vi.fn(),nextCron:vi.fn(),
}));
vi.mock("@ai-comms-agent/db",()=>({
 claimDueScheduledJobs:m.claim,recoverStaleScheduledJobRuns:m.recover,
 advanceScheduledJob:m.advance,completeScheduledJobRun:m.complete,
 failScheduledJobRun:m.fail,recordAuditEvent:m.audit,
}));
vi.mock("../src/agent/scheduled-agent-runtime",()=>({runScheduledAgentTask:m.agentTask}));
vi.mock("../src/agent/execution-dispatcher",()=>({dispatchAgentExecution:m.legacy}));
vi.mock("../src/agent/schedules-tool-runtime",()=>({SCHEDULED_AGENT_TASK_INTENT:"scheduled_agent_task"}));
vi.mock("../src/scheduling/cron",()=>({nextCronFire:m.nextCron}));
import {processScheduledJobs} from "../src/scheduling/scheduler-worker";
const fire="2026-11-01T03:30:00.000Z", next="2026-11-02T03:30:00.000Z";
const job={id:"job",runId:"run",agentId:"agent",organizationId:"org",
 intent:"scheduled_agent_task",params:{task:"Make a digest and send via WhatsApp"},
 cron:"30 3 * * *",timezone:"Asia/Kolkata",nextFireAt:fire,revisionAt:"2026-10-31T00:00:00Z",createdBy:"user"};
beforeEach(()=>{
 vi.resetAllMocks();vi.stubEnv("DATABASE_URL","qa-only");
 m.recover.mockResolvedValue([]);m.claim.mockResolvedValue([job]);m.fail.mockResolvedValue(true);
 m.complete.mockResolvedValue(true);m.advance.mockResolvedValue(true);
 m.audit.mockResolvedValue(undefined);m.nextCron.mockReturnValue(new Date(next));
});
afterEach(()=>vi.unstubAllEnvs());
it("quarantines recurring schedules whose last execution is incomplete instead of clearing error and retrying sends",async()=>{
 m.agentTask.mockResolvedValue({status:"configuration_required",reason:"WhatsApp was blocked; verify provider outcome",output:"Not sent",toolCalls:[],pendingApprovals:[]});
 const result=await processScheduledJobs(1,new Date(fire));
 expect(result).toEqual({claimed:1,completed:0,failed:1});
 expect(m.complete).not.toHaveBeenCalled();
 expect(m.fail).toHaveBeenCalledWith("run","WhatsApp was blocked; verify provider outcome");
 expect(m.advance).toHaveBeenCalledWith("job","org",fire,job.revisionAt,fire,"error","WhatsApp was blocked; verify provider outcome");
 expect(m.audit).toHaveBeenCalledWith(expect.objectContaining({eventType:"schedule.execution.failed",decision:"denied"}));
});
it("never treats a configuration-required result without a reason as a completed execution",async()=>{
 m.agentTask.mockResolvedValue({status:"configuration_required",output:"",toolCalls:[],pendingApprovals:[]});
 const result=await processScheduledJobs(1,new Date(fire));
 expect(result).toMatchObject({completed:0,failed:1});
 expect(m.fail).toHaveBeenCalledWith("run",expect.stringMatching(/did not complete|configuration/i));
 expect(m.advance).toHaveBeenCalledWith("job","org",fire,job.revisionAt,fire,"error",expect.any(String));
});
it("archives a failed one-time task with a visible last error, never an automatic second occurrence",async()=>{
 m.claim.mockResolvedValue([{...job,cron:null,oneFireAt:fire}]);
 m.agentTask.mockResolvedValue({status:"configuration_required",reason:"Provider returned invalid output",output:"",toolCalls:[],pendingApprovals:[]});
 const result=await processScheduledJobs(1,new Date(fire));
 expect(result).toMatchObject({completed:0,failed:1});
 expect(m.advance).toHaveBeenCalledWith("job","org",fire,job.revisionAt,null,"archived","Provider returned invalid output");
 expect(m.nextCron).not.toHaveBeenCalled();
});
it("advances normal completed occurrences and does not confuse a pending human review with delivery",async()=>{
 m.agentTask.mockResolvedValue({status:"completed",output:"Approval pending. No message sent.",toolCalls:[{name:"whatsapp.send",ok:true,durationMs:1}],pendingApprovals:[{actionId:"approval-id",actionType:"whatsapp.send"}]});
 const result=await processScheduledJobs(1,new Date(fire));
 expect(result).toEqual({claimed:1,completed:1,failed:0});
 expect(m.fail).not.toHaveBeenCalled();
 expect(m.complete).toHaveBeenCalledWith("run",expect.objectContaining({pendingApprovals:[{actionId:"approval-id",actionType:"whatsapp.send"}]}));
 expect(m.advance).toHaveBeenCalledWith("job","org",fire,job.revisionAt,next,"active",null);
});
