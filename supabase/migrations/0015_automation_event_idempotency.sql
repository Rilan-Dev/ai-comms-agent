-- Phase 4 continuation: deterministic automation event idempotency.
-- Provider/webhook/worker retries must not create duplicate automation runs for the same
-- rule + source event. The key is optional because scheduled/internal events may not have
-- an externally stable event identifier.

ALTER TABLE automation_runs
  ADD COLUMN IF NOT EXISTS trigger_event_key text;

CREATE UNIQUE INDEX IF NOT EXISTS automation_runs_rule_event_key_uniq
  ON automation_runs (automation_rule_id, trigger_event_key)
  WHERE trigger_event_key IS NOT NULL;
