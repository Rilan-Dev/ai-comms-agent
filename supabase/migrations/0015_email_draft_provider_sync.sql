-- Phase 4 Mail: provider-backed local draft synchronization metadata.
-- This migration is additive and preserves local draft authority while recording
-- the remote provider draft identity/state when a worker synchronizes it.

ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS provider_draft_id text,
  ADD COLUMN IF NOT EXISTS provider_draft_sync_status text NOT NULL DEFAULT 'local_only',
  ADD COLUMN IF NOT EXISTS provider_draft_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_draft_last_error text;

ALTER TABLE email_messages
  DROP CONSTRAINT IF EXISTS email_messages_provider_draft_sync_status_check;

ALTER TABLE email_messages
  ADD CONSTRAINT email_messages_provider_draft_sync_status_check
  CHECK (provider_draft_sync_status IN ('local_only','syncing','synced','error'));

CREATE INDEX IF NOT EXISTS email_messages_provider_draft_idx
  ON email_messages(email_account_id, provider_draft_id)
  WHERE is_draft = true AND provider_draft_id IS NOT NULL;
