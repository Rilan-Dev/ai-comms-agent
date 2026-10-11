-- 0042 — Make whatsapp_accounts verify_token + encrypted_credentials nullable
-- The original migration created these as NOT NULL, but the app code
-- stores credentials via the separate credential_ciphertext column
-- (added in migration 0034), not via encrypted_credentials.
-- verify_token is set later during webhook configuration.
-- Idempotent. Forward-only.

ALTER TABLE whatsapp_accounts
  ALTER COLUMN verify_token DROP NOT NULL,
  ALTER COLUMN encrypted_credentials DROP NOT NULL;
