-- Durable Gmail/IMAP/Zoho page checkpoints.
-- A provider page is staged before full-message retrieval; each message ID is
-- removed only after its row and downstream indexing have completed.
ALTER TABLE email_sync_states
  ADD COLUMN IF NOT EXISTS pending_message_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS pending_cursor_token text,
  ADD COLUMN IF NOT EXISTS pending_history_id text,
  ADD COLUMN IF NOT EXISTS pending_sync_mode text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'email_sync_states'::regclass
      AND conname = 'email_sync_states_pending_message_ids_array_check'
  ) THEN
    ALTER TABLE email_sync_states
      ADD CONSTRAINT email_sync_states_pending_message_ids_array_check
      CHECK (jsonb_typeof(pending_message_ids) = 'array');
  END IF;
END $$;
