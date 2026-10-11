-- 0036 — email_threads runtime drift fixup (revised)
-- Worker's mailbox-sync INSERTs into email_threads expect these columns.
-- Idempotent. Forward-only.
-- NOTE: normalized_subject is a PLAIN text column (worker inserts a value);
--       it is NOT a GENERATED column.

ALTER TABLE email_threads
  ADD COLUMN IF NOT EXISTS normalized_subject text,
  ADD COLUMN IF NOT EXISTS participant_emails citext[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS first_message_at timestamptz;

-- If a previous version of this migration created normalized_subject as
-- GENERATED ALWAYS, drop and recreate it as a plain column so the worker
-- can INSERT a value into it.
DO $$
DECLARE
  col_kind text;
BEGIN
  SELECT attgenerated INTO col_kind
  FROM pg_attribute
  WHERE attrelid = 'aca.email_threads'::regclass AND attname = 'normalized_subject';
  IF col_kind = 's' THEN  -- 's' = STORED generated column
    ALTER TABLE email_threads DROP COLUMN normalized_subject;
    ALTER TABLE email_threads ADD COLUMN normalized_subject text;
  END IF;
END $$;

-- Unique constraint for worker's ON CONFLICT (email_account_id, provider_thread_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_threads_account_provider_uniq'
  ) THEN
    ALTER TABLE email_threads
      ADD CONSTRAINT email_threads_account_provider_uniq
      UNIQUE (email_account_id, provider_thread_id);
  END IF;
END $$;

-- Unique constraint for email_messages ON CONFLICT (email_account_id, provider_message_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'email_messages_account_provider_msg_uniq'
  ) THEN
    ALTER TABLE email_messages
      ADD CONSTRAINT email_messages_account_provider_msg_uniq
      UNIQUE (email_account_id, provider_message_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_threads_account_provider_idx
  ON email_threads(email_account_id, provider_thread_id)
  WHERE provider_thread_id IS NOT NULL;
