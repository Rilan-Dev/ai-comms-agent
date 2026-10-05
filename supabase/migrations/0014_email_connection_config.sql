-- Phase 4: email connection metadata correction.
-- connection_config contains non-secret provider connection metadata only.
-- Credentials remain exclusively in email_account_credentials.ciphertext.

ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS connection_config jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS email_accounts_connection_config_gin_idx
  ON email_accounts USING gin(connection_config);
