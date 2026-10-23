import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/0021_scheduled_run_idempotency.sql"), "utf8");
const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/automation/repository.ts"), "utf8");

test("scheduled runs persist the fire timestamp and enforce one run per fire", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS fire_at timestamptz/);
  assert.match(migration, /scheduled_job_runs_job_fire_uniq/);
  assert.match(migration, /ON scheduled_job_runs\(scheduled_job_id, fire_at\)/);
  assert.match(repository, /scheduled_job_id,fire_at,status,result/);
  // A duplicate unique-key error inside an open PostgreSQL transaction
  // aborts that transaction. Use conflict handling in the INSERT itself;
  // the predicate is needed to infer migration 0021's partial unique index.
  const claim = repository.slice(repository.indexOf("export async function claimDueScheduledJobs"),
    repository.indexOf("export async function advanceScheduledJob"));
  assert.match(claim, /INSERT INTO scheduled_job_runs \(scheduled_job_id,fire_at,status,result\)/);
  assert.match(claim, /ON CONFLICT \(scheduled_job_id,fire_at\) WHERE fire_at IS NOT NULL DO NOTHING RETURNING id/);
  assert.doesNotMatch(claim, /catch\s*\{/);
  assert.match(migration, /WHERE fire_at IS NOT NULL/);
  assert.match(repository, /const fireAt = row.next_fire_at/);
});


test("new or edited recurring schedules receive a due timestamp from the shared cron engine", () => {
  const shared = readFileSync(resolve(__dirname, "../../../packages/shared/src/index.ts"), "utf8");
  const cron = readFileSync(resolve(__dirname, "../../../packages/shared/src/scheduling/cron.ts"), "utf8");
  const workerCron = readFileSync(resolve(__dirname, "../src/scheduling/cron.ts"), "utf8");
  assert.match(shared, /export \{ matchesCron, nextCronFire \} from "\.\/scheduling\/cron"/);
  assert.match(workerCron, /export \{ matchesCron, nextCronFire \} from "@ai-comms-agent\/shared"/);
  assert.match(cron, /export function nextCronFire\(/);

  const create = repository.slice(repository.indexOf("export async function createScheduledJob"),
    repository.indexOf("export async function updateScheduledJob"));
  const update = repository.slice(repository.indexOf("export async function updateScheduledJob"),
    repository.indexOf("export async function deleteScheduledJob"));
  assert.match(repository, /import \{ nextCronFire \} from "@ai-comms-agent\/shared"/);
  assert.match(create, /nextCronFire\(input\.cron,\s*new Date\(\),\s*input\.timezone\)\.toISOString\(\)/);
  assert.match(update, /nextCronFire\(input\.cron,\s*new Date\(\),\s*input\.timezone\)\.toISOString\(\)/);
});


test("advancing an occurrence cannot reactivate paused or edited schedules", () => {
  const advance = repository.slice(repository.indexOf("export async function advanceScheduledJob"),
    repository.indexOf("export async function completeScheduledJobRun"));
  assert.match(advance, /WHERE id=\$1 AND organization_id=\$2 AND next_fire_at=\$3::timestamptz AND status='active'/);
  assert.match(advance, /\[id,organizationId,expectedFireAt,expectedUpdatedAt,nextFireAt,status,lastError\]/);
  assert.match(advance, /RETURNING id/);

  const scheduler = readFileSync(resolve(__dirname, "../src/scheduling/scheduler-worker.ts"), "utf8");
  assert.match(scheduler, /advanceScheduledJob\(job\.id,job\.organizationId,job\.nextFireAt,/);
  assert.match(repository, /nextFireAt:string; revisionAt:string; timezone:string; catchUpMinutes:number/);
});


test("duplicate durable occurrences do not consume the due-claim batch limit", () => {
  // After a worker interruption the scheduled job can remain due even
  // though its fire_at already has a durable running/completed/failed run.
  // Such blocked rows must be filtered BEFORE LIMIT, not skipped after it.
  const claim = repository.slice(repository.indexOf("export async function claimDueScheduledJobs"),
    repository.indexOf("export async function advanceScheduledJob"));
  assert.match(claim, /SELECT j\.\* FROM scheduled_jobs j/);
  assert.match(claim, /NOT EXISTS \(SELECT 1 FROM scheduled_job_runs r WHERE r\.scheduled_job_id=j\.id AND r\.fire_at=j\.next_fire_at\)/);
  const duplicateFilter = claim.indexOf("NOT EXISTS (SELECT 1 FROM scheduled_job_runs");
  const orderBy = claim.indexOf("ORDER BY j.next_fire_at");
  const limit = claim.indexOf("LIMIT $2");
  assert.ok(duplicateFilter >= 0 && orderBy > duplicateFilter && limit > orderBy,
    "existing run occurrences must be excluded before limiting due jobs");
  assert.match(claim, /FOR UPDATE OF j SKIP LOCKED/);
  assert.match(claim, /ON CONFLICT \(scheduled_job_id,fire_at\) WHERE fire_at IS NOT NULL DO NOTHING RETURNING id/);
});


test("an in-flight run cannot overwrite same-fire schedule edits, even if status stays active", () => {
  const claim = repository.slice(repository.indexOf("export async function claimDueScheduledJobs"),
    repository.indexOf("export type RecoveredScheduledJobRun"));
  assert.match(claim, /const revisionAt=new Date\(row\.updated_at/);
  assert.match(claim, /row\.updated_at/);
  assert.match(claim, /toISOString\(\)/);
  const advance = repository.slice(repository.indexOf("export async function advanceScheduledJob"),
    repository.indexOf("export async function completeScheduledJobRun"));
  assert.match(advance, /AND status='active' AND updated_at=\$4::timestamptz RETURNING id/);
  assert.match(advance, /next_fire_at=\$5::timestamptz/);
  assert.match(advance, /\[id,organizationId,expectedFireAt,expectedUpdatedAt,nextFireAt,status,lastError\]/);
  const worker = readFileSync(resolve(__dirname, "../src/scheduling/scheduler-worker.ts"), "utf8");
  assert.equal((worker.match(/advanceScheduledJob\(job\.id,job\.organizationId,job\.nextFireAt,job\.revisionAt,/g)??[]).length, 2);
});
