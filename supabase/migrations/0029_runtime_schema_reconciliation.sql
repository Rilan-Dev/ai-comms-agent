-- Forward-only reconciliation for installations whose legacy tables predate
-- the current mailbox worker and organization provider-settings contract.
-- Every operation is idempotent so this can be applied to partially migrated DBs.

ALTER TABLE ai_provider_configs
  ADD COLUMN IF NOT EXISTS model text;

ALTER TABLE email_sync_states
  ADD COLUMN IF NOT EXISTS organization_id uuid REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status email_sync_status NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS history_id text,
  ADD COLUMN IF NOT EXISTS last_success_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS next_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS error_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Preserve values from the older schema's column names when present.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_sync_states'
      AND column_name = 'history_token'
  ) THEN
    EXECUTE 'UPDATE email_sync_states SET history_id = COALESCE(history_id, history_token)';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'email_sync_states'
      AND column_name = 'last_sync_at'
  ) THEN
    EXECUTE 'UPDATE email_sync_states SET last_success_at = COALESCE(last_success_at, last_sync_at)';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS email_sync_states_org_status_idx
  ON email_sync_states(organization_id, status);
