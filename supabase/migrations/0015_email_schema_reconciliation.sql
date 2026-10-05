-- Phase 4: canonical email connection schema reconciliation.
-- Earlier Phase 4 drafts created overlapping email objects. This forward-only
-- migration reconciles the live PostgreSQL shape with the provider/runtime
-- contract without dropping stored credentials or mail data.

DO $$
BEGIN
  CREATE TYPE email_account_status_canonical AS ENUM ('pending','connected','error','disconnected','revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE email_accounts
  ADD COLUMN IF NOT EXISTS provider_account_id text,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

UPDATE email_accounts
SET last_synced_at = COALESCE(last_synced_at, last_sync_at)
WHERE last_synced_at IS NULL;

ALTER TABLE email_accounts
  ALTER COLUMN status DROP DEFAULT;

ALTER TABLE email_accounts
  ALTER COLUMN status TYPE email_account_status_canonical
  USING (
    CASE status::text
      WHEN 'active' THEN 'connected'
      WHEN 'expired' THEN 'error'
      WHEN 'revoked' THEN 'revoked'
      WHEN 'error' THEN 'error'
      WHEN 'pending' THEN 'pending'
      WHEN 'connected' THEN 'connected'
      WHEN 'disconnected' THEN 'disconnected'
      ELSE 'error'
    END
  )::email_account_status_canonical;

ALTER TABLE email_accounts
  ALTER COLUMN status SET DEFAULT 'pending';

ALTER TABLE email_account_credentials
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS credential_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS ciphertext bytea,
  ADD COLUMN IF NOT EXISTS key_reference text;

UPDATE email_account_credentials c
SET
  organization_id = COALESCE(c.organization_id, a.organization_id),
  ciphertext = COALESCE(c.ciphertext, c.encrypted_payload),
  key_reference = COALESCE(c.key_reference, 'credentials-master-key-v1')
FROM email_accounts a
WHERE a.id = c.email_account_id;

ALTER TABLE email_account_credentials
  ALTER COLUMN organization_id SET NOT NULL,
  ALTER COLUMN ciphertext SET NOT NULL,
  ALTER COLUMN key_reference SET NOT NULL;

CREATE INDEX IF NOT EXISTS email_account_credentials_org_idx
  ON email_account_credentials(organization_id);

ALTER TABLE email_folders
  ADD COLUMN IF NOT EXISTS organization_id uuid,
  ADD COLUMN IF NOT EXISTS folder_type text,
  ADD COLUMN IF NOT EXISTS parent_folder_id uuid;

UPDATE email_folders f
SET organization_id = COALESCE(f.organization_id, a.organization_id)
FROM email_accounts a
WHERE a.id = f.email_account_id;

ALTER TABLE email_folders
  ALTER COLUMN organization_id SET NOT NULL;

ALTER TABLE email_labels
  ADD COLUMN IF NOT EXISTS organization_id uuid;

UPDATE email_labels l
SET organization_id = COALESCE(l.organization_id, a.organization_id)
FROM email_accounts a
WHERE a.id = l.email_account_id;

ALTER TABLE email_labels
  ALTER COLUMN organization_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS email_folders_org_idx
  ON email_folders(organization_id);
CREATE INDEX IF NOT EXISTS email_labels_org_idx
  ON email_labels(organization_id);

-- The old enum name remains replaceable only after all references have moved.
-- Keep the canonical enum as the column type under a stable name.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_type
    WHERE typname = 'email_account_status'
  ) THEN
    DROP TYPE email_account_status;
  END IF;
  ALTER TYPE email_account_status_canonical RENAME TO email_account_status;
EXCEPTION WHEN dependent_objects_still_exist THEN
  -- A pre-existing deployment may retain an unrelated dependency; the column
  -- is already using the canonical enum, so leaving the temporary type is safe.
  NULL;
END $$;

INSERT INTO schema_migration_markers(key,value)
VALUES ('email-schema-reconciliation','canonical provider connection columns and status enum')
ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value;
