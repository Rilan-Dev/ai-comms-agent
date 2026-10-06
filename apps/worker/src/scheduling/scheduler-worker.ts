import { claimDueScheduledJobs, advanceScheduledJob, completeScheduledJobRun, failScheduledJobRun } from "@ai-comms-agent/db";
import { dispatchAgentExecution } from "../agent/execution-dispatcher";
import { nextCronFire } from "./cron";

export async function processScheduledJobs(limit=25,now=new Date()):Promise<{claimed:number;completed:number;failed:number}>{
  if(!process.env.DATABASE_URL) return {claimed:0,completed:0,failed:0};
  const jobs=await claimDueScheduledJobs(limit,now.toISOString()); let completed=0,failed=0;
  for(const job of jobs){
    try{
      const result=await dispatchAgentExecution({executionId:job.runId,organizationId:job.organizationId,agentId:job.agentId,source:"schedule",intent:job.intent,params:job.params,requestedAt:now.toISOString()});
      if(result.status==="configuration_required"){ await failScheduledJobRun(job.runId,result.reason); failed+=1; }
      else { await completeScheduledJobRun(job.runId,{status:"queued",executionId:result.executionId}); completed+=1; }
      const next=job.cron ? nextCronFire(job.cron,now,job.timezone) : null;
      await advanceScheduledJob(job.id,next?.toISOString()??null,job.cron ? "active" : "archived",null);
    }catch(error){
      const message=error instanceof Error?error.message:"Scheduled execution failed"; await failScheduledJobRun(job.runId,message); await advanceScheduledJob(job.id,job.cron?job.nextFireAt:null,job.cron?"error":"archived",message); failed+=1;
    }
  }
  return {claimed:jobs.length,completed,failed};
}
