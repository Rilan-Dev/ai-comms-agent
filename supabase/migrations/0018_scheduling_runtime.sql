-- Phase 4 scheduling/automation runtime fields.
-- Forward-only; PostgreSQL 15+.

-- Reconcile the canonical scheduler column names before indexing runtime state.
ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS next_fire_at timestamptz;
UPDATE scheduled_jobs
SET next_fire_at = COALESCE(next_fire_at, next_run_at)
WHERE next_fire_at IS NULL;

ALTER TABLE automation_rules
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';


ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'UTC',
  ADD COLUMN IF NOT EXISTS catch_up_minutes integer NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS last_error text;

ALTER TABLE scheduled_jobs
  DROP CONSTRAINT IF EXISTS scheduled_jobs_catch_up_minutes_check;
ALTER TABLE scheduled_jobs
  ADD CONSTRAINT scheduled_jobs_catch_up_minutes_check CHECK (catch_up_minutes BETWEEN 0 AND 10080);

CREATE INDEX IF NOT EXISTS scheduled_jobs_org_next_fire_idx
  ON scheduled_jobs(organization_id, next_fire_at)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS automation_rules_org_status_idx
  ON automation_rules(organization_id, status);
