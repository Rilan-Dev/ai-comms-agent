-- Allow the canonical encrypted-credential contract to write new rows.
-- Older schema drafts made credential_type and encrypted_payload mandatory,
-- while the current repository writes ciphertext + key_reference. Preserve
-- legacy columns/data for old rows, but do not require them for new writes.

ALTER TABLE email_account_credentials
  ALTER COLUMN credential_type DROP NOT NULL,
  ALTER COLUMN encrypted_payload DROP NOT NULL;
