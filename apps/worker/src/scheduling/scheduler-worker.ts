import { claimDueScheduledJobs, advanceScheduledJob, completeScheduledJobRun, failScheduledJobRun, recordAuditEvent } from "@ai-comms-agent/db";
import { dispatchAgentExecution } from "../agent/execution-dispatcher";
import { nextCronFire } from "./cron";

async function recordScheduleAudit(event: Parameters<typeof recordAuditEvent>[0]): Promise<void> {
  try {
    await recordAuditEvent(event);
  } catch (error) {
    // The run status is durable. An audit outage must not reclassify it.
    console.error("[scheduler] audit write failed", {
      eventType: event.eventType,
      correlationId: event.correlationId,
      errorType: error instanceof Error ? error.name : "unknown",
    });
  }
}

export async function processScheduledJobs(limit=25,now=new Date()):Promise<{claimed:number;completed:number;failed:number}>{
  if(!process.env.DATABASE_URL) return {claimed:0,completed:0,failed:0};
  // Use ISO 8601 format for PostgreSQL timestamptz — not the default
  // Date.toString() format ("Mon Oct 12 2026 ...") which PostgreSQL
  // rejects with error 22007 "invalid input syntax for type timestamp".
  const nowIso = now.toISOString();
  const jobs=await claimDueScheduledJobs(limit,nowIso); let completed=0,failed=0;
  for(const job of jobs){
    try{
      const result=await dispatchAgentExecution({executionId:job.runId,organizationId:job.organizationId,agentId:job.agentId,source:"schedule",intent:job.intent,params:job.params,requestedAt:now.toISOString()});
      if(result.status==="configuration_required"){ await failScheduledJobRun(job.runId,result.reason); failed+=1; await recordScheduleAudit({organizationId:job.organizationId,actorUserId:null,eventType:"schedule.execution.failed",targetType:"scheduled_run",targetId:job.runId,action:"execute",decision:"denied",correlationId:job.runId,metadata:{jobId:job.id,agentId:job.agentId,reason:result.reason,configurationRequired:true}}); }
      else { await completeScheduledJobRun(job.runId,{status:result.status,executionId:result.executionId,output:result.output??null,provider:result.provider??null,model:result.model??null}); completed+=1; await recordScheduleAudit({organizationId:job.organizationId,actorUserId:null,eventType:"schedule.execution.completed",targetType:"scheduled_run",targetId:job.runId,action:"execute",decision:"allowed",correlationId:job.runId,metadata:{jobId:job.id,agentId:job.agentId,executionId:result.executionId,provider:result.provider??null,model:result.model??null}}); }
      try {
        const next=job.cron ? nextCronFire(job.cron,now,job.timezone) : null;
        await advanceScheduledJob(job.id,job.organizationId,job.nextFireAt,next?.toISOString()??null,job.cron ? "active" : "archived",null);
      } catch (advanceError) {
        // Run completion was committed. A subsequent scheduler DB/cron error
        // must not overwrite that result with a fabricated execution failure.
        console.error("[scheduler] failed to advance a settled occurrence", {
          jobId: job.id, runId: job.runId,
          errorType: advanceError instanceof Error ? advanceError.name : "unknown",
        });
      }
    }catch(error){
      const message=error instanceof Error?error.message:"Scheduled execution failed"; await failScheduledJobRun(job.runId,message); await recordScheduleAudit({organizationId:job.organizationId,actorUserId:null,eventType:"schedule.execution.failed",targetType:"scheduled_run",targetId:job.runId,action:"execute",decision:"denied",correlationId:job.runId,metadata:{jobId:job.id,agentId:job.agentId,error:message}}); await advanceScheduledJob(job.id,job.organizationId,job.nextFireAt,job.cron?job.nextFireAt:null,job.cron?"error":"archived",message); failed+=1;
    }
  }
  return {claimed:jobs.length,completed,failed};
}
