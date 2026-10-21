import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// This source contract supplements the disposable PostgreSQL concurrency tests.
// It guards the destructive recovery boundary even without provider credentials.
const db = readFileSync(new URL("../../../packages/db/src/automation/repository.ts", import.meta.url), "utf8");
const worker = readFileSync(new URL("../src/scheduling/scheduler-worker.ts", import.meta.url), "utf8");
const exports = readFileSync(new URL("../../../packages/db/src/index.ts", import.meta.url), "utf8");

test("stale recovery locks only bounded running runs in a single transaction", () => {
  const recover = db.slice(db.indexOf("export async function recoverStaleScheduledJobRuns"),
    db.indexOf("export async function advanceScheduledJob"));
  assert.ok(recover.startsWith("export async function recoverStaleScheduledJobRuns"));
  assert.match(recover, /withTransaction\(async client/);
  assert.match(recover, /r\.status='running'/);
  assert.match(recover, /r\.started_at\s*</);
  assert.match(recover, /FOR UPDATE OF r,j SKIP LOCKED/);
  assert.match(recover, /LIMIT \$3/);
  assert.match(recover, /Math\.min\(Math\.max\(Math\.floor\(maxAgeMinutes\),\s*1\),\s*24\s*\*\s*60\)/);
});

test("interrupted outcome becomes terminal and explicitly requires manual verification", () => {
  const recover = db.slice(db.indexOf("export async function recoverStaleScheduledJobRuns"),
    db.indexOf("export async function advanceScheduledJob"));
  assert.match(recover, /UPDATE scheduled_job_runs SET status='failed'/);
  assert.match(recover, /WHERE id=\$1 AND status='running' RETURNING id/);
  assert.match(recover, /providerOutcomeUnknown:\s*true/);
  assert.match(recover, /manualVerificationRequired:\s*true/);
  assert.match(recover, /Worker execution interrupted/);
  assert.doesNotMatch(recover, /DELETE FROM scheduled_job_runs/);
});

test("recovery quarantines only same-tenant unchanged active fire, preserving pause and edits", () => {
  const recover = db.slice(db.indexOf("export async function recoverStaleScheduledJobRuns"),
    db.indexOf("export async function advanceScheduledJob"));
  assert.match(recover, /UPDATE scheduled_jobs SET status='error'/);
  assert.match(recover, /organization_id=\$2 AND status='active' AND next_fire_at=\$3::timestamptz/);
  assert.match(recover, /updated_at <= \$6::timestamptz/);
  assert.match(recover, /last_error=/);
  assert.doesNotMatch(recover, /status='active' SET/);
});

test("worker performs recovery before new claims, logs an auditable unknown outcome and does not replay", () => {
  const recovery = worker.indexOf("await recoverStaleScheduledJobRuns(");
  const claim = worker.indexOf("await claimDueScheduledJobs(");
  assert.ok(recovery >= 0 && claim > recovery);
  const scope = worker.slice(recovery, claim);
  assert.match(scope, /schedule\.execution\.interrupted/);
  assert.match(scope, /manualVerificationRequired:\s*true/);
  assert.doesNotMatch(scope, /dispatchAgentExecution\(/);
  assert.match(exports, /recoverStaleScheduledJobRuns/);
});

test("late executor cannot overwrite recovered terminal outcome or advance its scheduled job", () => {
  const complete = db.slice(db.indexOf("export async function completeScheduledJobRun"),
    db.indexOf("export async function listActiveAutomationRules"));
  assert.match(complete, /UPDATE scheduled_job_runs SET status='completed'/);
  assert.match(complete, /WHERE id=\$1 AND status='running' RETURNING id/);
  assert.match(complete, /UPDATE scheduled_job_runs SET status='failed'/);
  assert.match(complete, /return r\.rows\.length===1/);
  const running = worker.slice(worker.indexOf("export async function processScheduledJobs"));
  assert.match(running, /if\(!\(await completeScheduledJobRun\(/);
  assert.match(running, /if\(!\(await failScheduledJobRun\(/);
});


test("durable completed or failed runs with a stale parent fire are reconciled without replay", () => {
  const recover = db.slice(db.indexOf("export async function recoverStaleScheduledJobRuns"),
    db.indexOf("export async function advanceScheduledJob"));
  assert.match(recover, /r\.status IN \('completed','failed'\)/);
  assert.match(recover, /r\.fire_at=j\.next_fire_at/);
  assert.match(recover, /j\.status='active'/);
  assert.match(recover, /j\.updated_at <= r\.started_at/);
  assert.match(recover, /runStatus==='running'/);
  assert.match(recover, /runStatus==='completed'/);
  assert.match(recover, /schedule advancement did not finish/);
  assert.match(recover, /result=COALESCE\(result,'\{\}'::jsonb\)/);
  const execution = worker.slice(worker.indexOf("const interrupted=await recoverStaleScheduledJobRuns"),
    worker.indexOf("const jobs=await claimDueScheduledJobs"));
  assert.match(execution, /schedule\.progression\.interrupted/);
  assert.match(execution, /providerOutcomeUnknown:recovered\.runStatus==="running"/);
});
