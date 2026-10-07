import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const migration = readFileSync(resolve(__dirname, "../../../supabase/migrations/0021_scheduled_run_idempotency.sql"), "utf8");
const repository = readFileSync(resolve(__dirname, "../../../packages/db/src/automation/repository.ts"), "utf8");

test("scheduled runs persist the fire timestamp and enforce one run per fire", () => {
  assert.match(migration, /ADD COLUMN IF NOT EXISTS fire_at timestamptz/);
  assert.match(migration, /scheduled_job_runs_job_fire_uniq/);
  assert.match(migration, /ON scheduled_job_runs\\(scheduled_job_id, fire_at\\)/);
  assert.match(repository, /scheduled_job_id,fire_at,status,result/);
  assert.match(repository, /ON CONFLICT \\(scheduled_job_id,fire_at\\) DO NOTHING/);
  assert.match(repository, /const fireAt = row.next_fire_at/);
});
