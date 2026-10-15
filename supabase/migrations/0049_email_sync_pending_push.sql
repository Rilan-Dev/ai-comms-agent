-- 0049 — Preserve Gmail push events that arrive while a mailbox sync is running.
ALTER TABLE email_sync_states
  ADD COLUMN IF NOT EXISTS pending_push_at timestamptz;

CREATE INDEX IF NOT EXISTS email_sync_states_pending_push_idx
  ON email_sync_states (pending_push_at)
  WHERE pending_push_at IS NOT NULL;

COMMENT ON COLUMN email_sync_states.pending_push_at IS
  'Newest provider push signal not yet covered by a completed mailbox reconciliation.';
