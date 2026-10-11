-- Phase 4 scheduling idempotency hardening.
-- One durable run is allowed for each scheduled job fire time.

ALTER TABLE scheduled_job_runs
  ADD COLUMN IF NOT EXISTS fire_at timestamptz;

CREATE UNIQUE INDEX IF NOT EXISTS scheduled_job_runs_job_fire_uniq
  ON scheduled_job_runs(scheduled_job_id, fire_at)
  WHERE fire_at IS NOT NULL;
