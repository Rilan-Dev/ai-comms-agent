-- Keep the provider pagination checkpoint in a canonical text column.
-- Older deployments created email_sync_states.cursor as JSONB; current provider
-- adapters use opaque string tokens. Preserve recoverable legacy values without
-- coercing JSON objects into invalid provider tokens.
ALTER TABLE email_sync_states
  ADD COLUMN IF NOT EXISTS cursor_token text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_sync_states'
      AND column_name = 'cursor'
      AND data_type = 'jsonb'
  ) THEN
    EXECUTE $migrate$
      UPDATE email_sync_states
      SET cursor_token = COALESCE(
        cursor_token,
        CASE
          WHEN jsonb_typeof(cursor) = 'string' THEN cursor #>> '{}'
          WHEN jsonb_typeof(cursor) = 'object' THEN COALESCE(
            cursor ->> 'cursor',
            cursor ->> 'pageToken',
            cursor ->> 'nextPageToken'
          )
          ELSE NULL
        END
      )
      WHERE cursor_token IS NULL
    $migrate$;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_sync_states'
      AND column_name = 'cursor'
      AND data_type IN ('text', 'character varying')
  ) THEN
    EXECUTE 'UPDATE email_sync_states SET cursor_token = COALESCE(cursor_token, cursor) WHERE cursor_token IS NULL';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_sync_states_due_cursor_idx
  ON email_sync_states(status, next_attempt_at, last_success_at);
