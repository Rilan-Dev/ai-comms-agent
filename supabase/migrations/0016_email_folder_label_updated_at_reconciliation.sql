-- Reconcile partially-created email folder/label tables with the runtime repository contract.
-- Forward-only and idempotent: preserve existing mailbox data and populate timestamps for old rows.

ALTER TABLE email_folders
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE email_labels
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Recreate triggers idempotently so subsequent updates keep timestamps current.
CREATE OR REPLACE FUNCTION update_email_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS email_folders_updated_at ON email_folders;
CREATE TRIGGER email_folders_updated_at
  BEFORE UPDATE ON email_folders
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();

DROP TRIGGER IF EXISTS email_labels_updated_at ON email_labels;
CREATE TRIGGER email_labels_updated_at
  BEFORE UPDATE ON email_labels
  FOR EACH ROW EXECUTE FUNCTION update_email_updated_at();
