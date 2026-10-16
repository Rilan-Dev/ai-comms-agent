-- 0043 — Fix: unique constraint on scheduled_job_runs + Zoho API domain
-- 1. scheduled_job_runs needs a UNIQUE constraint on (scheduled_job_id, fire_at)
--    for the ON CONFLICT clause in claimDueScheduledJobs.
-- 2. No schema change needed for Zoho — the domain validation is in code.
-- Idempotent. Forward-only.

-- Unique constraint for ON CONFLICT (scheduled_job_id, fire_at)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'scheduled_job_runs_job_fire_uniq'
  ) AND NOT EXISTS (
    -- 0021_scheduled_run_idempotency already creates a UNIQUE INDEX with this
    -- exact name; ADD CONSTRAINT would try to create its backing index with the
    -- same name and fail with "relation already exists" (42P07). The unique
    -- index alone already serves the ON CONFLICT arbiter, so the constraint is
    -- only needed when neither object exists.
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND indexname = 'scheduled_job_runs_job_fire_uniq'
  ) THEN
    ALTER TABLE scheduled_job_runs
      ADD CONSTRAINT scheduled_job_runs_job_fire_uniq
      UNIQUE (scheduled_job_id, fire_at);
  END IF;
END $$;

-- Drop and recreate the constraint if it exists but is not unique
-- (in case a previous migration created a non-unique index)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = current_schema()
      AND tablename = 'scheduled_job_runs'
      AND indexdef ILIKE '%UNIQUE%scheduled_job_id%fire_at%'
  ) THEN
    ALTER TABLE scheduled_job_runs
      ADD CONSTRAINT scheduled_job_runs_job_fire_uniq
      UNIQUE (scheduled_job_id, fire_at);
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
