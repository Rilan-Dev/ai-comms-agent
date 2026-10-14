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
  // The claimDueScheduledJobs function uses try/catch around the INSERT
  // instead of ON CONFLICT — some databases (e.g., Prisma Postgres with
  // partial unique indexes) don't support ON CONFLICT inference. The
  // try/catch catches the duplicate-key error and continues to the next job.
  assert.match(repository, /try \{/);
  assert.match(repository, /INSERT INTO scheduled_job_runs \(scheduled_job_id,fire_at,status,result\)/);
  assert.match(repository, /Duplicate key/);
  assert.match(repository, /const fireAt = row.next_fire_at/);
});
