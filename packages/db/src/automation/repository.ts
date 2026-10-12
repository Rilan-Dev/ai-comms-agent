import { query, withTransaction } from "../client";

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
  userId: string;
  name: string;
  cron?: string | null;
  oneFireAt?: string | null;
  intent: string;
  params?: Record<string, unknown>;
  nextFireAt?: string | null;
  timezone: string;
  catchUpMinutes: number;
}) {
  const r = await query<Row>(
    "INSERT INTO scheduled_jobs (organization_id,agent_id,created_by,name,cron,one_fire_at,intent,params,next_fire_at,status,timezone,catch_up_minutes) SELECT a.organization_id,a.id,$3,$4,$5,$6,$7,$8::jsonb,$9,'active',$10,$11 FROM agents a WHERE a.organization_id=$1 AND a.id=$2 RETURNING *",
    [input.organizationId, input.agentId, input.userId, input.name, input.cron ?? null, input.oneFireAt ?? null, input.intent, JSON.stringify(input.params ?? {}), input.nextFireAt ?? input.oneFireAt ?? null, input.timezone, input.catchUpMinutes],
  );
  return r.rows[0] ? schedule(r.rows[0]) : null;
}

export async function updateScheduledJob(input: {
  organizationId: string;
  id: string;
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
  const r = await query<Row>(
    "UPDATE scheduled_jobs SET name=$3,cron=$4,one_fire_at=$5,intent=$6,params=$7::jsonb,next_fire_at=$8,status=$9,timezone=$10,catch_up_minutes=$11,last_error=NULL,updated_at=now() WHERE organization_id=$1 AND id=$2 RETURNING *",
    [input.organizationId, input.id, input.name, input.cron ?? null, input.oneFireAt ?? null, input.intent, JSON.stringify(input.params ?? {}), input.nextFireAt ?? input.oneFireAt ?? null, input.status, input.timezone, input.catchUpMinutes],
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
  cron:string|null; nextFireAt:string|null; timezone:string; catchUpMinutes:number;
};

export async function claimDueScheduledJobs(limit:number, nowIso:string):Promise<ScheduledJobClaim[]> {
  return withTransaction(async client=>{
    const jobs=await client.query<Row>(
      "SELECT * FROM scheduled_jobs WHERE status='active' AND next_fire_at IS NOT NULL AND next_fire_at <= $1::timestamptz ORDER BY next_fire_at ASC FOR UPDATE SKIP LOCKED LIMIT $2",
      [nowIso,limit],
    );
    const claims:ScheduledJobClaim[]=[];
    for(const row of jobs.rows){
      // Convert the DB-returned Date object to ISO 8601 string.
      // pg returns Date objects for timestamptz columns; String(date)
      // produces "Mon Oct 12 2026 ..." which PostgreSQL rejects (error 22007).
      const fireAt = row.next_fire_at ? new Date(row.next_fire_at as string | Date).toISOString() : null;
      if (!fireAt) continue;
      // Use try/catch instead of ON CONFLICT — some databases have partial
      // unique indexes that don't work with ON CONFLICT inference.
      let runId: string | null = null;
      try {
        const run=await client.query<Row>(
          "INSERT INTO scheduled_job_runs (scheduled_job_id,fire_at,status,result) VALUES ($1,$2::timestamptz,'running',$3::jsonb) RETURNING id",
          [row.id,fireAt,JSON.stringify({claimedAt:nowIso})],
        );
        runId = run.rows[0]?.id ? String(run.rows[0].id) : null;
      } catch {
        // Duplicate key — a run already exists for this (scheduled_job_id, fire_at).
        // This is expected when the scheduler fires before the previous run completes.
        continue;
      }
      if (!runId) continue;
      claims.push({runId:String(run.rows[0].id),id:String(row.id),agentId:String(row.agent_id),organizationId:String(row.organization_id),intent:String(row.intent),params:(row.params??{}) as Record<string,unknown>,cron:row.cron?String(row.cron):null,nextFireAt:fireAt,timezone:String(row.timezone??"UTC"),catchUpMinutes:Number(row.catch_up_minutes??60)});
    }
    return claims;
  });
}

export async function advanceScheduledJob(id:string,nextFireAt:string|null,status:"active"|"archived"|"error",lastError:string|null){
  await query("UPDATE scheduled_jobs SET next_fire_at=$2::timestamptz,last_fire_at=now(),status=$3,last_error=$4,updated_at=now() WHERE id=$1",[id,nextFireAt,status,lastError]);
}

export async function completeScheduledJobRun(runId:string,result:Record<string,unknown>={}){
  await query("UPDATE scheduled_job_runs SET status='completed',finished_at=now(),result=$2::jsonb,error=NULL WHERE id=$1",[runId,JSON.stringify(result)]);
}
export async function failScheduledJobRun(runId:string,error:string){
  await query("UPDATE scheduled_job_runs SET status='failed',finished_at=now(),error=$2 WHERE id=$1",[runId,error]);
}

export async function listActiveAutomationRules(){
  const r=await query<Row>("SELECT * FROM automation_rules WHERE status='active' ORDER BY created_at ASC");
  return r.rows.map(automation);
}
export async function createAutomationRun(ruleId:string, result:Record<string,unknown>={}, triggerEventKey?:string|null){
  const r=await query<Row>(
    "INSERT INTO automation_runs (automation_rule_id,status,result,trigger_event_key) VALUES ($1,'running',$2::jsonb,$3) ON CONFLICT (automation_rule_id,trigger_event_key) WHERE trigger_event_key IS NOT NULL DO NOTHING RETURNING id",
    [ruleId,JSON.stringify(result),triggerEventKey ?? null],
  );
  return r.rows[0]?String(r.rows[0].id):null;
}
export async function completeAutomationRun(runId:string,result:Record<string,unknown>={}){
  await query("UPDATE automation_runs SET status='completed',finished_at=now(),result=$2::jsonb,error=NULL WHERE id=$1",[runId,JSON.stringify(result)]);
}
export async function failAutomationRun(runId:string,error:string){
  await query("UPDATE automation_runs SET status='failed',finished_at=now(),error=$2 WHERE id=$1",[runId,error]);
}
