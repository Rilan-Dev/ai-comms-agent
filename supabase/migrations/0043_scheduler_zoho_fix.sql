-- 0043 — Fix: unique constraint on scheduled_job_runs + Zoho API domain
-- 1. scheduled_job_runs needs a UNIQUE constraint on (scheduled_job_id, fire_at)
--    for the ON CONFLICT clause in claimDueScheduledJobs.
-- 2. No schema change needed for Zoho — the domain validation is in code.
-- Idempotent. Forward-only.
--
-- NOTE: migration 0021 already created a partial UNIQUE INDEX with the
-- same name (scheduled_job_runs_job_fire_uniq) via
--   CREATE UNIQUE INDEX IF NOT EXISTS scheduled_job_runs_job_fire_uniq
--     ON scheduled_job_runs(scheduled_job_id, fire_at)
--     WHERE fire_at IS NOT NULL;
-- If that index exists, adding a CONSTRAINT with the same name fails with
-- "relation already exists" (42P07). The fix: check pg_class (covers both
-- indexes and constraints) instead of pg_constraint (constraints only),
-- and catch duplicate_table as a fallback.

-- If a unique INDEX with the same name already exists (from migration 0021),
-- skip adding the constraint — the index is sufficient for ON CONFLICT.
-- If neither exists, add the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'scheduled_job_runs_job_fire_uniq'
      AND n.nspname = current_schema()
  ) THEN
    ALTER TABLE scheduled_job_runs
      ADD CONSTRAINT scheduled_job_runs_job_fire_uniq
      UNIQUE (scheduled_job_id, fire_at);
  END IF;
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;
