-- 0039 — email_messages Gmail API drift fixup
-- The Gmail API adapter INSERTs into `internet_message_id` column, but the
-- existing email_messages table only has `message_id_header`. Add the alias
-- column. Also add a few other columns the Gmail API sync may reference.
-- Idempotent. Forward-only.

ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS internet_message_id text;

-- Some Gmail API sync paths also reference `thread_message_id` and `size`
ALTER TABLE email_messages
  ADD COLUMN IF NOT EXISTS thread_message_id text,
  ADD COLUMN IF NOT EXISTS size bigint;

-- Index for the ON CONFLICT (email_account_id, provider_message_id) lookup
CREATE INDEX IF NOT EXISTS email_messages_account_provider_idx
  ON email_messages(email_account_id, provider_message_id);
