import { claimDueScheduledJobs, recoverStaleScheduledJobRuns, advanceScheduledJob, completeScheduledJobRun, failScheduledJobRun, recordAuditEvent } from "@ai-comms-agent/db";
import { dispatchAgentExecution } from "../agent/execution-dispatcher";
import { runScheduledAgentTask } from "../agent/scheduled-agent-runtime";
import { SCHEDULED_AGENT_TASK_INTENT } from "../agent/schedules-tool-runtime";
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
  const interrupted=await recoverStaleScheduledJobRuns(nowIso);
  for(const recovered of interrupted){
    await recordScheduleAudit({
      organizationId:recovered.organizationId,actorUserId:null,
      eventType:recovered.runStatus==="running"?"schedule.execution.interrupted":"schedule.progression.interrupted",targetType:"scheduled_run",
      targetId:recovered.runId,action:"recover",decision:"denied",
      correlationId:recovered.runId,
      metadata:{jobId:recovered.jobId,runStatus:recovered.runStatus,providerOutcomeUnknown:recovered.runStatus==="running",manualVerificationRequired:true,quarantined:recovered.quarantined},
    });
  }
  const jobs=await claimDueScheduledJobs(limit,nowIso); let completed=0,failed=0;
  for(const job of jobs){
    try{
      // Scheduled AI agent tasks run the full host-authorized tool loop
      // (email read/write, WhatsApp send) with the task instruction as the
      // user turn. Legacy intents keep the classic prompt-only dispatch.
      const task=job.params?.task;
      const isAgentTask=job.intent===SCHEDULED_AGENT_TASK_INTENT && typeof task==="string";
      const agentTaskResult=isAgentTask ? await runScheduledAgentTask({executionId:job.runId,organizationId:job.organizationId,agentId:job.agentId,task,fireAt:job.nextFireAt,userId:job.createdBy,
        ...(Object.prototype.hasOwnProperty.call(job.params,'allowedTools')?{allowedToolNames:job.params.allowedTools as string[]}:{}),
        ...(Object.prototype.hasOwnProperty.call(job.params,'fallback')?{fallback:job.params.fallback}:{}),
      }) : null;
      const legacyResult=isAgentTask ? null : await dispatchAgentExecution({executionId:job.runId,organizationId:job.organizationId,agentId:job.agentId,source:"schedule",intent:job.intent,params:job.params,requestedAt:now.toISOString()});
      const failureReason:string|null=agentTaskResult?.status==="configuration_required"
        ? (agentTaskResult.reason ?? "Scheduled execution did not complete; inspect the run and provider outcome before retrying.")
        : legacyResult?.status==="configuration_required"
          ? (legacyResult.reason ?? "Scheduled execution did not complete; inspect the run and provider outcome before retrying.")
          : null;
      if(failureReason!==null){ if(!(await failScheduledJobRun(job.runId,failureReason))){ console.error("[scheduler] run was already settled", {runId:job.runId}); continue; } failed+=1; await recordScheduleAudit({organizationId:job.organizationId,actorUserId:null,eventType:"schedule.execution.failed",targetType:"scheduled_run",targetId:job.runId,action:"execute",decision:"denied",correlationId:job.runId,metadata:{jobId:job.id,agentId:job.agentId,reason:failureReason,configurationRequired:true}}); }
      else { 
        const runPayload=agentTaskResult
          ? {status:agentTaskResult.status,executionId:job.runId,output:agentTaskResult.output,provider:agentTaskResult.provider,model:agentTaskResult.model,toolCalls:agentTaskResult.toolCalls,toolCallCount:agentTaskResult.toolCalls.length,pendingApprovals:agentTaskResult.pendingApprovals}
          : {status:legacyResult!.status,executionId:legacyResult!.executionId,output:(legacyResult as {output?:string|null}).output??null,provider:(legacyResult as {provider?:string|null}).provider??null,model:(legacyResult as {model?:string|null}).model??null};
        const toolCallCount=agentTaskResult?agentTaskResult.toolCalls.length:undefined;
        if(!(await completeScheduledJobRun(job.runId,runPayload))){ console.error("[scheduler] run was already settled", {runId:job.runId}); continue; } completed+=1; await recordScheduleAudit({organizationId:job.organizationId,actorUserId:null,eventType:"schedule.execution.completed",targetType:"scheduled_run",targetId:job.runId,action:"execute",decision:"allowed",correlationId:job.runId,metadata:{jobId:job.id,agentId:job.agentId,executionId:runPayload.executionId,provider:runPayload.provider,model:runPayload.model,toolCallCount}}); }
      try {
        // A failed occurrence has an unknown downstream send outcome. Preserve
        // its original fire position and quarantine recurring tasks for owner
        // review rather than silently clearing the error and scheduling another
        // potentially duplicate WhatsApp send tomorrow.
        const next=job.cron && !failureReason ? nextCronFire(job.cron,now,job.timezone) : null;
        await advanceScheduledJob(job.id,job.organizationId,job.nextFireAt,job.revisionAt,
          failureReason && job.cron ? job.nextFireAt : next?.toISOString()??null,
          failureReason && job.cron ? "error" : job.cron ? "active" : "archived",failureReason);
      } catch (advanceError) {
        // Run completion was committed. A subsequent scheduler DB/cron error
        // must not overwrite that result with a fabricated execution failure.
        console.error("[scheduler] failed to advance a settled occurrence", {
          jobId: job.id, runId: job.runId,
          errorType: advanceError instanceof Error ? advanceError.name : "unknown",
        });
      }
    }catch(error){
      const message=error instanceof Error?error.message:"Scheduled execution failed"; if(!(await failScheduledJobRun(job.runId,message))){ console.error("[scheduler] run was already settled", {runId:job.runId}); continue; } await recordScheduleAudit({organizationId:job.organizationId,actorUserId:null,eventType:"schedule.execution.failed",targetType:"scheduled_run",targetId:job.runId,action:"execute",decision:"denied",correlationId:job.runId,metadata:{jobId:job.id,agentId:job.agentId,error:message}}); await advanceScheduledJob(job.id,job.organizationId,job.nextFireAt,job.revisionAt,job.cron?job.nextFireAt:null,job.cron?"error":"archived",message); failed+=1;
    }
  }
  return {claimed:jobs.length,completed,failed};
}
