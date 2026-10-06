-- Phase 4 scheduling/automation runtime fields.
-- Forward-only; PostgreSQL 15+.

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
