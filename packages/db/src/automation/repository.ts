import { query, withTransaction } from "../client";
import { nextCronFire } from "@ai-comms-agent/shared";

type Row = Record<string, unknown>;

const schedule = (r: Row) => ({
  id: String(r.id),
  agentId: String(r.agent_id),
  organizationId: String(r.organization_id),
  name: String(r.name),
  cron: r.cron ? String(r.cron) : null,
  oneFireAt: r.one_fire_at ? String(r.one_fire_at) : null,
  intent: String(r.intent),
  params: (r.params ?? {}) as Record<string, unknown>,
  nextFireAt: r.next_fire_at ? String(r.next_fire_at) : null,
  lastFireAt: r.last_fire_at ? String(r.last_fire_at) : null,
  status: String(r.status),
  timezone: String(r.timezone ?? "UTC"),
  catchUpMinutes: Number(r.catch_up_minutes ?? 60),
  lastError: r.last_error ? String(r.last_error) : null,
  createdBy: r.created_by ? String(r.created_by) : null,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

const automation = (r: Row) => ({
  id: String(r.id),
  agentId: String(r.agent_id),
  organizationId: String(r.organization_id),
  name: String(r.name),
  trigger: (r.trigger ?? {}) as Record<string, unknown>,
  conditions: (r.conditions ?? {}) as Record<string, unknown>,
  actions: Array.isArray(r.actions) ? r.actions : [],
  status: String(r.status),
  createdBy: r.created_by ? String(r.created_by) : null,
  createdAt: String(r.created_at),
  updatedAt: String(r.updated_at),
});

export async function listScheduledJobs(organizationId: string) {
  const r = await query<Row>(
    "SELECT * FROM scheduled_jobs WHERE organization_id=$1 ORDER BY COALESCE(next_fire_at, one_fire_at) ASC NULLS LAST, created_at DESC",
    [organizationId],
  );
  return r.rows.map(schedule);
}

export async function getScheduledJob(organizationId: string, id: string) {
  const r = await query<Row>("SELECT * FROM scheduled_jobs WHERE organization_id=$1 AND id=$2", [organizationId, id]);
  return r.rows[0] ? schedule(r.rows[0]) : null;
}

export async function createScheduledJob(input: {
  organizationId: string;
  agentId: string;
  userId: string | null;
  name: string;
  cron?: string | null;
  oneFireAt?: string | null;
  intent: string;
  params?: Record<string, unknown>;
  nextFireAt?: string | null;
  timezone: string;
  catchUpMinutes: number;
}) {
  // Persist the first actual fire for recurring jobs. A null next_fire_at
  // makes an active cron schedule invisible to claimDueScheduledJobs.
  const nextFireAt = input.nextFireAt ?? (input.cron
    ? nextCronFire(input.cron, new Date(), input.timezone).toISOString()
    : input.oneFireAt ?? null);
  const r = await query<Row>(
    "INSERT INTO scheduled_jobs (organization_id,agent_id,created_by,name,cron,one_fire_at,intent,params,next_fire_at,status,timezone,catch_up_minutes) SELECT a.organization_id,a.id,$3,$4,$5,$6,$7,$8::jsonb,$9,'active',$10,$11 FROM agents a WHERE a.organization_id=$1 AND a.id=$2 RETURNING *",
    [input.organizationId, input.agentId, input.userId, input.name, input.cron ?? null, input.oneFireAt ?? null, input.intent, JSON.stringify(input.params ?? {}), nextFireAt, input.timezone, input.catchUpMinutes],
  );
  return r.rows[0] ? schedule(r.rows[0]) : null;
}

export async function updateScheduledJob(input: {
  organizationId: string;
  id: string;
  agentId?: string;
  name: string;
  cron?: string | null;
  oneFireAt?: string | null;
  intent: string;
  params?: Record<string, unknown>;
  nextFireAt?: string | null;
  status: "active" | "paused" | "archived" | "error";
  timezone: string;
  catchUpMinutes: number;
}) {
  // Persist the first actual fire for recurring jobs. A null next_fire_at
  // makes an active cron schedule invisible to claimDueScheduledJobs.
  const nextFireAt = input.nextFireAt ?? (input.cron
    ? nextCronFire(input.cron, new Date(), input.timezone).toISOString()
    : input.oneFireAt ?? null);
  const r = await query<Row>(
    "UPDATE scheduled_jobs j SET name=$3,cron=$4,one_fire_at=$5,intent=$6,params=$7::jsonb,next_fire_at=$8,status=$9,timezone=$10,catch_up_minutes=$11,last_error=NULL,agent_id=a.id,updated_at=now() FROM agents a WHERE j.organization_id=$1 AND j.id=$2 AND a.organization_id=j.organization_id AND a.id=COALESCE($12::uuid,j.agent_id) AND j.status <> 'archived' RETURNING j.*",
    [input.organizationId, input.id, input.name, input.cron ?? null, input.oneFireAt ?? null, input.intent, JSON.stringify(input.params ?? {}), nextFireAt, input.status, input.timezone, input.catchUpMinutes, input.agentId ?? null],
  );
  return r.rows[0] ? schedule(r.rows[0]) : null;
}

export async function deleteScheduledJob(organizationId: string, id: string) {
  const r = await query<Row>("UPDATE scheduled_jobs SET status='archived',updated_at=now() WHERE organization_id=$1 AND id=$2 AND status <> 'archived' RETURNING id", [organizationId, id]);
  return r.rows.length > 0;
}

export async function listScheduledJobRuns(organizationId: string, jobId: string) {
  const r = await query<Row>(
    "SELECT r.* FROM scheduled_job_runs r JOIN scheduled_jobs j ON j.id=r.scheduled_job_id WHERE j.organization_id=$1 AND j.id=$2 ORDER BY r.started_at DESC LIMIT 100",
    [organizationId, jobId],
  );
  return r.rows;
}

export async function listAutomationRules(organizationId: string) {
  const r = await query<Row>("SELECT * FROM automation_rules WHERE organization_id=$1 ORDER BY created_at DESC", [organizationId]);
  return r.rows.map(automation);
}

export async function createAutomationRule(input: {
  organizationId: string;
  agentId: string;
  userId: string;
  name: string;
  trigger: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  actions: unknown[];
}) {
  const r = await query<Row>(
    "INSERT INTO automation_rules (organization_id,agent_id,created_by,name,trigger,conditions,actions,status) SELECT a.organization_id,a.id,$3,$4,$5::jsonb,$6::jsonb,$7::jsonb,'active' FROM agents a WHERE a.organization_id=$1 AND a.id=$2 RETURNING *",
    [input.organizationId, input.agentId, input.userId, input.name, JSON.stringify(input.trigger), JSON.stringify(input.conditions ?? {}), JSON.stringify(input.actions)],
  );
  return r.rows[0] ? automation(r.rows[0]) : null;
}

export async function updateAutomationRule(input: {
  organizationId: string;
  id: string;
  name: string;
  trigger: Record<string, unknown>;
  conditions?: Record<string, unknown>;
  actions: unknown[];
  status: "active" | "paused" | "archived" | "error";
}) {
  const r = await query<Row>(
    "UPDATE automation_rules SET name=$3,trigger=$4::jsonb,conditions=$5::jsonb,actions=$6::jsonb,status=$7,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
    [input.organizationId, input.id, input.name, JSON.stringify(input.trigger), JSON.stringify(input.conditions ?? {}), JSON.stringify(input.actions), input.status],
  );
  return r.rows[0] ? automation(r.rows[0]) : null;
}

export async function deleteAutomationRule(organizationId: string, id: string) {
  const r = await query<Row>("UPDATE automation_rules SET status='archived',updated_at=now() WHERE organization_id=$1 AND id=$2 AND status <> 'archived' RETURNING id", [organizationId, id]);
  return r.rows.length > 0;
}

export async function listAutomationRuns(organizationId: string, ruleId: string) {
  const r = await query<Row>(
    "SELECT r.* FROM automation_runs r JOIN automation_rules a ON a.id=r.automation_rule_id WHERE a.organization_id=$1 AND a.id=$2 ORDER BY r.triggered_at DESC LIMIT 100",
    [organizationId, ruleId],
  );
  return r.rows;
}

export type ScheduledJobClaim = {
  runId:string; id:string; agentId:string; organizationId:string; intent:string; params:Record<string,unknown>;
  cron:string|null; nextFireAt:string; revisionAt:string; timezone:string; catchUpMinutes:number; createdBy:string|null;
};

export async function claimDueScheduledJobs(limit:number, nowIso:string):Promise<ScheduledJobClaim[]> {
  return withTransaction(async client=>{
    // Filter already-claimed occurrences before LIMIT: after an interruption,
    // existing run rows may remain due. They must not starve unrelated jobs.
    // Never re-dispatch an interrupted fire without an explicit recovery policy.
    const jobs=await client.query<Row>(
      "SELECT j.* FROM scheduled_jobs j WHERE j.status='active' AND j.next_fire_at IS NOT NULL AND j.next_fire_at <= $1::timestamptz AND NOT EXISTS (SELECT 1 FROM scheduled_job_runs r WHERE r.scheduled_job_id=j.id AND r.fire_at=j.next_fire_at) ORDER BY j.next_fire_at ASC LIMIT $2 FOR UPDATE OF j SKIP LOCKED",
      [nowIso,limit],
    );    const claims:ScheduledJobClaim[]=[];
    for(const row of jobs.rows){
      // Convert the DB-returned Date object to ISO 8601 string.
      // pg returns Date objects for timestamptz columns; String(date)
      // produces "Mon Oct 12 2026 ..." which PostgreSQL rejects (error 22007).
      const fireAt = row.next_fire_at ? new Date(row.next_fire_at as string | Date).toISOString() : null;
      if (!fireAt) continue;
      const revisionAt=new Date(row.updated_at as string|Date).toISOString();
      // Both migration 0021's partial unique index and migration 0043's
      // fallback full unique constraint support this conflict target.
      // A caught duplicate INSERT error would abort the PostgreSQL transaction;
      // conflict handling must occur in SQL so other due jobs can be claimed.
      const run = await client.query<Row>(
        "INSERT INTO scheduled_job_runs (scheduled_job_id,fire_at,status,result) VALUES ($1,$2::timestamptz,'running',$3::jsonb) ON CONFLICT (scheduled_job_id,fire_at) WHERE fire_at IS NOT NULL DO NOTHING RETURNING id",
        [row.id,fireAt,JSON.stringify({claimedAt:nowIso})],
      );
      const runId = run.rows[0]?.id ? String(run.rows[0].id) : null;
      if (!runId) continue;
      claims.push({runId,id:String(row.id),agentId:String(row.agent_id),organizationId:String(row.organization_id),intent:String(row.intent),params:(row.params??{}) as Record<string,unknown>,cron:row.cron?String(row.cron):null,nextFireAt:fireAt,revisionAt,timezone:String(row.timezone??"UTC"),catchUpMinutes:Number(row.catch_up_minutes??60),createdBy:row.created_by?String(row.created_by):null});
    }
    return claims;
  });
}

export type RecoveredScheduledJobRun = {
  runId:string; jobId:string; organizationId:string; runStatus:string; quarantined:boolean;
};

export async function recoverStaleScheduledJobRuns(
  nowIso:string, limit=25, maxAgeMinutes=24*60,
):Promise<RecoveredScheduledJobRun[]> {
  const safeAge=Math.min(Math.max(Math.floor(maxAgeMinutes), 1), 24 * 60);
  const safeLimit=Math.min(Math.max(Math.floor(limit), 1), 100);
  return withTransaction(async client=>{
    // Lock both the run and its parent. Never retry an unknown-outcome fire.
    // A paused or reconfigured schedule is not reactivated by recovery.
    const stale=await client.query<Row>(
      "SELECT r.id AS run_id,r.status AS run_status,r.fire_at,r.started_at,j.id AS job_id,j.organization_id FROM scheduled_job_runs r JOIN scheduled_jobs j ON j.id=r.scheduled_job_id WHERE r.started_at < $1::timestamptz - make_interval(mins => $2::int) AND (r.status='running' OR (r.status IN ('completed','failed') AND j.status='active' AND r.fire_at=j.next_fire_at AND j.updated_at <= r.started_at)) ORDER BY r.started_at ASC LIMIT $3 FOR UPDATE OF r,j SKIP LOCKED",
      [nowIso,safeAge,safeLimit],
    );
    const recovered:RecoveredScheduledJobRun[]=[];
    for(const row of stale.rows){
      const runId=String(row.run_id);
      const jobId=String(row.job_id);
      const organizationId=String(row.organization_id);
      const fireAt=row.fire_at ? new Date(row.fire_at as string|Date).toISOString() : null;
      const startedAt=new Date(row.started_at as string|Date).toISOString();
      const runStatus=String(row.run_status);
      const error=runStatus==='running'
        ? "Worker execution interrupted; external side effects may have occurred. Manual verification required."
        : runStatus==='completed'
          ? "Scheduled execution completed, but schedule advancement did not finish. Review before resuming."
          : "Scheduled execution failed, but schedule advancement did not finish. Review before resuming.";
      if(runStatus==='running'){
        const result=await client.query<Row>(
          "UPDATE scheduled_job_runs SET status='failed',finished_at=$2::timestamptz,error=$3,result=COALESCE(result,'{}'::jsonb) || $4::jsonb WHERE id=$1 AND status='running' RETURNING id",
          [runId,nowIso,error,JSON.stringify({recoveredStaleExecution:true,providerOutcomeUnknown:true,manualVerificationRequired:true})],
        );
        if(!result.rows.length) continue;
      }
      const held=await client.query<Row>(
        "UPDATE scheduled_jobs SET status='error',last_error=$4,updated_at=$5::timestamptz WHERE id=$1 AND organization_id=$2 AND status='active' AND next_fire_at=$3::timestamptz AND updated_at <= $6::timestamptz RETURNING id",
        [jobId,organizationId,fireAt,error,nowIso,startedAt],
      );
      recovered.push({runId,jobId,organizationId,runStatus,quarantined:held.rows.length>0});
    }
    return recovered;
  });
}

export async function advanceScheduledJob(id:string,organizationId:string,expectedFireAt:string,expectedUpdatedAt:string,nextFireAt:string|null,status:"active"|"archived"|"error",lastError:string|null){
  // A paused/archived schedule or a schedule edited after the claim must not
  // be resurrected by completion of the older in-flight occurrence.
  // The claim snapshot (expectedUpdatedAt) is a JS Date with millisecond
  // precision, while PostgreSQL updated_at carries microseconds: an exact
  // equality would NEVER match and the schedule would silently stop advancing
  // after its first fire. Compare within the same millisecond instead.
  const r=await query<{id:string}>(
    "UPDATE scheduled_jobs SET next_fire_at=$5::timestamptz,last_fire_at=now(),status=$6,last_error=$7,updated_at=now() WHERE id=$1 AND organization_id=$2 AND next_fire_at=$3::timestamptz AND status='active' AND updated_at >= $4::timestamptz AND updated_at < $4::timestamptz + interval '1 millisecond' RETURNING id",
    [id,organizationId,expectedFireAt,expectedUpdatedAt,nextFireAt,status,lastError],
  );
  return r.rows.length===1;
}

export async function completeScheduledJobRun(runId:string,result:Record<string,unknown>={}){
  const r=await query<{id:string}>("UPDATE scheduled_job_runs SET status='completed',finished_at=now(),result=$2::jsonb,error=NULL WHERE id=$1 AND status='running' RETURNING id",[runId,JSON.stringify(result)]);
  return r.rows.length===1;
}
export async function failScheduledJobRun(runId:string,error:string){
  const r=await query<{id:string}>("UPDATE scheduled_job_runs SET status='failed',finished_at=now(),error=$2 WHERE id=$1 AND status='running' RETURNING id",[runId,error]);
  return r.rows.length===1;
}

export async function listActiveAutomationRules(organizationId:string){
  // Never enumerate active rules globally for a single tenant's event.
  const r=await query<Row>(
    "SELECT * FROM automation_rules WHERE organization_id=$1 AND status='active' ORDER BY created_at ASC",
    [organizationId],
  );
  return r.rows.map(automation);
}
export async function createAutomationRun(ruleId:string,organizationId:string,result:Record<string,unknown>={},triggerEventKey?:string|null){
  const r=await query<Row>(
    `INSERT INTO automation_runs (automation_rule_id,organization_id,status,started_at,result,trigger_event_key)
     SELECT id,organization_id,'running',now(),$3::jsonb,$4 FROM automation_rules
     WHERE id=$1 AND organization_id=$2 AND status='active'
     ON CONFLICT (automation_rule_id,trigger_event_key) WHERE trigger_event_key IS NOT NULL DO NOTHING RETURNING id`,
    [ruleId,organizationId,JSON.stringify(result),triggerEventKey ?? null],
  );
  return r.rows[0]?String(r.rows[0].id):null;
}
/** A duplicate event is not successful when the original run is running or
 * failed. Never replay a potentially irreversible provider operation. */
export async function getAutomationRunStatus(ruleId:string,eventKey:string):Promise<string|null>{
  const r=await query<{status:string}>("SELECT status FROM automation_runs WHERE automation_rule_id=$1 AND trigger_event_key=$2 LIMIT 1",[ruleId,eventKey]);
  return r.rows[0]?.status??null;
}

/** Quarantine abandoned runs without dispatching their tools again.
 * Legacy rows may have a NULL started_at: use their creation timestamp. */
export async function recoverStaleAutomationRuns(limit=25,ageMinutes=30){
  const safeLimit=Math.max(1,Math.min(100,Math.floor(limit)||25));
  const safeAge=Math.max(30,Math.min(24*60,Math.floor(ageMinutes)||30));
  return withTransaction(async client=>{
    const r=await client.query<{id:string;organization_id:string;automation_rule_id:string}>(
      `WITH stale AS (
         SELECT id FROM automation_runs
         WHERE status='running' AND COALESCE(started_at,created_at) < now()-make_interval(mins => $2::int)
         ORDER BY COALESCE(started_at,created_at) ASC LIMIT $1 FOR UPDATE SKIP LOCKED
       )
       UPDATE automation_runs r SET status='failed',finished_at=now(),
         error='Execution interrupted; downstream outcome unknown. Verify provider activity before retrying.',
         result=COALESCE(r.result,'{}'::jsonb) || '{"manualVerificationRequired":true,"downstreamOutcomeUnknown":true,"recoveredStaleExecution":true}'::jsonb
       FROM stale, automation_rules a
       WHERE r.id=stale.id AND a.id=r.automation_rule_id AND r.status='running'
       RETURNING r.id::text,a.organization_id::text,r.automation_rule_id::text`,
      [safeLimit,safeAge],
    );
    return r.rows;
  });
}

export async function completeAutomationRun(runId:string,result:Record<string,unknown>={}){
  const r=await query<{id:string}>("UPDATE automation_runs SET status='completed',finished_at=now(),result=$2::jsonb,error=NULL WHERE id=$1 AND status='running' RETURNING id",[runId,JSON.stringify(result)]);
  return r.rows.length===1;
}
export async function failAutomationRun(runId:string,error:string){
  const r=await query<{id:string}>("UPDATE automation_runs SET status='failed',finished_at=now(),error=$2 WHERE id=$1 AND status='running' RETURNING id",[runId,error]);
  return r.rows.length===1;
}
