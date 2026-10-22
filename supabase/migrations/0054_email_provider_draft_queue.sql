-- FIX-01: explicit manual provider-draft queue state and per-attempt write fencing.
-- The older check excluded queued, while draft edits erroneously wrote pending.
-- Token fencing prevents a worker from marking a changed/unqueued draft synced.
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS provider_draft_sync_token uuid;

ALTER TABLE email_messages
  DROP CONSTRAINT IF EXISTS email_messages_provider_draft_sync_status_check;

ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_provider_draft_sync_status_check
  CHECK (provider_draft_sync_status IN ('local_only','queued','syncing','synced','error'));

CREATE INDEX IF NOT EXISTS email_messages_provider_draft_queue_idx
  ON email_messages(updated_at, id)
  WHERE is_draft = true AND provider_draft_sync_status = 'queued';

-- Recover stale jobs from an interrupted old worker without auto-dispatching
-- provider calls whose outcome is uncertain: only an explicit requeue is safe.
UPDATE email_messages
SET provider_draft_sync_status = 'error',
    provider_draft_sync_token = NULL,
    provider_draft_last_error = 'Previous provider draft synchronization was interrupted. Requeue this draft after reviewing it.'
WHERE is_draft = true AND provider_draft_sync_status = 'syncing'
  AND updated_at < now() - interval '30 minutes';
