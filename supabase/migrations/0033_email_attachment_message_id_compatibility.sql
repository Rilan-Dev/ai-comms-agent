-- Reconcile the legacy attachment foreign-key name with the current repository contract.
-- Older installations created email_attachments.email_message_id in 0002_application_domain.sql,
-- while current inbox/message queries use email_attachments.message_id. Preserve existing rows
-- and old column compatibility; this migration is safe to rerun.
ALTER TABLE email_attachments
  ADD COLUMN IF NOT EXISTS message_id uuid REFERENCES email_messages(id) ON DELETE CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_attachments'
      AND column_name = 'email_message_id'
  ) THEN
    EXECUTE 'UPDATE email_attachments SET message_id = email_message_id WHERE message_id IS NULL';
  END IF;

  -- Do not silently leave existing attachment rows disconnected from their message.
  IF EXISTS (SELECT 1 FROM email_attachments WHERE message_id IS NULL) THEN
    RAISE EXCEPTION '0033 attachment reconciliation found rows without message_id; inspect email_attachments before retrying';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_attachments_message_id_idx
  ON email_attachments(message_id);
